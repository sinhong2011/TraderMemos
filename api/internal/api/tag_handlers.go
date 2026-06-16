package api

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/store"
)

func (s *Server) tagRoutes(g *echo.Group) {
	g.POST("/tags", s.handleCreateTag)
	g.GET("/tags", s.handleListTags)
	g.DELETE("/tags/:id", s.handleDeleteTag)
}

type createTagReq struct {
	Name        string `json:"name"`
	Color       string `json:"color"`
	Description string `json:"description"`
}

func (s *Server) handleCreateTag(c echo.Context) error {
	var in createTagReq
	if err := c.Bind(&in); err != nil || in.Name == "" {
		return Fail(http.StatusBadRequest, "bad_request", "name is required", nil)
	}
	if in.Color == "" {
		in.Color = "#CBD5E1"
	}
	tag, err := s.deps.Store.CreateTag(c.Request().Context(), store.CreateTagParams{
		ID: uuid.NewString(), UserID: auth.UserID(c), Name: in.Name,
		Color: in.Color, Description: in.Description,
	})
	if err != nil {
		return Fail(http.StatusConflict, "conflict", "could not create tag (duplicate name?)", nil)
	}
	return c.JSON(http.StatusCreated, tag)
}

func (s *Server) handleListTags(c echo.Context) error {
	rows, err := s.deps.Store.ListTags(c.Request().Context(), auth.UserID(c))
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not list tags", nil)
	}
	if rows == nil {
		rows = []store.Tag{}
	}
	return c.JSON(http.StatusOK, rows)
}

func (s *Server) handleDeleteTag(c echo.Context) error {
	err := s.deps.Store.DeleteTag(c.Request().Context(), store.DeleteTagParams{
		ID: c.Param("id"), UserID: auth.UserID(c),
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not delete tag", nil)
	}
	return c.NoContent(http.StatusNoContent)
}
