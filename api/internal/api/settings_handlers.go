package api

import (
	"database/sql"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/store"
)

func (s *Server) settingsRoutes(g *echo.Group) {
	g.GET("/settings/risk-rules", s.handleGetRiskRules)
	g.PUT("/settings/risk-rules", s.handlePutRiskRules)
	g.GET("/settings/annual-goal", s.handleGetAnnualGoal)
	g.PUT("/settings/annual-goal", s.handlePutAnnualGoal)
	g.DELETE("/settings/annual-goal", s.handleDeleteAnnualGoal)
	g.GET("/settings/ocr", s.handleGetOcrSettings)
	g.PUT("/settings/ocr", s.handlePutOcrSettings)
	g.POST("/settings/ocr/test", s.handleTestOcrSettings)
	g.POST("/settings/ocr/models", s.handleListOcrModels)
	g.GET("/settings/coach", s.handleGetCoachSettings)
	g.PUT("/settings/coach", s.handlePutCoachSettings)
	g.POST("/settings/coach/test", s.handleTestCoachSettings)
	g.POST("/settings/coach/models", s.handleListCoachModels)
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

type annualGoalDTO struct {
	Year   int      `json:"year"`
	Amount *float64 `json:"amount"`
}

func toAnnualGoalDTO(g store.AnnualGoal) annualGoalDTO {
	amount := g.Amount
	return annualGoalDTO{Year: int(g.Year), Amount: &amount}
}

func parseGoalYear(c echo.Context) (int64, error) {
	raw := c.QueryParam("year")
	if raw == "" {
		return int64(time.Now().UTC().Year()), nil
	}
	y, err := strconv.Atoi(raw)
	if err != nil {
		return 0, errors.New("year must be an integer")
	}
	if y < 2000 || y > 2100 {
		return 0, errors.New("year must be between 2000 and 2100")
	}
	return int64(y), nil
}

func (s *Server) handleGetAnnualGoal(c echo.Context) error {
	uid := auth.UserID(c)
	year, err := parseGoalYear(c)
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", err.Error(), nil)
	}
	g, err := s.deps.Store.GetAnnualGoal(c.Request().Context(), store.GetAnnualGoalParams{
		UserID: uid,
		Year:   year,
	})
	if errors.Is(err, sql.ErrNoRows) {
		return c.JSON(http.StatusOK, annualGoalDTO{Year: int(year), Amount: nil})
	}
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load annual goal", nil)
	}
	return c.JSON(http.StatusOK, toAnnualGoalDTO(g))
}

func (s *Server) handlePutAnnualGoal(c echo.Context) error {
	uid := auth.UserID(c)
	var in struct {
		Year   int      `json:"year"`
		Amount *float64 `json:"amount"`
	}
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}
	if in.Year == 0 {
		in.Year = time.Now().UTC().Year()
	}
	if in.Year < 2000 || in.Year > 2100 {
		return Fail(http.StatusBadRequest, "bad_request", "year must be between 2000 and 2100", nil)
	}
	if in.Amount == nil {
		return Fail(http.StatusBadRequest, "bad_request", "amount is required", nil)
	}
	if *in.Amount <= 0 {
		return Fail(http.StatusBadRequest, "bad_request", "amount must be > 0", nil)
	}
	g, err := s.deps.Store.UpsertAnnualGoal(c.Request().Context(), store.UpsertAnnualGoalParams{
		UserID: uid,
		Year:   int64(in.Year),
		Amount: *in.Amount,
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not save annual goal", nil)
	}
	return c.JSON(http.StatusOK, toAnnualGoalDTO(g))
}

func (s *Server) handleDeleteAnnualGoal(c echo.Context) error {
	uid := auth.UserID(c)
	year, err := parseGoalYear(c)
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", err.Error(), nil)
	}
	_, err = s.deps.Store.DeleteAnnualGoal(c.Request().Context(), store.DeleteAnnualGoalParams{
		UserID: uid,
		Year:   year,
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not clear annual goal", nil)
	}
	return c.JSON(http.StatusOK, annualGoalDTO{Year: int(year), Amount: nil})
}
