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
	g.POST("/trades/:id/coach", s.handleTradeCoach)
	g.PATCH("/trades/:id", s.handlePatchTrade)
	g.DELETE("/trades/:id", s.handleDeleteTrade)
	g.POST("/trades/regroup", s.handleRegroup)
}

func (s *Server) handleListTrades(c echo.Context) error {
	uid := auth.UserID(c)
	ctx := c.Request().Context()
	f, err := parseFilters(c)
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", err.Error(), nil)
	}
	rows, err := s.loadTrades(ctx, uid, f)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not list trades", nil)
	}
	risks, err := s.deps.Store.ListJournalRisks(ctx, uid)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load risk", nil)
	}
	riskByTrade := make(map[string]float64, len(risks))
	for _, r := range risks {
		if r.InitialRisk.Valid {
			riskByTrade[r.TradeID] = r.InitialRisk.Float64
		}
	}
	tagRows, err := s.deps.Store.ListTradeTagsForUser(ctx, uid)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load tags", nil)
	}
	tagsByTrade := make(map[string][]store.Tag)
	for _, r := range tagRows {
		tagsByTrade[r.TradeID] = append(tagsByTrade[r.TradeID], store.Tag{
			ID: r.ID, UserID: r.UserID, Name: r.Name, Color: r.Color,
			Description: r.Description, Kind: r.Kind,
		})
	}
	out := make([]tradeDTO, 0, len(rows))
	for _, t := range rows {
		dto := toTradeDTO(t, tagsByTrade[t.ID])
		if risk, ok := riskByTrade[t.ID]; ok {
			dto.InitialRisk = &risk
		}
		out = append(out, dto)
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
	Notes          *string  `json:"notes"`
	SetupID        *string  `json:"setup_id"`
	SetupIDs       []string `json:"setup_ids"`
	InitialRisk    *float64 `json:"initial_risk"`
	TargetPrice    *float64 `json:"target_price"`
	StopPrice      *float64 `json:"stop_price"`
	EmotionalState *string  `json:"emotional_state"`
	Confidence     *int64   `json:"confidence"`
	TradeQuality   *int64   `json:"trade_quality"`
	Mae            *float64 `json:"mae"`
	Mfe            *float64 `json:"mfe"`
	TagIDs         []string `json:"tag_ids"`
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

	// Journal fields are merged with any existing journal so a partial PATCH
	// does not clobber untouched fields.
	journalTouched := in.Notes != nil || in.SetupID != nil || in.SetupIDs != nil ||
		in.InitialRisk != nil || in.TargetPrice != nil || in.StopPrice != nil ||
		in.EmotionalState != nil || in.Confidence != nil || in.TradeQuality != nil ||
		in.Mae != nil || in.Mfe != nil
	if journalTouched {
		cur, jerr := s.deps.Store.GetTradeJournal(ctx, store.GetTradeJournalParams{TradeID: id, UserID: uid})
		if jerr != nil && !errors.Is(jerr, sql.ErrNoRows) {
			return Fail(http.StatusInternalServerError, "internal", "could not load journal", nil)
		}
		notes := cur.Notes
		setupID := cur.SetupID
		risk := cur.InitialRisk
		target := cur.TargetPrice
		stop := cur.StopPrice
		emotion := cur.EmotionalState
		confidence := cur.Confidence
		quality := cur.TradeQuality
		mae := cur.Mae
		mfe := cur.Mfe
		if in.Notes != nil {
			notes = *in.Notes
		}
		if in.SetupIDs != nil {
			owned, err := s.deps.Store.ListSetups(ctx, uid)
			if err != nil {
				return Fail(http.StatusInternalServerError, "internal", "could not load setups", nil)
			}
			ownedSet := make(map[string]bool, len(owned))
			for _, st := range owned {
				ownedSet[st.ID] = true
			}
			seen := make(map[string]bool, len(in.SetupIDs))
			unique := make([]string, 0, len(in.SetupIDs))
			for _, sid := range in.SetupIDs {
				if sid == "" {
					continue
				}
				if !ownedSet[sid] {
					return Fail(http.StatusBadRequest, "bad_request", "unknown setup id: "+sid, nil)
				}
				if seen[sid] {
					continue
				}
				seen[sid] = true
				unique = append(unique, sid)
			}
			main := ""
			if in.SetupID != nil {
				main = *in.SetupID
			} else if len(unique) > 0 {
				main = unique[0]
			}
			if main != "" && !ownedSet[main] {
				return Fail(http.StatusBadRequest, "bad_request", "unknown setup id", nil)
			}
			if main == "" {
				setupID = sql.NullString{}
			} else {
				setupID = sql.NullString{String: main, Valid: true}
				if !seen[main] {
					unique = append([]string{main}, unique...)
				} else if unique[0] != main {
					rest := make([]string, 0, len(unique)-1)
					for _, sid := range unique {
						if sid != main {
							rest = append(rest, sid)
						}
					}
					unique = append([]string{main}, rest...)
				}
			}
			if err := s.deps.Store.ClearTradeSetups(ctx, id); err != nil {
				return Fail(http.StatusInternalServerError, "internal", "could not clear setups", nil)
			}
			for _, sid := range unique {
				if err := s.deps.Store.SetTradeSetup(ctx, store.SetTradeSetupParams{TradeID: id, SetupID: sid}); err != nil {
					return Fail(http.StatusInternalServerError, "internal", "could not set setups", nil)
				}
			}
		} else if in.SetupID != nil {
			if *in.SetupID == "" {
				setupID = sql.NullString{}
				if err := s.deps.Store.ClearTradeSetups(ctx, id); err != nil {
					return Fail(http.StatusInternalServerError, "internal", "could not clear setups", nil)
				}
			} else {
				if _, serr := s.deps.Store.GetSetup(ctx, store.GetSetupParams{ID: *in.SetupID, UserID: uid}); serr != nil {
					return Fail(http.StatusBadRequest, "bad_request", "unknown setup id", nil)
				}
				setupID = sql.NullString{String: *in.SetupID, Valid: true}
				if err := s.deps.Store.ClearTradeSetups(ctx, id); err != nil {
					return Fail(http.StatusInternalServerError, "internal", "could not clear setups", nil)
				}
				if err := s.deps.Store.SetTradeSetup(ctx, store.SetTradeSetupParams{TradeID: id, SetupID: *in.SetupID}); err != nil {
					return Fail(http.StatusInternalServerError, "internal", "could not set setups", nil)
				}
			}
		}
		if in.InitialRisk != nil {
			risk = sql.NullFloat64{Float64: *in.InitialRisk, Valid: true}
		}
		if in.TargetPrice != nil {
			target = sql.NullFloat64{Float64: *in.TargetPrice, Valid: true}
		}
		if in.StopPrice != nil {
			stop = sql.NullFloat64{Float64: *in.StopPrice, Valid: true}
		}
		if in.EmotionalState != nil {
			emotion = *in.EmotionalState
		}
		if in.Confidence != nil {
			if *in.Confidence == 0 {
				confidence = sql.NullInt64{}
			} else {
				confidence = sql.NullInt64{Int64: *in.Confidence, Valid: true}
			}
		}
		if in.TradeQuality != nil {
			if *in.TradeQuality == 0 {
				quality = sql.NullInt64{}
			} else {
				quality = sql.NullInt64{Int64: *in.TradeQuality, Valid: true}
			}
		}
		if in.Mae != nil {
			mae = sql.NullFloat64{Float64: *in.Mae, Valid: true}
		}
		if in.Mfe != nil {
			mfe = sql.NullFloat64{Float64: *in.Mfe, Valid: true}
		}
		if err := s.deps.Store.UpsertTradeJournal(ctx, store.UpsertTradeJournalParams{
			TradeID: id, UserID: uid, Notes: notes, SetupID: setupID, InitialRisk: risk,
			TargetPrice: target, StopPrice: stop,
			EmotionalState: emotion, Confidence: confidence, TradeQuality: quality,
			Mae: mae, Mfe: mfe,
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

func (s *Server) handleDeleteTrade(c echo.Context) error {
	ctx := c.Request().Context()
	uid := auth.UserID(c)
	id := c.Param("id")

	t, err := s.deps.Store.GetTrade(ctx, store.GetTradeParams{ID: id, UserID: uid})
	if errors.Is(err, sql.ErrNoRows) {
		return Fail(http.StatusNotFound, "not_found", "trade not found", nil)
	}
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load trade", nil)
	}

	// Remove fills first so executions do not linger after the trade row is gone.
	if err := s.deps.Store.DeleteExecutionsForTrade(ctx, store.DeleteExecutionsForTradeParams{
		UserID: uid, TradeID: t.ID,
	}); err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not delete executions", nil)
	}

	n, err := s.deps.Store.DeleteTrade(ctx, store.DeleteTradeParams{ID: t.ID, UserID: uid})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not delete trade", nil)
	}
	if n == 0 {
		return Fail(http.StatusNotFound, "not_found", "trade not found", nil)
	}

	return c.NoContent(http.StatusNoContent)
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
