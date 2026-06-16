package api

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/store"
)

func (s *Server) setupRoutes(g *echo.Group) {
	g.POST("/setups", s.handleCreateSetup)
	g.GET("/setups", s.handleListSetups)
	g.PATCH("/setups/:id", s.handleUpdateSetup)
	g.DELETE("/setups/:id", s.handleDeleteSetup)
}

type createSetupReq struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

func (s *Server) handleCreateSetup(c echo.Context) error {
	var in createSetupReq
	if err := c.Bind(&in); err != nil || in.Name == "" {
		return Fail(http.StatusBadRequest, "bad_request", "name is required", nil)
	}
	setup, err := s.deps.Store.CreateSetup(c.Request().Context(), store.CreateSetupParams{
		ID: uuid.NewString(), UserID: auth.UserID(c), Name: in.Name, Description: in.Description,
	})
	if err != nil {
		return Fail(http.StatusConflict, "conflict", "could not create setup (duplicate name?)", nil)
	}
	return c.JSON(http.StatusCreated, setup)
}

func (s *Server) handleListSetups(c echo.Context) error {
	rows, err := s.deps.Store.ListSetups(c.Request().Context(), auth.UserID(c))
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not list setups", nil)
	}
	if rows == nil {
		rows = []store.Setup{}
	}
	return c.JSON(http.StatusOK, rows)
}

type updateSetupReq struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

func (s *Server) handleUpdateSetup(c echo.Context) error {
	var in updateSetupReq
	if err := c.Bind(&in); err != nil || in.Name == "" {
		return Fail(http.StatusBadRequest, "bad_request", "name is required", nil)
	}
	userID := auth.UserID(c)
	id := c.Param("id")
	if err := s.deps.Store.UpdateSetup(c.Request().Context(), store.UpdateSetupParams{
		Name: in.Name, Description: in.Description, ID: id, UserID: userID,
	}); err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not update setup", nil)
	}
	setup, err := s.deps.Store.GetSetup(c.Request().Context(), store.GetSetupParams{ID: id, UserID: userID})
	if err != nil {
		return Fail(http.StatusNotFound, "not_found", "setup not found", nil)
	}
	return c.JSON(http.StatusOK, setup)
}

func (s *Server) handleDeleteSetup(c echo.Context) error {
	n, err := s.deps.Store.DeleteSetup(c.Request().Context(), store.DeleteSetupParams{
		ID: c.Param("id"), UserID: auth.UserID(c),
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not delete setup", nil)
	}
	if n == 0 {
		return Fail(http.StatusNotFound, "not_found", "setup not found", nil)
	}
	return c.NoContent(http.StatusNoContent)
}
