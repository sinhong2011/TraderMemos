package api

import (
	"context"
	"fmt"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tradermemos/api/internal/analytics"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/store"
)

var breakdownDims = map[string]bool{
	"symbol": true, "setup": true, "day_of_week": true, "hour_of_day": true, "tag": true,
}

func (s *Server) handleBreakdown(c echo.Context) error {
	ctx := c.Request().Context()
	uid := auth.UserID(c)
	by := c.QueryParam("by")
	if !breakdownDims[by] {
		return Fail(http.StatusBadRequest, "bad_request", "by must be one of symbol|setup|day_of_week|hour_of_day|tag", nil)
	}
	f, err := parseFilters(c)
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", err.Error(), nil)
	}
	rows, err := s.loadClosedTrades(ctx, uid, f)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load trades", nil)
	}

	groups := map[string][]analytics.ClosedTrade{}
	add := func(key string, ct analytics.ClosedTrade) { groups[key] = append(groups[key], ct) }

	for _, t := range rows {
		if !t.NetPnl.Valid || !t.ClosedAt.Valid {
			continue
		}
		ct := analytics.ClosedTrade{NetPnl: t.NetPnl.Float64, FeesTotal: t.FeesTotal, ClosedAt: t.ClosedAt.Time}
		switch by {
		case "symbol":
			add(t.Symbol, ct)
		case "day_of_week":
			add(t.ClosedAt.Time.UTC().Weekday().String(), ct)
		case "hour_of_day":
			add(fmt.Sprintf("%02d:00", t.ClosedAt.Time.UTC().Hour()), ct)
		case "setup":
			add(s.setupKey(ctx, uid, t.ID), ct)
		case "tag":
			names := s.tradeTagNames(ctx, t.ID)
			if len(names) == 0 {
				add("(untagged)", ct)
			}
			for _, n := range names {
				add(n, ct)
			}
		}
	}
	return c.JSON(http.StatusOK, analytics.Breakdown(groups))
}

func (s *Server) setupKey(ctx context.Context, userID, tradeID string) string {
	j, err := s.deps.Store.GetTradeJournal(ctx, store.GetTradeJournalParams{TradeID: tradeID, UserID: userID})
	if err != nil || !j.SetupID.Valid {
		return "(none)"
	}
	setup, err := s.deps.Store.GetSetup(ctx, store.GetSetupParams{ID: j.SetupID.String, UserID: userID})
	if err != nil {
		return "(none)"
	}
	return setup.Name
}

func (s *Server) tradeTagNames(ctx context.Context, tradeID string) []string {
	tags, err := s.deps.Store.ListTagsForTrade(ctx, tradeID)
	if err != nil {
		return nil
	}
	names := make([]string, 0, len(tags))
	for _, t := range tags {
		names = append(names, t.Name)
	}
	return names
}
