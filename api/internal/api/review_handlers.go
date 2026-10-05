package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/tradermemos/api/internal/alerts"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/store"
)

const (
	defaultReviewWindowDays = 14
	maxReviewWindowDays     = 90
)

func (s *Server) reviewRoutes(g *echo.Group) {
	g.GET("/reviews/inbox", s.handleReviewInbox)
	g.POST("/reviews/dismiss-backlog", s.handleDismissReviewBacklog)
}

type reviewInboxDTO struct {
	// Unreviewed closed trades from the window, newest first.
	Items      []tradeDTO `json:"items"`
	WindowDays int        `json:"window_days"`
	// Unreviewed trades older than the window and newer than any dismissed cutoff.
	Backlog int `json:"backlog"`
}

// handleReviewInbox lists closed trades with no execution grade. A trade is
// reviewed once it has a grade; a lesson and mistake tags are optional. The
// window (default 14 days) is the queue; older ungraded trades are only counted
// as backlog, and a dismissed backlog stops counting entirely.
func (s *Server) handleReviewInbox(c *echo.Context) error {
	ctx := c.Request().Context()
	uid := auth.UserID(c)
	f, err := parseFilters(c)
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", err.Error(), nil)
	}
	window, err := reviewWindow(c.QueryParam("window_days"))
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", err.Error(), nil)
	}
	rows, err := s.loadClosedTrades(ctx, uid, f)
	if err != nil {
		return failLoad(err, "could not load trades")
	}
	journals, err := s.deps.Store.ListTradeJournalsForUser(ctx, uid)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load journals", nil)
	}
	graded := make(map[string]bool, len(journals))
	for _, j := range journals {
		if alerts.Graded(j.TradeQuality.Valid, j.TradeQuality.Int64) {
			graded[j.TradeID] = true
		}
	}
	cutoff, err := s.reviewCutoff(ctx, uid)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not read preferences", nil)
	}

	since := time.Now().UTC().AddDate(0, 0, -window)
	var queue []store.Trade
	backlog := 0
	for _, t := range rows {
		if !t.ClosedAt.Valid || graded[t.ID] {
			continue
		}
		closed := t.ClosedAt.Time
		switch {
		case !closed.Before(since):
			queue = append(queue, t)
		case cutoff == nil || !closed.Before(*cutoff):
			backlog++
		}
	}
	sort.SliceStable(queue, func(i, j int) bool { return queue[i].ClosedAt.Time.After(queue[j].ClosedAt.Time) })

	items, err := s.decorateTrades(ctx, uid, queue)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, reviewInboxDTO{Items: items, WindowDays: window, Backlog: backlog})
}

// handleDismissReviewBacklog stops counting every ungraded trade older than the
// window. Nothing is graded; the trades simply leave the backlog. Trades that
// age past the window later form a new backlog.
func (s *Server) handleDismissReviewBacklog(c *echo.Context) error {
	ctx := c.Request().Context()
	uid := auth.UserID(c)
	window, err := reviewWindow(c.QueryParam("window_days"))
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", err.Error(), nil)
	}
	cutoff := time.Now().UTC().AddDate(0, 0, -window).Truncate(time.Second)

	prefs := map[string]json.RawMessage{}
	row, err := s.deps.Store.GetUserPreferences(ctx, uid)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return Fail(http.StatusInternalServerError, "internal", "could not read preferences", nil)
	}
	if err == nil {
		_ = json.Unmarshal([]byte(row.Prefs), &prefs)
	}
	stamp, _ := json.Marshal(cutoff.Format(time.RFC3339))
	prefs[alerts.ReviewCutoffPref] = stamp
	encoded, err := json.Marshal(prefs)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not save preferences", nil)
	}
	if _, err := s.deps.Store.UpsertUserPreferences(ctx, store.UpsertUserPreferencesParams{
		UserID: uid, Prefs: string(encoded),
	}); err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not save preferences", nil)
	}
	return c.JSON(http.StatusOK, map[string]string{"cutoff": cutoff.Format(time.RFC3339)})
}

// reviewCutoff reads the dismissed-backlog cutoff, nil when never dismissed.
func (s *Server) reviewCutoff(ctx context.Context, uid string) (*time.Time, error) {
	row, err := s.deps.Store.GetUserPreferences(ctx, uid)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return alerts.ReviewCutoff(row.Prefs), nil
}

func reviewWindow(raw string) (int, error) {
	if raw == "" {
		return defaultReviewWindowDays, nil
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n < 1 || n > maxReviewWindowDays {
		return 0, errors.New("window_days must be 1–90")
	}
	return n, nil
}
