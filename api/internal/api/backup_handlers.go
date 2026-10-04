package api

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/tradermemos/api/internal/backup"
)

// manualBackupTimeout caps a "back up now" request. The snapshot outlives a
// dropped connection (WithoutCancel) so closing the tab never strands a temp
// file mid-write.
const manualBackupTimeout = 10 * time.Minute

// Registered under /admin: the snapshot holds every user's journal, so only
// the server owner may see where it lives or trigger one.
func (s *Server) backupRoutes(admin *echo.Group) {
	admin.GET("/backup", s.handleBackupStatus)
	admin.POST("/backup", s.handleBackupRun)
}

func (s *Server) handleBackupStatus(c *echo.Context) error {
	if s.deps.Backup == nil {
		return Fail(http.StatusServiceUnavailable, "unavailable", "backups are not configured", nil)
	}
	return c.JSON(http.StatusOK, s.deps.Backup.Status())
}

func (s *Server) handleBackupRun(c *echo.Context) error {
	svc := s.deps.Backup
	if svc == nil {
		return Fail(http.StatusServiceUnavailable, "unavailable", "backups are not configured", nil)
	}
	ctx, cancel := context.WithTimeout(context.WithoutCancel(c.Request().Context()), manualBackupTimeout)
	defer cancel()
	_, err := svc.Run(ctx)
	switch {
	case errors.Is(err, backup.ErrUnsupported):
		return Fail(http.StatusBadRequest, "unsupported", backup.PostgresHint, nil)
	case errors.Is(err, backup.ErrRunning):
		return Fail(http.StatusConflict, "conflict", err.Error(), nil)
	case err != nil:
		return Fail(http.StatusInternalServerError, "backup_failed", err.Error(), nil)
	}
	return c.JSON(http.StatusOK, svc.Status())
}
