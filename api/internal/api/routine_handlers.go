package api

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"
	"uuid"

	"github.com/labstack/echo/v5"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/routines"
	"github.com/tradermemos/api/internal/store"
)

// Routines are the daily checklist grown up: items carry a stage and a weekday
// schedule, and each day's ticks are rows of their own (routine_checks) rather
// than `- [x]` lines in that day's daily log. Days are the client's local
// calendar days (YYYY-MM-DD), passed explicitly; see internal/routines.
func (s *Server) routineRoutes(g *echo.Group) {
	g.GET("/routines", s.handleListRoutines)
	g.POST("/routines", s.handleCreateRoutine)
	g.PUT("/routines/order", s.handleOrderRoutines)
	g.PATCH("/routines/:id", s.handleUpdateRoutine)
	g.DELETE("/routines/:id", s.handleArchiveRoutine)
	g.GET("/routines/history", s.handleRoutineHistory)
	g.GET("/routines/day/:day", s.handleRoutineDay)
	g.PUT("/routines/day/:day/items/:id", s.handleCheckRoutine)
}

// maxRoutineHistoryDays bounds one history request (a bit over a year).
const maxRoutineHistoryDays = 400

type routineItemDTO struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Stage    string `json:"stage"`
	Weekdays []int  `json:"weekdays"`
	Position int64  `json:"position"`
	StartDay string `json:"start_day"`
}

func routineItemFromRow(r store.RoutineItem) routineItemDTO {
	return routineItemDTO{
		ID: r.ID, Title: r.Title, Stage: r.Stage, Weekdays: routines.DaysFromMask(r.Weekdays),
		Position: r.Position, StartDay: r.StartDay,
	}
}

func schedItem(r store.RoutineItem) routines.Item {
	return routines.Item{
		ID: r.ID, Stage: r.Stage, Position: r.Position, Weekdays: r.Weekdays,
		StartDay: r.StartDay, EndDay: r.EndDay.String,
	}
}

// requestDay reads a YYYY-MM-DD day from the named query param, falling back
// to the UTC date when absent. A malformed value is an error.
func requestDay(c *echo.Context, param string) (string, error) {
	day := c.QueryParam(param)
	if day == "" {
		return routines.FormatDay(time.Now().UTC()), nil
	}
	if _, ok := routines.ParseDay(day); !ok {
		return "", fmt.Errorf("%s must be YYYY-MM-DD", param)
	}
	return day, nil
}

// routineItems loads every item, archived ones included, seeding from the old
// checklist template on first use.
func (s *Server) routineItems(ctx context.Context, uid, today string) ([]store.RoutineItem, error) {
	rows, err := s.deps.Store.ListRoutineItems(ctx, uid)
	if err != nil || len(rows) > 0 {
		return rows, err
	}
	seeded, err := s.seedRoutines(ctx, uid, today)
	if err != nil || !seeded {
		return rows, err
	}
	return s.deps.Store.ListRoutineItems(ctx, uid)
}

// routineSeedMu serializes seeding. A page's first load asks for items, the day
// and history at once; without it each request starts seeding, and one that
// reads mid-seed caches a partial list. The seed itself is one transaction, so
// a reader outside the lock sees either nothing (and waits here) or all of it.
var routineSeedMu sync.Mutex

// seedID derives a stable id for the i-th seeded item, so two first requests
// racing each other insert the same rows and the second becomes a no-op.
func seedID(uid string, i int, title string) string {
	h := sha256.Sum256(fmt.Appendf(nil, "routine-seed\x00%s\x00%d\x00%s", uid, i, title))
	return fmt.Sprintf("%x-%x-%x-%x-%x", h[0:4], h[4:6], h[6:8], h[8:10], h[10:16])
}

// seedRoutines turns the daily checklist template into pre-session routine
// items on Monday to Friday (the mobile card's default schedule), then imports
// the ticks the checklist wrote into daily logs as history: a `- [x]` line
// whose text matches an item counts as that item done on the log's day.
// Items start on the first imported day so that history scores against them.
func (s *Server) seedRoutines(ctx context.Context, uid, today string) (bool, error) {
	routineSeedMu.Lock()
	defer routineSeedMu.Unlock()
	// Another request may have seeded while this one waited for the lock.
	if rows, err := s.deps.Store.ListRoutineItems(ctx, uid); err != nil || len(rows) > 0 {
		return len(rows) > 0, err
	}

	tmpl, err := s.deps.Store.GetChecklistTemplate(ctx, uid)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	titles := resolveChecklist(tmpl).Items
	if len(titles) == 0 {
		return false, nil
	}

	notes, err := s.deps.Store.ListJournalNotes(ctx, store.ListJournalNotesParams{UserID: uid})
	if err != nil {
		return false, err
	}
	index := map[string]int{}
	for i, title := range titles {
		index[strings.ToLower(strings.TrimSpace(title))] = i
	}
	type hit struct {
		item int
		day  string
	}
	var hits []hit
	start := today
	for _, n := range notes {
		if n.NoteType != "daily_log" || len(n.OccurredAt) < 10 {
			continue
		}
		day := n.OccurredAt[:10]
		if _, ok := routines.ParseDay(day); !ok || day > today {
			continue
		}
		for _, text := range routines.DoneTasks(n.Body) {
			if i, ok := index[strings.ToLower(text)]; ok {
				hits = append(hits, hit{i, day})
				start = min(start, day)
			}
		}
	}

	ids := make([]string, len(titles))
	err = store.InTx(ctx, s.deps.Store, func(q store.Querier) error {
		for i, title := range titles {
			ids[i] = seedID(uid, i, title)
			if err := q.SeedRoutineItem(ctx, store.SeedRoutineItemParams{
				ID: ids[i], UserID: uid, Title: strings.TrimSpace(title), Stage: routines.StagePre,
				Weekdays: routines.MonToFri, Position: int64(i), StartDay: start,
			}); err != nil {
				return err
			}
		}
		for _, h := range hits {
			if err := q.InsertRoutineCheck(ctx, store.InsertRoutineCheckParams{
				UserID: uid, ItemID: ids[h.item], Day: h.day,
			}); err != nil {
				return err
			}
		}
		return nil
	})
	return err == nil, err
}

func (s *Server) handleListRoutines(c *echo.Context) error {
	ctx, uid := c.Request().Context(), auth.UserID(c)
	today, err := requestDay(c, "day")
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", err.Error(), nil)
	}
	rows, err := s.routineItems(ctx, uid, today)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load routines", nil)
	}
	items := []routines.Item{}
	byID := map[string]store.RoutineItem{}
	for _, r := range rows {
		if !r.EndDay.Valid {
			items = append(items, schedItem(r))
			byID[r.ID] = r
		}
	}
	routines.Sort(items)
	out := make([]routineItemDTO, 0, len(items))
	for _, it := range items {
		out = append(out, routineItemFromRow(byID[it.ID]))
	}
	return c.JSON(http.StatusOK, map[string]any{"items": out})
}

type routineInput struct {
	Title    *string `json:"title"`
	Stage    *string `json:"stage"`
	Weekdays *[]int  `json:"weekdays"`
	Day      string  `json:"day"`
}

// validate checks the fields present; create requires all three.
func (in routineInput) validate(create bool) error {
	if create && (in.Title == nil || in.Stage == nil || in.Weekdays == nil) {
		return errors.New("title, stage and weekdays are required")
	}
	if in.Title != nil && strings.TrimSpace(*in.Title) == "" {
		return errors.New("title is required")
	}
	if in.Stage != nil && !routines.ValidStage(*in.Stage) {
		return errors.New("stage must be pre, during or post")
	}
	if in.Weekdays != nil && routines.MaskFromDays(*in.Weekdays) == 0 {
		return errors.New("weekdays must include at least one day 0-6")
	}
	if in.Day != "" {
		if _, ok := routines.ParseDay(in.Day); !ok {
			return errors.New("day must be YYYY-MM-DD")
		}
	}
	return nil
}

func (s *Server) handleCreateRoutine(c *echo.Context) error {
	ctx, uid := c.Request().Context(), auth.UserID(c)
	var in routineInput
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}
	if err := in.validate(true); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", err.Error(), nil)
	}
	day := in.Day
	if day == "" {
		day = routines.FormatDay(time.Now().UTC())
	}
	// Seed first, so adding the first item by hand can't strand the template.
	rows, err := s.routineItems(ctx, uid, day)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load routines", nil)
	}
	var position int64
	for _, r := range rows {
		if !r.EndDay.Valid && r.Stage == *in.Stage {
			position = max(position, r.Position+1)
		}
	}
	row, err := s.deps.Store.CreateRoutineItem(ctx, store.CreateRoutineItemParams{
		ID: uuid.New().String(), UserID: uid, Title: strings.TrimSpace(*in.Title), Stage: *in.Stage,
		Weekdays: routines.MaskFromDays(*in.Weekdays), Position: position, StartDay: day,
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not create routine", nil)
	}
	return c.JSON(http.StatusCreated, routineItemFromRow(row))
}

// handleUpdateRoutine edits an item. A title edit is in place. A schedule or
// stage edit changes which days the item counts on and where it scores, so it
// must not reach back into history: the item ends on `day` and a successor
// carries the new schedule from `day` on, taking that day's ticks with it.
// (An item created that same day has no history and is edited in place.)
func (s *Server) handleUpdateRoutine(c *echo.Context) error {
	ctx, uid := c.Request().Context(), auth.UserID(c)
	var in routineInput
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}
	if err := in.validate(false); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", err.Error(), nil)
	}
	day := in.Day
	if day == "" {
		day = routines.FormatDay(time.Now().UTC())
	}
	cur, err := s.deps.Store.GetRoutineItem(ctx, store.GetRoutineItemParams{ID: c.Param("id"), UserID: uid})
	if errors.Is(err, sql.ErrNoRows) || (err == nil && cur.EndDay.Valid) {
		return Fail(http.StatusNotFound, "not_found", "routine not found", nil)
	}
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load routine", nil)
	}
	next := store.UpdateRoutineItemParams{
		Title: cur.Title, Stage: cur.Stage, Weekdays: cur.Weekdays, ID: cur.ID, UserID: uid,
	}
	if in.Title != nil {
		next.Title = strings.TrimSpace(*in.Title)
	}
	if in.Stage != nil {
		next.Stage = *in.Stage
	}
	if in.Weekdays != nil {
		next.Weekdays = routines.MaskFromDays(*in.Weekdays)
	}
	rescheduled := next.Stage != cur.Stage || next.Weekdays != cur.Weekdays
	if !rescheduled || day <= cur.StartDay {
		row, err := s.deps.Store.UpdateRoutineItem(ctx, next)
		if err != nil {
			return Fail(http.StatusInternalServerError, "internal", "could not update routine", nil)
		}
		return c.JSON(http.StatusOK, routineItemFromRow(row))
	}

	var row store.RoutineItem
	err = store.InTx(ctx, s.deps.Store, func(q store.Querier) error {
		if _, err := q.ArchiveRoutineItem(ctx, store.ArchiveRoutineItemParams{
			EndDay: sql.NullString{String: day, Valid: true}, ID: cur.ID, UserID: uid,
		}); err != nil {
			return err
		}
		var err error
		row, err = q.CreateRoutineItem(ctx, store.CreateRoutineItemParams{
			ID: uuid.New().String(), UserID: uid, Title: next.Title, Stage: next.Stage,
			Weekdays: next.Weekdays, Position: cur.Position, StartDay: day,
		})
		if err != nil {
			return err
		}
		return q.MoveRoutineChecks(ctx, store.MoveRoutineChecksParams{
			ItemID: row.ID, ItemID_2: cur.ID, UserID: uid, Day: day,
		})
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not update routine", nil)
	}
	return c.JSON(http.StatusOK, routineItemFromRow(row))
}

// handleArchiveRoutine retires an item from `day` on; past days keep it.
func (s *Server) handleArchiveRoutine(c *echo.Context) error {
	ctx, uid := c.Request().Context(), auth.UserID(c)
	day, err := requestDay(c, "day")
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", err.Error(), nil)
	}
	n, err := s.deps.Store.ArchiveRoutineItem(ctx, store.ArchiveRoutineItemParams{
		EndDay: sql.NullString{String: day, Valid: true}, ID: c.Param("id"), UserID: uid,
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not delete routine", nil)
	}
	if n == 0 {
		return Fail(http.StatusNotFound, "not_found", "routine not found", nil)
	}
	return c.NoContent(http.StatusNoContent)
}

// handleOrderRoutines sets positions from the order of ids (within a stage,
// position is all that matters; across stages the stage still sorts first).
func (s *Server) handleOrderRoutines(c *echo.Context) error {
	ctx, uid := c.Request().Context(), auth.UserID(c)
	var in struct {
		IDs []string `json:"ids"`
	}
	if err := c.Bind(&in); err != nil || len(in.IDs) == 0 {
		return Fail(http.StatusBadRequest, "bad_request", "ids are required", nil)
	}
	for i, id := range in.IDs {
		if _, err := s.deps.Store.SetRoutineItemPosition(ctx, store.SetRoutineItemPositionParams{
			Position: int64(i), ID: id, UserID: uid,
		}); err != nil {
			return Fail(http.StatusInternalServerError, "internal", "could not reorder routines", nil)
		}
	}
	return c.NoContent(http.StatusNoContent)
}

type routineDayItemDTO struct {
	routineItemDTO
	Done bool `json:"done"`
}

type routineDayDTO struct {
	Day   string              `json:"day"`
	Items []routineDayItemDTO `json:"items"`
	Total int                 `json:"total"`
	Done  int                 `json:"done"`
}

func (s *Server) routineDay(ctx context.Context, uid, day string) (routineDayDTO, error) {
	rows, err := s.routineItems(ctx, uid, day)
	if err != nil {
		return routineDayDTO{}, err
	}
	checkRows, err := s.deps.Store.ListRoutineChecks(ctx, store.ListRoutineChecksParams{
		UserID: uid, Day: day, Day_2: day,
	})
	if err != nil {
		return routineDayDTO{}, err
	}
	checks := routines.Checks{}
	for _, ch := range checkRows {
		checks.Add(ch.Day, ch.ItemID)
	}
	byID := map[string]store.RoutineItem{}
	items := make([]routines.Item, 0, len(rows))
	for _, r := range rows {
		byID[r.ID] = r
		items = append(items, schedItem(r))
	}
	out := routineDayDTO{Day: day, Items: []routineDayItemDTO{}}
	for _, it := range routines.DayItems(items, checks, day) {
		done := checks[day][it.ID]
		out.Items = append(out.Items, routineDayItemDTO{routineItemFromRow(byID[it.ID]), done})
		out.Total++
		if done {
			out.Done++
		}
	}
	return out, nil
}

func (s *Server) handleRoutineDay(c *echo.Context) error {
	day := c.Param("day")
	if _, ok := routines.ParseDay(day); !ok {
		return Fail(http.StatusBadRequest, "bad_request", "day must be YYYY-MM-DD", nil)
	}
	out, err := s.routineDay(c.Request().Context(), auth.UserID(c), day)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load routine day", nil)
	}
	return c.JSON(http.StatusOK, out)
}

// handleCheckRoutine ticks or unticks one item on one day, returning the day.
// Idempotent both ways, so an offline outbox can replay it safely.
func (s *Server) handleCheckRoutine(c *echo.Context) error {
	ctx, uid := c.Request().Context(), auth.UserID(c)
	day := c.Param("day")
	if _, ok := routines.ParseDay(day); !ok {
		return Fail(http.StatusBadRequest, "bad_request", "day must be YYYY-MM-DD", nil)
	}
	var in struct {
		Done *bool `json:"done"`
	}
	if err := c.Bind(&in); err != nil || in.Done == nil {
		return Fail(http.StatusBadRequest, "bad_request", "done is required", nil)
	}
	id := c.Param("id")
	if _, err := s.deps.Store.GetRoutineItem(ctx, store.GetRoutineItemParams{ID: id, UserID: uid}); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Fail(http.StatusNotFound, "not_found", "routine not found", nil)
		}
		return Fail(http.StatusInternalServerError, "internal", "could not load routine", nil)
	}
	var err error
	if *in.Done {
		err = s.deps.Store.InsertRoutineCheck(ctx, store.InsertRoutineCheckParams{UserID: uid, ItemID: id, Day: day})
	} else {
		_, err = s.deps.Store.DeleteRoutineCheck(ctx, store.DeleteRoutineCheckParams{ItemID: id, Day: day, UserID: uid})
	}
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not save routine", nil)
	}
	out, err := s.routineDay(ctx, uid, day)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load routine day", nil)
	}
	return c.JSON(http.StatusOK, out)
}

type routineHistoryDTO struct {
	From           string                    `json:"from"`
	To             string                    `json:"to"`
	Days           []routines.DaySummary     `json:"days"`
	CompletionRate *float64                  `json:"completion_rate"`
	Streak         int                       `json:"streak"`
	ByStage        map[string]routines.Tally `json:"by_stage"`
}

// handleRoutineHistory scores every day in [from, to]; `to` doubles as today
// for the streak. Defaults to the 13 weeks ending today.
func (s *Server) handleRoutineHistory(c *echo.Context) error {
	ctx, uid := c.Request().Context(), auth.UserID(c)
	to, err := requestDay(c, "to")
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", err.Error(), nil)
	}
	end, _ := routines.ParseDay(to)
	from := c.QueryParam("from")
	if from == "" {
		from = routines.FormatDay(end.AddDate(0, 0, -7*13+1))
	}
	start, ok := routines.ParseDay(from)
	if !ok || start.After(end) {
		return Fail(http.StatusBadRequest, "bad_request", "from must be YYYY-MM-DD, on or before to", nil)
	}
	if end.Sub(start) > maxRoutineHistoryDays*24*time.Hour {
		return Fail(http.StatusBadRequest, "bad_request", fmt.Sprintf("history spans at most %d days", maxRoutineHistoryDays), nil)
	}
	rows, err := s.routineItems(ctx, uid, to)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load routines", nil)
	}
	checkRows, err := s.deps.Store.ListRoutineChecks(ctx, store.ListRoutineChecksParams{UserID: uid, Day: from, Day_2: to})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load routine history", nil)
	}
	items := make([]routines.Item, 0, len(rows))
	for _, r := range rows {
		items = append(items, schedItem(r))
	}
	checks := routines.Checks{}
	for _, ch := range checkRows {
		checks.Add(ch.Day, ch.ItemID)
	}
	days := routines.History(items, checks, from, to)
	return c.JSON(http.StatusOK, routineHistoryDTO{
		From: from, To: to, Days: days, CompletionRate: routines.CompletionRate(days),
		Streak: routines.Streak(days, to), ByStage: routines.ByStage(items, checks, from, to),
	})
}
