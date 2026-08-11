package api

import (
	"database/sql"
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
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
	g.PUT("/cash-transactions/:id", s.handleUpdateCash)
	g.DELETE("/cash-transactions/:id", s.handleDeleteCash)
}

type cashDTO struct {
	ID         string    `json:"id"`
	UserID     string    `json:"user_id"`
	AccountID  string    `json:"account_id"`
	Type       string    `json:"type"`
	Amount     float64   `json:"amount"`
	Currency   string    `json:"currency"`
	OccurredAt time.Time `json:"occurred_at"`
	Note       string    `json:"note"`
	TradeID    *string   `json:"trade_id"`
	CreatedAt  time.Time `json:"created_at"`
}

func toCashDTO(tx store.CashTransaction) cashDTO {
	var tradeID *string
	if tx.TradeID.Valid {
		tradeID = &tx.TradeID.String
	}
	return cashDTO{
		ID: tx.ID, UserID: tx.UserID, AccountID: tx.AccountID,
		Type: tx.Type, Amount: tx.Amount, Currency: tx.Currency,
		OccurredAt: tx.OccurredAt, Note: tx.Note, TradeID: tradeID,
		CreatedAt: tx.CreatedAt,
	}
}

type createCashReq struct {
	AccountID  string    `json:"account_id"`
	Type       string    `json:"type"`
	Amount     float64   `json:"amount"`
	Currency   string    `json:"currency"`
	OccurredAt time.Time `json:"occurred_at"`
	Note       string    `json:"note"`
	TradeID    string    `json:"trade_id"`
}

func (s *Server) handleCreateCash(c *echo.Context) error {
	var in createCashReq
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}
	if in.AccountID == "" || !validCashTypes[in.Type] {
		return Fail(http.StatusBadRequest, "bad_request", "account_id and a valid type are required", nil)
	}
	if in.OccurredAt.IsZero() {
		return Fail(http.StatusBadRequest, "bad_request", "occurred_at is required", nil)
	}
	uid := auth.UserID(c)
	if err := s.assertAccount(c.Request().Context(), uid, in.AccountID); err != nil {
		return Fail(http.StatusNotFound, "not_found", "account not found", nil)
	}
	var tradeID sql.NullString
	if in.TradeID != "" {
		if _, err := s.deps.Store.GetTrade(c.Request().Context(), store.GetTradeParams{ID: in.TradeID, UserID: uid}); err != nil {
			return Fail(http.StatusBadRequest, "bad_request", "unknown trade id", nil)
		}
		tradeID = sql.NullString{String: in.TradeID, Valid: true}
	}
	if in.Currency == "" {
		in.Currency = "USD"
	}
	tx, err := s.deps.Store.InsertCashTransaction(c.Request().Context(), store.InsertCashTransactionParams{
		ID: uuid.NewString(), UserID: uid, AccountID: in.AccountID,
		Type: in.Type, Amount: in.Amount, Currency: in.Currency,
		OccurredAt: in.OccurredAt, Note: in.Note, TradeID: tradeID,
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not insert cash transaction", nil)
	}
	return c.JSON(http.StatusCreated, toCashDTO(tx))
}

func (s *Server) handleListCash(c *echo.Context) error {
	ctx := c.Request().Context()
	uid := auth.UserID(c)
	f := Filters{AccountIDs: parseAccountIDs(c)}
	rows, err := s.deps.Store.ListCashTransactions(ctx, store.ListCashTransactionsParams{
		UserID: uid, AccountID: f.accountNarg(),
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not list cash transactions", nil)
	}
	excluded, err := s.backtestAccountIDs(ctx, uid, f)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not list cash transactions", nil)
	}
	rows = filterCashAccounts(rows, excluded)
	out := make([]cashDTO, 0, len(rows))
	for _, r := range rows {
		if !f.matchAccount(r.AccountID) {
			continue
		}
		out = append(out, toCashDTO(r))
	}
	return c.JSON(http.StatusOK, out)
}

type updateCashReq struct {
	Type       string    `json:"type"`
	Amount     float64   `json:"amount"`
	Currency   string    `json:"currency"`
	OccurredAt time.Time `json:"occurred_at"`
	Note       string    `json:"note"`
}

func (s *Server) handleUpdateCash(c *echo.Context) error {
	uid := auth.UserID(c)
	var in updateCashReq
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}
	if !validCashTypes[in.Type] {
		return Fail(http.StatusBadRequest, "bad_request", "a valid type is required", nil)
	}
	if in.OccurredAt.IsZero() {
		return Fail(http.StatusBadRequest, "bad_request", "occurred_at is required", nil)
	}
	if in.Currency == "" {
		in.Currency = "USD"
	}
	tx, err := s.deps.Store.UpdateCashTransaction(c.Request().Context(), store.UpdateCashTransactionParams{
		Type: in.Type, Amount: in.Amount, Currency: in.Currency,
		OccurredAt: in.OccurredAt, Note: in.Note,
		ID: c.Param("id"), UserID: uid,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Fail(http.StatusNotFound, "not_found", "cash transaction not found", nil)
		}
		return Fail(http.StatusInternalServerError, "internal", "could not update cash transaction", nil)
	}
	return c.JSON(http.StatusOK, toCashDTO(tx))
}

func (s *Server) handleDeleteCash(c *echo.Context) error {
	n, err := s.deps.Store.DeleteCashTransaction(c.Request().Context(), store.DeleteCashTransactionParams{
		ID: c.Param("id"), UserID: auth.UserID(c),
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not delete cash transaction", nil)
	}
	if n == 0 {
		return Fail(http.StatusNotFound, "not_found", "cash transaction not found", nil)
	}
	return c.NoContent(http.StatusNoContent)
}
