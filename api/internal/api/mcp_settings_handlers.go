package api

import (
	"net/http"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/store"
)

func (s *Server) mcpSettingsRoutes(g *echo.Group) {
	g.GET("/settings/mcp", s.handleGetMCPSettings)
	g.PUT("/settings/mcp", s.handlePutMCPSettings)
}

type mcpSettingsDTO struct {
	// Available is false when the operator disabled MCP for the whole instance
	// (TM_MCP_ENABLED=false); the switches below then have no effect.
	Available   bool `json:"available"`
	Enabled     bool `json:"enabled"`
	AllowWrites bool `json:"allow_writes"`
	// EndpointPath is relative to the API origin the client already talks to;
	// only the client knows the public origin behind a proxy.
	EndpointPath string     `json:"endpoint_path"`
	UpdatedAt    *time.Time `json:"updated_at,omitempty"`
}

type putMCPSettingsReq struct {
	Enabled     *bool `json:"enabled"`
	AllowWrites *bool `json:"allow_writes"`
}

func (s *Server) mcpSettingsDTO(row store.McpSetting) mcpSettingsDTO {
	dto := mcpSettingsDTO{
		Available:    s.deps.MCPEnabled,
		Enabled:      row.Enabled != 0,
		AllowWrites:  row.AllowWrites != 0,
		EndpointPath: mcpPath,
	}
	if !row.UpdatedAt.IsZero() {
		t := row.UpdatedAt
		dto.UpdatedAt = &t
	}
	return dto
}

func (s *Server) handleGetMCPSettings(c *echo.Context) error {
	row, err := s.loadMCPSettings(c.Request().Context(), auth.UserID(c))
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not read MCP settings", nil).Wrap(err)
	}
	return c.JSON(http.StatusOK, s.mcpSettingsDTO(row))
}

func (s *Server) handlePutMCPSettings(c *echo.Context) error {
	// A personal access token must not be able to widen what tokens may do
	// over MCP: otherwise the token handed to an assistant could switch on its
	// own write access. Only a signed-in session changes these.
	if auth.ViaPAT(c) {
		return Fail(http.StatusForbidden, "session_required",
			"MCP settings can only be changed from a signed-in TraderMemos session, not with an access token", nil)
	}
	var in putMCPSettingsReq
	if err := c.Bind(&in); err != nil || in.Enabled == nil || in.AllowWrites == nil {
		return Fail(http.StatusBadRequest, "bad_request", "enabled and allow_writes (booleans) are required", nil)
	}
	row, err := s.deps.Store.UpsertMCPSettings(c.Request().Context(), store.UpsertMCPSettingsParams{
		UserID:      auth.UserID(c),
		Enabled:     b2i(*in.Enabled),
		AllowWrites: b2i(*in.AllowWrites),
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not save MCP settings", nil).Wrap(err)
	}
	c.Logger().Info("mcp settings changed", "enabled", *in.Enabled, "allow_writes", *in.AllowWrites)
	return c.JSON(http.StatusOK, s.mcpSettingsDTO(row))
}
