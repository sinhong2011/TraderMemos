package api

import (
	"net/http"
	"sort"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/tradermemos/api/internal/alerts"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/store"
)

func (s *Server) focusRoutes(g *echo.Group) {
	g.GET("/focus/current", s.handleCurrentFocus)
	g.GET("/focus/history", s.handleFocusHistory)
}

type focusDTO struct {
	// Monday (market timezone) of the week the focus applies to.
	WeekStart string   `json:"week_start"`
	Items     []string `json:"items"`
	// The weekly review that set it; empty when there is none.
	NoteID    string `json:"note_id"`
	NoteTitle string `json:"note_title"`
}

// handleCurrentFocus returns this week's focus: the bullets under "Focus for
// next week" in the latest weekly review written before this week began. The
// week follows the market timezone, the same clock that dates the reviews.
func (s *Server) handleCurrentFocus(c *echo.Context) error {
	ctx := c.Request().Context()
	uid := auth.UserID(c)
	loc := alerts.MarketLocation(ctx, s.deps.Store, uid)
	start, _ := alerts.ReviewWeek(time.Now(), loc)

	items, note, err := alerts.PreviousFocus(ctx, s.deps.Store, uid, start)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load the weekly review", nil)
	}
	out := focusDTO{WeekStart: alerts.WeekKey(start), Items: []string{}}
	if len(items) > 0 {
		out.Items = items
	}
	if note != nil {
		out.NoteID, out.NoteTitle = note.ID, note.Title
	}
	return c.JSON(http.StatusOK, out)
}

type focusWeekDTO struct {
	// Monday of the week the focus was held, the week the review covers.
	WeekStart string                `json:"week_start"`
	Items     []alerts.FocusOutcome `json:"items"`
	NoteID    string                `json:"note_id"`
	NoteTitle string                `json:"note_title"`
}

type focusHistoryDTO struct {
	// Scored weeks, newest first.
	Weeks      []focusWeekDTO `json:"weeks"`
	ItemsTotal int            `json:"items_total"`
	ItemsKept  int            `json:"items_kept"`
	// Weeks where every item was ticked.
	WeeksAllKept int `json:"weeks_all_kept"`
}

// handleFocusHistory scores past focus: each weekly review's "Last week's
// focus" checklist, ticked or not, for the reviews dated in the Reports
// from/to range — every review when there is none. A review without that
// checklist — no focus was set, or it was written by hand without one — is
// not a scored week.
func (s *Server) handleFocusHistory(c *echo.Context) error {
	ctx := c.Request().Context()
	uid := auth.UserID(c)
	f, err := parseFilters(c)
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", err.Error(), nil)
	}
	loc := alerts.MarketLocation(ctx, s.deps.Store, uid)
	params := store.ListJournalNotesParams{UserID: uid}
	if f.From != nil {
		params.FromDate = f.From.In(loc).Format("2006-01-02")
	}
	if f.To != nil {
		params.ToDate = f.To.In(loc).Format("2006-01-02")
	}
	notes, err := s.deps.Store.ListJournalNotes(ctx, params)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load weekly reviews", nil)
	}

	out := focusHistoryDTO{Weeks: []focusWeekDTO{}}
	seen := map[string]bool{}
	// Newest first: when a week has two reviews, the later one scores it.
	for _, n := range notes {
		if n.NoteType != alerts.NoteTypeWeeklyReview {
			continue
		}
		items := alerts.ParseFocusOutcomes(n.Body)
		if len(items) == 0 {
			continue
		}
		day, perr := time.ParseInLocation("2006-01-02", n.OccurredAt, loc)
		if perr != nil {
			continue
		}
		week, _ := alerts.ReviewWeek(day, loc)
		key := alerts.WeekKey(week)
		if seen[key] {
			continue
		}
		seen[key] = true
		kept := 0
		for _, it := range items {
			if it.Kept {
				kept++
			}
		}
		out.ItemsTotal += len(items)
		out.ItemsKept += kept
		if kept == len(items) {
			out.WeeksAllKept++
		}
		out.Weeks = append(out.Weeks, focusWeekDTO{
			WeekStart: key, Items: items, NoteID: n.ID, NoteTitle: n.Title,
		})
	}
	sort.SliceStable(out.Weeks, func(i, j int) bool { return out.Weeks[i].WeekStart > out.Weeks[j].WeekStart })
	return c.JSON(http.StatusOK, out)
}
