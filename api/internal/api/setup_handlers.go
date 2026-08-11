package api

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/store"
)

func (s *Server) setupRoutes(g *echo.Group) {
	g.POST("/setups", s.handleCreateSetup)
	g.GET("/setups", s.handleListSetups)
	g.GET("/setups/:id", s.handleGetSetup)
	g.PATCH("/setups/:id", s.handleUpdateSetup)
	g.DELETE("/setups/:id", s.handleDeleteSetup)
}

type setupDTO struct {
	ID          string    `json:"id"`
	UserID      string    `json:"user_id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	Thesis      string    `json:"thesis"`
	Symbol      string    `json:"symbol"`
	Direction   string    `json:"direction"`
	TargetPrice *float64  `json:"target_price"`
	StopPrice   *float64  `json:"stop_price"`
	Checklist   []string  `json:"checklist"`
}

type setupBody struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Thesis      string   `json:"thesis"`
	Symbol      string   `json:"symbol"`
	Direction   string   `json:"direction"`
	TargetPrice *float64 `json:"target_price"`
	StopPrice   *float64 `json:"stop_price"`
	Checklist   []string `json:"checklist"`
}

func toSetupDTO(s store.Setup) setupDTO {
	items := parseChecklist(s.Checklist)
	return setupDTO{
		ID:          s.ID,
		UserID:      s.UserID,
		Name:        s.Name,
		Description: s.Description,
		CreatedAt:   s.CreatedAt,
		Thesis:      s.Thesis,
		Symbol:      s.Symbol,
		Direction:   s.Direction,
		TargetPrice: fptr(s.TargetPrice),
		StopPrice:   fptr(s.StopPrice),
		Checklist:   items,
	}
}

func parseChecklist(raw string) []string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return []string{}
	}
	var items []string
	if err := json.Unmarshal([]byte(raw), &items); err != nil {
		return []string{}
	}
	if items == nil {
		return []string{}
	}
	return items
}

func encodeChecklist(items []string) string {
	if items == nil {
		items = []string{}
	}
	b, err := json.Marshal(items)
	if err != nil {
		return "[]"
	}
	return string(b)
}

func normalizeDirection(d string) string {
	switch strings.ToLower(strings.TrimSpace(d)) {
	case "long":
		return "long"
	case "short":
		return "short"
	default:
		return ""
	}
}

func (s *Server) handleCreateSetup(c *echo.Context) error {
	var in setupBody
	if err := c.Bind(&in); err != nil || strings.TrimSpace(in.Name) == "" {
		return Fail(http.StatusBadRequest, "bad_request", "name is required", nil)
	}
	setup, err := s.deps.Store.CreateSetup(c.Request().Context(), store.CreateSetupParams{
		ID:          uuid.NewString(),
		UserID:      auth.UserID(c),
		Name:        strings.TrimSpace(in.Name),
		Description: in.Description,
		Thesis:      in.Thesis,
		Symbol:      strings.ToUpper(strings.TrimSpace(in.Symbol)),
		Direction:   normalizeDirection(in.Direction),
		TargetPrice: nullF(in.TargetPrice),
		StopPrice:   nullF(in.StopPrice),
		Checklist:   encodeChecklist(in.Checklist),
	})
	if err != nil {
		return Fail(http.StatusConflict, "conflict", "could not create setup (duplicate name?)", nil)
	}
	return c.JSON(http.StatusCreated, toSetupDTO(setup))
}

func (s *Server) handleListSetups(c *echo.Context) error {
	rows, err := s.deps.Store.ListSetups(c.Request().Context(), auth.UserID(c))
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not list setups", nil)
	}
	out := make([]setupDTO, 0, len(rows))
	for _, r := range rows {
		out = append(out, toSetupDTO(r))
	}
	return c.JSON(http.StatusOK, out)
}

func (s *Server) handleGetSetup(c *echo.Context) error {
	setup, err := s.deps.Store.GetSetup(c.Request().Context(), store.GetSetupParams{
		ID: c.Param("id"), UserID: auth.UserID(c),
	})
	if err != nil {
		return Fail(http.StatusNotFound, "not_found", "setup not found", nil)
	}
	return c.JSON(http.StatusOK, toSetupDTO(setup))
}

func (s *Server) handleUpdateSetup(c *echo.Context) error {
	var in setupBody
	if err := c.Bind(&in); err != nil || strings.TrimSpace(in.Name) == "" {
		return Fail(http.StatusBadRequest, "bad_request", "name is required", nil)
	}
	userID := auth.UserID(c)
	id := c.Param("id")
	if err := s.deps.Store.UpdateSetup(c.Request().Context(), store.UpdateSetupParams{
		Name:        strings.TrimSpace(in.Name),
		Description: in.Description,
		Thesis:      in.Thesis,
		Symbol:      strings.ToUpper(strings.TrimSpace(in.Symbol)),
		Direction:   normalizeDirection(in.Direction),
		TargetPrice: nullF(in.TargetPrice),
		StopPrice:   nullF(in.StopPrice),
		Checklist:   encodeChecklist(in.Checklist),
		ID:          id,
		UserID:      userID,
	}); err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not update setup", nil)
	}
	setup, err := s.deps.Store.GetSetup(c.Request().Context(), store.GetSetupParams{ID: id, UserID: userID})
	if err != nil {
		return Fail(http.StatusNotFound, "not_found", "setup not found", nil)
	}
	return c.JSON(http.StatusOK, toSetupDTO(setup))
}

func (s *Server) handleDeleteSetup(c *echo.Context) error {
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
