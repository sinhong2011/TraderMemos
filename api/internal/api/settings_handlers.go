package api

import (
	"database/sql"
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/store"
)

func (s *Server) settingsRoutes(g *echo.Group) {
	g.GET("/settings/risk-rules", s.handleGetRiskRules)
	g.PUT("/settings/risk-rules", s.handlePutRiskRules)
	g.GET("/settings/ocr", s.handleGetOcrSettings)
	g.PUT("/settings/ocr", s.handlePutOcrSettings)
	g.POST("/settings/ocr/test", s.handleTestOcrSettings)
	g.POST("/settings/ocr/models", s.handleListOcrModels)
}

type riskRulesDTO struct {
	MaxRiskPerTrade      *float64 `json:"max_risk_per_trade"`
	MaxDailyLoss         *float64 `json:"max_daily_loss"`
	MaxOpenRisk          *float64 `json:"max_open_risk"`
	DefaultAccountRiskPct *float64 `json:"default_account_risk_pct"`
}

func toRiskRulesDTO(r store.RiskRule) riskRulesDTO {
	return riskRulesDTO{
		MaxRiskPerTrade:       fptr(r.MaxRiskPerTrade),
		MaxDailyLoss:          fptr(r.MaxDailyLoss),
		MaxOpenRisk:           fptr(r.MaxOpenRisk),
		DefaultAccountRiskPct: fptr(r.DefaultAccountRiskPct),
	}
}

func (s *Server) handleGetRiskRules(c echo.Context) error {
	uid := auth.UserID(c)
	r, err := s.deps.Store.GetRiskRules(c.Request().Context(), uid)
	if errors.Is(err, sql.ErrNoRows) {
		return c.JSON(http.StatusOK, riskRulesDTO{})
	}
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load risk rules", nil)
	}
	return c.JSON(http.StatusOK, toRiskRulesDTO(r))
}

func (s *Server) handlePutRiskRules(c echo.Context) error {
	uid := auth.UserID(c)
	var in riskRulesDTO
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}
	if err := validateRiskRules(in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", err.Error(), nil)
	}
	r, err := s.deps.Store.UpsertRiskRules(c.Request().Context(), store.UpsertRiskRulesParams{
		UserID:                uid,
		MaxRiskPerTrade:       nullF(in.MaxRiskPerTrade),
		MaxDailyLoss:          nullF(in.MaxDailyLoss),
		MaxOpenRisk:           nullF(in.MaxOpenRisk),
		DefaultAccountRiskPct: nullF(in.DefaultAccountRiskPct),
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not save risk rules", nil)
	}
	return c.JSON(http.StatusOK, toRiskRulesDTO(r))
}

func nullF(p *float64) sql.NullFloat64 {
	if p == nil {
		return sql.NullFloat64{}
	}
	return sql.NullFloat64{Float64: *p, Valid: true}
}

func validateRiskRules(in riskRulesDTO) error {
	check := func(name string, p *float64) error {
		if p != nil && *p < 0 {
			return errors.New(name + " must be >= 0")
		}
		return nil
	}
	if err := check("max_risk_per_trade", in.MaxRiskPerTrade); err != nil {
		return err
	}
	if err := check("max_daily_loss", in.MaxDailyLoss); err != nil {
		return err
	}
	if err := check("max_open_risk", in.MaxOpenRisk); err != nil {
		return err
	}
	if in.DefaultAccountRiskPct != nil && (*in.DefaultAccountRiskPct < 0 || *in.DefaultAccountRiskPct > 100) {
		return errors.New("default_account_risk_pct must be between 0 and 100")
	}
	return nil
}
