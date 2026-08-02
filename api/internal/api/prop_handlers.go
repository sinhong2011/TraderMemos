package api

import (
	"database/sql"
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/prop"
	"github.com/tradermemos/api/internal/store"
)

func (s *Server) propRoutes(g *echo.Group) {
	g.GET("/accounts/:id/prop-settings", s.handleGetPropSettings)
	g.PUT("/accounts/:id/prop-settings", s.handlePutPropSettings)
	g.DELETE("/accounts/:id/prop-settings", s.handleDeletePropSettings)
	g.GET("/accounts/:id/prop-status", s.handlePropStatus)
}

type propSettingsDTO struct {
	ProfitTarget   *float64 `json:"profit_target"`
	MaxDrawdown    *float64 `json:"max_drawdown"`
	DrawdownMode   string   `json:"drawdown_mode"`
	DailyLossLimit *float64 `json:"daily_loss_limit"`
	ConsistencyPct *float64 `json:"consistency_pct"`
}

func toPropSettingsDTO(r store.PropSetting) propSettingsDTO {
	mode := r.DrawdownMode
	if mode == "" {
		mode = "trailing"
	}
	return propSettingsDTO{
		ProfitTarget:   fptr(r.ProfitTarget),
		MaxDrawdown:    fptr(r.MaxDrawdown),
		DrawdownMode:   mode,
		DailyLossLimit: fptr(r.DailyLossLimit),
		ConsistencyPct: fptr(r.ConsistencyPct),
	}
}

func (s *Server) ownAccount(c echo.Context) (store.Account, error) {
	acct, err := s.deps.Store.GetAccount(c.Request().Context(), store.GetAccountParams{
		ID: c.Param("id"), UserID: auth.UserID(c),
	})
	if errors.Is(err, sql.ErrNoRows) {
		return store.Account{}, Fail(http.StatusNotFound, "not_found", "account not found", nil)
	}
	if err != nil {
		return store.Account{}, Fail(http.StatusInternalServerError, "internal", "could not load account", nil)
	}
	return acct, nil
}

func (s *Server) handleGetPropSettings(c echo.Context) error {
	acct, err := s.ownAccount(c)
	if err != nil {
		return err
	}
	r, gerr := s.deps.Store.GetPropSettings(c.Request().Context(), store.GetPropSettingsParams{
		AccountID: acct.ID, UserID: auth.UserID(c),
	})
	if errors.Is(gerr, sql.ErrNoRows) {
		return c.JSON(http.StatusOK, propSettingsDTO{DrawdownMode: "trailing"})
	}
	if gerr != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load prop settings", nil)
	}
	return c.JSON(http.StatusOK, toPropSettingsDTO(r))
}

func (s *Server) handlePutPropSettings(c echo.Context) error {
	acct, err := s.ownAccount(c)
	if err != nil {
		return err
	}
	var in propSettingsDTO
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}
	switch in.DrawdownMode {
	case "", "trailing":
		in.DrawdownMode = "trailing"
	case "eod", "static":
	default:
		return Fail(http.StatusBadRequest, "bad_request", "drawdown_mode must be trailing, eod, or static", nil)
	}
	for _, v := range []*float64{in.ProfitTarget, in.MaxDrawdown, in.DailyLossLimit} {
		if v != nil && *v < 0 {
			return Fail(http.StatusBadRequest, "bad_request", "amounts must be positive", nil)
		}
	}
	if in.ConsistencyPct != nil && (*in.ConsistencyPct <= 0 || *in.ConsistencyPct > 1) {
		return Fail(http.StatusBadRequest, "bad_request", "consistency_pct must be between 0 and 1", nil)
	}
	r, uerr := s.deps.Store.UpsertPropSettings(c.Request().Context(), store.UpsertPropSettingsParams{
		AccountID: acct.ID, UserID: auth.UserID(c),
		ProfitTarget:   nullF(in.ProfitTarget),
		MaxDrawdown:    nullF(in.MaxDrawdown),
		DrawdownMode:   in.DrawdownMode,
		DailyLossLimit: nullF(in.DailyLossLimit),
		ConsistencyPct: nullF(in.ConsistencyPct),
	})
	if uerr != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not save prop settings", nil)
	}
	return c.JSON(http.StatusOK, toPropSettingsDTO(r))
}

func (s *Server) handleDeletePropSettings(c echo.Context) error {
	acct, err := s.ownAccount(c)
	if err != nil {
		return err
	}
	if err := s.deps.Store.DeletePropSettings(c.Request().Context(), store.DeletePropSettingsParams{
		AccountID: acct.ID, UserID: auth.UserID(c),
	}); err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not delete prop settings", nil)
	}
	return c.NoContent(http.StatusNoContent)
}

// handlePropStatus evaluates the account against its prop program rules.
func (s *Server) handlePropStatus(c echo.Context) error {
	ctx := c.Request().Context()
	uid := auth.UserID(c)
	acct, err := s.ownAccount(c)
	if err != nil {
		return err
	}
	f, ferr := parseFilters(c)
	if ferr != nil {
		return Fail(http.StatusBadRequest, "bad_request", ferr.Error(), nil)
	}

	row, gerr := s.deps.Store.GetPropSettings(ctx, store.GetPropSettingsParams{AccountID: acct.ID, UserID: uid})
	if errors.Is(gerr, sql.ErrNoRows) {
		return c.JSON(http.StatusOK, map[string]any{"configured": false})
	}
	if gerr != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load prop settings", nil)
	}
	settings := prop.Settings{DrawdownMode: row.DrawdownMode}
	if row.ProfitTarget.Valid {
		settings.ProfitTarget = row.ProfitTarget.Float64
	}
	if row.MaxDrawdown.Valid {
		settings.MaxDrawdown = row.MaxDrawdown.Float64
	}
	if row.DailyLossLimit.Valid {
		settings.DailyLossLimit = row.DailyLossLimit.Float64
	}
	if row.ConsistencyPct.Valid {
		settings.ConsistencyPct = row.ConsistencyPct.Float64
	}

	trades, terr := s.loadClosedTrades(ctx, uid, Filters{AccountID: acct.ID})
	if terr != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load trades", nil)
	}
	cash, cerr := s.deps.Store.ListCashTransactions(ctx, store.ListCashTransactionsParams{
		UserID: uid, AccountID: accountArg(acct.ID),
	})
	if cerr != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load cash flows", nil)
	}

	events := make([]prop.Event, 0, len(trades)+len(cash))
	for _, t := range trades {
		if !t.NetPnl.Valid || !t.ClosedAt.Valid {
			continue
		}
		events = append(events, prop.Event{At: t.ClosedAt.Time, Amount: t.NetPnl.Float64, Trade: true})
	}
	for _, tx := range cash {
		events = append(events, prop.Event{At: tx.OccurredAt, Amount: tx.Amount})
	}

	st := prop.Compute(acct.StartingBalance, events, settings, f.Loc)
	return c.JSON(http.StatusOK, map[string]any{
		"configured": true,
		"settings":   toPropSettingsDTO(row),
		"status":     st,
	})
}
