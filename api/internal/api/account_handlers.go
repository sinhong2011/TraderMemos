package api

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/store"
)

// assertAccount returns nil only if the account exists and belongs to userID.
// Used to prevent writing into another user's account (IDOR guard).
func (s *Server) assertAccount(ctx context.Context, userID, accountID string) error {
	_, err := s.deps.Store.GetAccount(ctx, store.GetAccountParams{ID: accountID, UserID: userID})
	return err
}

func (s *Server) accountRoutes(g *echo.Group) {
	g.POST("/accounts", s.handleCreateAccount)
	g.GET("/accounts", s.handleListAccounts)
	g.GET("/accounts/:id", s.handleGetAccount)
	g.PUT("/accounts/:id", s.handleUpdateAccount)
	g.DELETE("/accounts/:id/trades", s.handleClearAccountTrades)
	g.DELETE("/accounts/:id", s.handleDeleteAccount)
}

type createAccountReq struct {
	Name            string  `json:"name"`
	Broker          string  `json:"broker"`
	AccountType     string  `json:"account_type"`
	BaseCurrency    string  `json:"base_currency"`
	StartingBalance float64 `json:"starting_balance"`
}

func (s *Server) handleCreateAccount(c echo.Context) error {
	uid := auth.UserID(c)
	ctx := c.Request().Context()
	var in createAccountReq
	if err := c.Bind(&in); err != nil || in.Name == "" {
		return Fail(http.StatusBadRequest, "bad_request", "name is required", nil)
	}
	if in.AccountType == "" {
		in.AccountType = "cash"
	}
	if in.BaseCurrency == "" {
		in.BaseCurrency = "USD"
	}
	acc, err := s.deps.Store.CreateAccount(ctx, store.CreateAccountParams{
		ID: uuid.NewString(), UserID: uid, Name: in.Name, Broker: in.Broker,
		AccountType: in.AccountType, BaseCurrency: in.BaseCurrency, StartingBalance: in.StartingBalance,
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not create account", nil)
	}
	if err := s.ensureOpeningDeposit(ctx, uid, acc); err != nil {
		return Fail(http.StatusInternalServerError, "internal", "account created but opening deposit failed", nil)
	}
	return c.JSON(http.StatusCreated, acc)
}

// ensureOpeningDeposit writes starting_balance as the account's first deposit
// when the cash ledger is still empty. Idempotent.
func (s *Server) ensureOpeningDeposit(ctx context.Context, userID string, acc store.Account) error {
	if acc.StartingBalance <= 0 || s.deps.Store == nil {
		return nil
	}
	existing, err := s.deps.Store.ListCashTransactions(ctx, store.ListCashTransactionsParams{
		UserID: userID, AccountID: accountArg(acc.ID),
	})
	if err != nil {
		return err
	}
	if len(existing) > 0 {
		return nil
	}
	currency := acc.BaseCurrency
	if currency == "" {
		currency = "USD"
	}
	occurred := acc.CreatedAt
	if occurred.IsZero() {
		occurred = time.Now().UTC()
	}
	_, err = s.deps.Store.InsertCashTransaction(ctx, store.InsertCashTransactionParams{
		ID: uuid.NewString(), UserID: userID, AccountID: acc.ID,
		Type: "deposit", Amount: acc.StartingBalance, Currency: currency,
		OccurredAt: occurred, Note: "Opening balance",
	})
	return err
}

func (s *Server) handleListAccounts(c echo.Context) error {
	accs, err := s.deps.Store.ListAccounts(c.Request().Context(), auth.UserID(c))
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not list accounts", nil)
	}
	if accs == nil {
		accs = []store.Account{}
	}
	return c.JSON(http.StatusOK, accs)
}

func (s *Server) handleGetAccount(c echo.Context) error {
	acc, err := s.deps.Store.GetAccount(c.Request().Context(), store.GetAccountParams{
		ID: c.Param("id"), UserID: auth.UserID(c),
	})
	if errors.Is(err, sql.ErrNoRows) {
		return Fail(http.StatusNotFound, "not_found", "account not found", nil)
	}
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load account", nil)
	}
	return c.JSON(http.StatusOK, acc)
}

type updateAccountReq struct {
	Name            *string  `json:"name"`
	Broker          *string  `json:"broker"`
	AccountType     *string  `json:"account_type"`
	BaseCurrency    *string  `json:"base_currency"`
	StartingBalance *float64 `json:"starting_balance"`
}

func (s *Server) handleUpdateAccount(c echo.Context) error {
	uid := auth.UserID(c)
	id := c.Param("id")
	ctx := c.Request().Context()

	acc, err := s.deps.Store.GetAccount(ctx, store.GetAccountParams{ID: id, UserID: uid})
	if errors.Is(err, sql.ErrNoRows) {
		return Fail(http.StatusNotFound, "not_found", "account not found", nil)
	}
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load account", nil)
	}

	var in updateAccountReq
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}

	name := acc.Name
	broker := acc.Broker
	accountType := acc.AccountType
	baseCurrency := acc.BaseCurrency
	startingBalance := acc.StartingBalance

	if in.Name != nil {
		name = strings.TrimSpace(*in.Name)
		if name == "" {
			return Fail(http.StatusBadRequest, "bad_request", "name is required", nil)
		}
	}
	if in.Broker != nil {
		broker = strings.TrimSpace(*in.Broker)
	}
	if in.AccountType != nil {
		accountType = strings.TrimSpace(*in.AccountType)
		if accountType == "" {
			accountType = "cash"
		}
	}
	if in.BaseCurrency != nil {
		baseCurrency = strings.TrimSpace(*in.BaseCurrency)
		if baseCurrency == "" {
			baseCurrency = "USD"
		}
	}
	if in.StartingBalance != nil {
		startingBalance = *in.StartingBalance
	}

	updated, err := s.deps.Store.UpdateAccount(ctx, store.UpdateAccountParams{
		Name: name, Broker: broker, AccountType: accountType,
		BaseCurrency: baseCurrency, StartingBalance: startingBalance,
		ID: id, UserID: uid,
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not update account", nil)
	}
	return c.JSON(http.StatusOK, updated)
}

func (s *Server) handleClearAccountTrades(c echo.Context) error {
	uid := auth.UserID(c)
	ctx := c.Request().Context()
	id := c.Param("id")

	if _, err := s.deps.Store.GetAccount(ctx, store.GetAccountParams{ID: id, UserID: uid}); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Fail(http.StatusNotFound, "not_found", "account not found", nil)
		}
		return Fail(http.StatusInternalServerError, "internal", "could not load account", nil)
	}

	s.purgeAttachmentsForAccount(ctx, uid, id)

	if err := s.deps.Store.DeleteTradesForAccount(ctx, store.DeleteTradesForAccountParams{
		UserID: uid, AccountID: id,
	}); err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not clear trades", nil)
	}
	if err := s.deps.Store.DeleteExecutionsForAccount(ctx, store.DeleteExecutionsForAccountParams{
		UserID: uid, AccountID: id,
	}); err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not clear executions", nil)
	}
	return c.NoContent(http.StatusNoContent)
}

func (s *Server) handleDeleteAccount(c echo.Context) error {
	uid := auth.UserID(c)
	ctx := c.Request().Context()
	id := c.Param("id")

	if _, err := s.deps.Store.GetAccount(ctx, store.GetAccountParams{ID: id, UserID: uid}); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Fail(http.StatusNotFound, "not_found", "account not found", nil)
		}
		return Fail(http.StatusInternalServerError, "internal", "could not load account", nil)
	}

	accs, err := s.deps.Store.ListAccounts(ctx, uid)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not list accounts", nil)
	}
	if len(accs) <= 1 {
		return Fail(http.StatusConflict, "conflict", "cannot delete your only account — add another account first", nil)
	}

	s.purgeAttachmentsForAccount(ctx, uid, id)

	n, err := s.deps.Store.DeleteAccount(ctx, store.DeleteAccountParams{
		ID: id, UserID: uid,
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not delete account", nil)
	}
	if n == 0 {
		return Fail(http.StatusNotFound, "not_found", "account not found", nil)
	}
	return c.NoContent(http.StatusNoContent)
}
