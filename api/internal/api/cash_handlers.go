package api

import (
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/store"
)

var validCashTypes = map[string]bool{
	"deposit": true, "withdrawal": true, "fee": true,
	"dividend": true, "interest": true, "adjustment": true,
}

func (s *Server) cashRoutes(g *echo.Group) {
	g.POST("/cash-transactions", s.handleCreateCash)
	g.GET("/cash-transactions", s.handleListCash)
	g.DELETE("/cash-transactions/:id", s.handleDeleteCash)
}

type createCashReq struct {
	AccountID  string    `json:"account_id"`
	Type       string    `json:"type"`
	Amount     float64   `json:"amount"`
	Currency   string    `json:"currency"`
	OccurredAt time.Time `json:"occurred_at"`
	Note       string    `json:"note"`
}

func (s *Server) handleCreateCash(c echo.Context) error {
	var in createCashReq
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}
	if in.AccountID == "" || !validCashTypes[in.Type] {
		return Fail(http.StatusBadRequest, "bad_request", "account_id and a valid type are required", nil)
	}
	if in.Currency == "" {
		in.Currency = "USD"
	}
	tx, err := s.deps.Store.InsertCashTransaction(c.Request().Context(), store.InsertCashTransactionParams{
		ID: uuid.NewString(), UserID: auth.UserID(c), AccountID: in.AccountID,
		Type: in.Type, Amount: in.Amount, Currency: in.Currency,
		OccurredAt: in.OccurredAt, Note: in.Note,
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not insert cash transaction", nil)
	}
	return c.JSON(http.StatusCreated, tx)
}

func (s *Server) handleListCash(c echo.Context) error {
	rows, err := s.deps.Store.ListCashTransactions(c.Request().Context(), store.ListCashTransactionsParams{
		UserID: auth.UserID(c), AccountID: accountArg(c.QueryParam("account_id")),
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not list cash transactions", nil)
	}
	if rows == nil {
		rows = []store.CashTransaction{}
	}
	return c.JSON(http.StatusOK, rows)
}

func (s *Server) handleDeleteCash(c echo.Context) error {
	err := s.deps.Store.DeleteCashTransaction(c.Request().Context(), store.DeleteCashTransactionParams{
		ID: c.Param("id"), UserID: auth.UserID(c),
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not delete cash transaction", nil)
	}
	return c.NoContent(http.StatusNoContent)
}
