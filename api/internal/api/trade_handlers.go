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
	tags, err := s.deps.Store.ListTagsForTrade(ctx, t.ID)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load tags", nil)
	}
	return c.JSON(http.StatusOK, toTradeDTO(t, tags))
}

type patchTradeReq struct {
	Notes  *string  `json:"notes"`
	TagIDs []string `json:"tag_ids"`
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
	if in.Notes != nil {
		if err := s.deps.Store.UpdateTradeNotes(ctx, store.UpdateTradeNotesParams{
			Notes: *in.Notes, ID: id, UserID: uid,
		}); err != nil {
			return Fail(http.StatusInternalServerError, "internal", "could not update notes", nil)
		}
	}
	if in.TagIDs != nil {
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
	tags, _ := s.deps.Store.ListTagsForTrade(ctx, id)
	return c.JSON(http.StatusOK, toTradeDTO(t, tags))
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
