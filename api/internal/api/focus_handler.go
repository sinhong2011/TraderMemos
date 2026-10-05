package api

import (
	"net/http"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/tradermemos/api/internal/alerts"
	"github.com/tradermemos/api/internal/auth"
)

func (s *Server) focusRoutes(g *echo.Group) {
	g.GET("/focus/current", s.handleCurrentFocus)
}

type focusDTO struct {
	// Monday (market timezone) of the week the focus applies to.
	WeekStart string   `json:"week_start"`
	Items     []string `json:"items"`
	// The weekly review that set it; empty when there is none.
	NoteID    string `json:"note_id"`
	NoteTitle string `json:"note_title"`
}

// handleCurrentFocus returns this week's focus: the bullets under "Focus for
// next week" in the latest weekly review written before this week began. The
// week follows the market timezone, the same clock that dates the reviews.
func (s *Server) handleCurrentFocus(c *echo.Context) error {
	ctx := c.Request().Context()
	uid := auth.UserID(c)
	loc := alerts.MarketLocation(ctx, s.deps.Store, uid)
	start, _ := alerts.ReviewWeek(time.Now(), loc)

	items, note, err := alerts.PreviousFocus(ctx, s.deps.Store, uid, start)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load the weekly review", nil)
	}
	out := focusDTO{WeekStart: alerts.WeekKey(start), Items: []string{}}
	if len(items) > 0 {
		out.Items = items
	}
	if note != nil {
		out.NoteID, out.NoteTitle = note.ID, note.Title
	}
	return c.JSON(http.StatusOK, out)
}
