package api

import (
	"net/http"
	"runtime"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/tradermemos/api/internal/version"
)

func (s *Server) systemRoutes(g *echo.Group) {
	g.GET("/system/info", s.handleSystemInfo)
}

type systemInfoDTO struct {
	Version   string          `json:"version"`
	Commit    string          `json:"commit,omitempty"`
	BuildTime string          `json:"build_time,omitempty"`
	Go        string          `json:"go"`
	StartedAt time.Time       `json:"started_at"`
	UptimeSec int64           `json:"uptime_sec"`
	DBDriver  string          `json:"db_driver,omitempty"`
	WebURL    string          `json:"web_url,omitempty"`
	Features  map[string]bool `json:"features"`
}

func (s *Server) handleSystemInfo(c echo.Context) error {
	features := s.deps.Features
	if features == nil {
		features = map[string]bool{}
	}
	return c.JSON(http.StatusOK, systemInfoDTO{
		Version:   version.Version,
		Commit:    version.Commit,
		BuildTime: version.BuildTime,
		Go:        runtime.Version(),
		StartedAt: s.startedAt.UTC(),
		UptimeSec: int64(time.Since(s.startedAt).Seconds()),
		DBDriver:  s.deps.Driver,
		WebURL:    s.deps.PublicWebURL,
		Features:  features,
	})
}
