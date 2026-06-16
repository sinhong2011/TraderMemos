package api

import (
	"database/sql"
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/store"
)

func (s *Server) tradeRoutes(g *echo.Group) {
	g.GET("/trades", s.handleListTrades)
	g.GET("/trades/:id", s.handleGetTrade)
	g.PATCH("/trades/:id", s.handlePatchTrade)
	g.POST("/trades/regroup", s.handleRegroup)
}

func (s *Server) handleListTrades(c echo.Context) error {
	uid := auth.UserID(c)
	f := parseFilters(c)
	rows, err := s.loadClosedTrades(c.Request().Context(), uid, f)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not list trades", nil)
	}
	out := make([]tradeDTO, 0, len(rows))
	for _, t := range rows {
		out = append(out, toTradeDTO(t, nil))
	}
	return c.JSON(http.StatusOK, out)
}

func (s *Server) handleGetTrade(c echo.Context) error {
	ctx := c.Request().Context()
	uid := auth.UserID(c)
	t, err := s.deps.Store.GetTrade(ctx, store.GetTradeParams{ID: c.Param("id"), UserID: uid})
	if errors.Is(err, sql.ErrNoRows) {
		return Fail(http.StatusNotFound, "not_found", "trade not found", nil)
	}
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load trade", nil)
	}
	detail, err := s.buildTradeDetail(ctx, uid, t)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load trade detail", nil)
	}
	return c.JSON(http.StatusOK, detail)
}

type patchTradeReq struct {
	Notes       *string  `json:"notes"`
	SetupID     *string  `json:"setup_id"`
	InitialRisk *float64 `json:"initial_risk"`
	TagIDs      []string `json:"tag_ids"`
}

func (s *Server) handlePatchTrade(c echo.Context) error {
	ctx := c.Request().Context()
	uid := auth.UserID(c)
	id := c.Param("id")

	// Ensure the trade belongs to the user before mutating.
	t, err := s.deps.Store.GetTrade(ctx, store.GetTradeParams{ID: id, UserID: uid})
	if errors.Is(err, sql.ErrNoRows) {
		return Fail(http.StatusNotFound, "not_found", "trade not found", nil)
	}
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load trade", nil)
	}

	var in patchTradeReq
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}

	// Journal fields (notes/setup/risk) are merged with any existing journal so
	// a partial PATCH does not clobber untouched fields.
	if in.Notes != nil || in.SetupID != nil || in.InitialRisk != nil {
		cur, jerr := s.deps.Store.GetTradeJournal(ctx, store.GetTradeJournalParams{TradeID: id, UserID: uid})
		if jerr != nil && !errors.Is(jerr, sql.ErrNoRows) {
			return Fail(http.StatusInternalServerError, "internal", "could not load journal", nil)
		}
		notes := cur.Notes
		setupID := cur.SetupID
		risk := cur.InitialRisk
		if in.Notes != nil {
			notes = *in.Notes
		}
		if in.SetupID != nil {
			if *in.SetupID == "" {
				setupID = sql.NullString{}
			} else {
				if _, serr := s.deps.Store.GetSetup(ctx, store.GetSetupParams{ID: *in.SetupID, UserID: uid}); serr != nil {
					return Fail(http.StatusBadRequest, "bad_request", "unknown setup id", nil)
				}
				setupID = sql.NullString{String: *in.SetupID, Valid: true}
			}
		}
		if in.InitialRisk != nil {
			risk = sql.NullFloat64{Float64: *in.InitialRisk, Valid: true}
		}
		if err := s.deps.Store.UpsertTradeJournal(ctx, store.UpsertTradeJournalParams{
			TradeID: id, UserID: uid, Notes: notes, SetupID: setupID, InitialRisk: risk,
		}); err != nil {
			return Fail(http.StatusInternalServerError, "internal", "could not update journal", nil)
		}
	}
	if in.TagIDs != nil {
		// Only allow attaching tags the user owns (IDOR guard).
		owned, err := s.deps.Store.ListTags(ctx, uid)
		if err != nil {
			return Fail(http.StatusInternalServerError, "internal", "could not load tags", nil)
		}
		ownedSet := make(map[string]bool, len(owned))
		for _, t := range owned {
			ownedSet[t.ID] = true
		}
		for _, tagID := range in.TagIDs {
			if !ownedSet[tagID] {
				return Fail(http.StatusBadRequest, "bad_request", "unknown tag id: "+tagID, nil)
			}
		}
		if err := s.deps.Store.ClearTradeTags(ctx, id); err != nil {
			return Fail(http.StatusInternalServerError, "internal", "could not clear tags", nil)
		}
		for _, tagID := range in.TagIDs {
			if err := s.deps.Store.SetTradeTags(ctx, store.SetTradeTagsParams{TradeID: id, TagID: tagID}); err != nil {
				return Fail(http.StatusInternalServerError, "internal", "could not set tags", nil)
			}
		}
	}

	t, err = s.deps.Store.GetTrade(ctx, store.GetTradeParams{ID: id, UserID: uid})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not reload trade", nil)
	}
	detail, err := s.buildTradeDetail(ctx, uid, t)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load trade detail", nil)
	}
	return c.JSON(http.StatusOK, detail)
}

type regroupReq struct {
	AccountID string `json:"account_id"`
}

func (s *Server) handleRegroup(c echo.Context) error {
	var in regroupReq
	if err := c.Bind(&in); err != nil || in.AccountID == "" {
		return Fail(http.StatusBadRequest, "bad_request", "account_id is required", nil)
	}
	if err := s.deps.Trades.Regroup(c.Request().Context(), auth.UserID(c), in.AccountID); err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not regroup", nil)
	}
	return c.NoContent(http.StatusNoContent)
}
