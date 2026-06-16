package api

import (
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/importer"
	"github.com/tradermemos/api/internal/store"
)

func (s *Server) executionRoutes(g *echo.Group) {
	g.POST("/executions", s.handleCreateExecution)
	g.GET("/executions", s.handleListExecutions)
}

type createExecutionReq struct {
	AccountID      string    `json:"account_id"`
	Symbol         string    `json:"symbol"`
	InstrumentType string    `json:"instrument_type"`
	Side           string    `json:"side"`
	Quantity       float64   `json:"quantity"`
	Price          float64   `json:"price"`
	Fees           float64   `json:"fees"`
	Commission     float64   `json:"commission"`
	ExecutedAt     time.Time `json:"executed_at"`
	Multiplier     float64   `json:"multiplier"`
}

func (s *Server) handleCreateExecution(c echo.Context) error {
	uid := auth.UserID(c)
	var in createExecutionReq
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}
	if in.AccountID == "" || in.Symbol == "" || (in.Side != "buy" && in.Side != "sell") {
		return Fail(http.StatusBadRequest, "bad_request", "account_id, symbol, and side(buy|sell) required", nil)
	}
	if in.Multiplier == 0 {
		in.Multiplier = 1
	}
	if in.InstrumentType == "" {
		in.InstrumentType = "stock"
	}
	hash := importer.DedupHash(in.Symbol, in.Side, in.Quantity, in.Price, in.ExecutedAt)
	_, err := s.deps.Store.InsertExecution(c.Request().Context(), store.InsertExecutionParams{
		ID: uuid.NewString(), UserID: uid, AccountID: in.AccountID,
		Symbol: in.Symbol, InstrumentType: in.InstrumentType, Side: in.Side,
		Quantity: in.Quantity, Price: in.Price, Fees: in.Fees, Commission: in.Commission,
		ExecutedAt: in.ExecutedAt, Multiplier: in.Multiplier, DedupHash: hash,
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not insert execution", nil)
	}
	if err := s.deps.Trades.Regroup(c.Request().Context(), uid, in.AccountID); err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not regroup trades", nil)
	}
	return c.NoContent(http.StatusCreated)
}

func (s *Server) handleListExecutions(c echo.Context) error {
	accountID := c.QueryParam("account_id")
	if accountID == "" {
		return Fail(http.StatusBadRequest, "bad_request", "account_id is required", nil)
	}
	rows, err := s.deps.Store.ListExecutionsForAccount(c.Request().Context(), store.ListExecutionsForAccountParams{
		UserID: auth.UserID(c), AccountID: accountID,
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not list executions", nil)
	}
	if rows == nil {
		rows = []store.Execution{}
	}
	return c.JSON(http.StatusOK, rows)
}
