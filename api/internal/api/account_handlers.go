package api

import (
	"context"
	"database/sql"
	"errors"
	"net/http"

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
	acc, err := s.deps.Store.CreateAccount(c.Request().Context(), store.CreateAccountParams{
		ID: uuid.NewString(), UserID: uid, Name: in.Name, Broker: in.Broker,
		AccountType: in.AccountType, BaseCurrency: in.BaseCurrency, StartingBalance: in.StartingBalance,
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not create account", nil)
	}
	return c.JSON(http.StatusCreated, acc)
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

func (s *Server) handleDeleteAccount(c echo.Context) error {
	n, err := s.deps.Store.DeleteAccount(c.Request().Context(), store.DeleteAccountParams{
		ID: c.Param("id"), UserID: auth.UserID(c),
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not delete account", nil)
	}
	if n == 0 {
		return Fail(http.StatusNotFound, "not_found", "account not found", nil)
	}
	return c.NoContent(http.StatusNoContent)
}
