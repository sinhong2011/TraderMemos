package api

import (
	"context"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v5"
	"github.com/tradermemos/api/internal/analytics"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/store"
)

var breakdownDims = map[string]bool{
	"symbol": true, "setup": true, "day_of_week": true, "hour_of_day": true,
	"session": true, "tag": true, "mistake": true, "trade_quality": true,
}

func (s *Server) handleBreakdown(c *echo.Context) error {
	ctx := c.Request().Context()
	uid := auth.UserID(c)
	by := c.QueryParam("by")
	if !breakdownDims[by] {
		return Fail(http.StatusBadRequest, "bad_request", "by must be one of symbol|setup|day_of_week|hour_of_day|session|tag|mistake|trade_quality", nil)
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
		ct := analytics.ClosedTrade{
			NetPnl: t.NetPnl.Float64, GrossPnl: grossPnlOf(t),
			FeesTotal: t.FeesTotal, ClosedAt: t.ClosedAt.Time,
		}
		// Day-trader leak analysis uses entry (opened_at), not close.
		at := t.OpenedAt
		switch by {
		case "symbol":
			add(t.Symbol, ct)
		case "day_of_week":
			add(analytics.WeekdayName(at, f.Loc), ct)
		case "hour_of_day":
			add(analytics.HourBucket(at, f.Loc), ct)
		case "session":
			add(analytics.SessionName(at), ct)
		case "setup":
			add(s.setupKey(ctx, uid, t.ID), ct)
		case "trade_quality":
			add(s.qualityKey(ctx, uid, t.ID), ct)
		case "tag":
			names := s.tradeTagNames(ctx, t.ID, "")
			if len(names) == 0 {
				add("(untagged)", ct)
			}
			for _, n := range names {
				add(n, ct)
			}
		case "mistake":
			names := s.tradeTagNames(ctx, t.ID, "mistake")
			if len(names) == 0 {
				add("(none)", ct)
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

func (s *Server) qualityKey(ctx context.Context, userID, tradeID string) string {
	j, err := s.deps.Store.GetTradeJournal(ctx, store.GetTradeJournalParams{TradeID: tradeID, UserID: userID})
	if err != nil || !j.TradeQuality.Valid {
		return "unrated"
	}
	return strconv.FormatInt(j.TradeQuality.Int64, 10)
}

func (s *Server) tradeTagNames(ctx context.Context, tradeID, kind string) []string {
	tags, err := s.deps.Store.ListTagsForTrade(ctx, tradeID)
	if err != nil {
		return nil
	}
	names := make([]string, 0, len(tags))
	for _, t := range tags {
		if kind != "" && t.Kind != kind {
			continue
		}
		names = append(names, t.Name)
	}
	return names
}
