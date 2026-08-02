package api

import (
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/tradermemos/api/internal/store"
)

func (s *Server) economicEventRoutes(g *echo.Group) {
	g.GET("/economic-events", s.handleListEconomicEvents)
}

type economicEventDTO struct {
	ID       int64  `json:"id"`
	Provider string `json:"provider"`
	Title    string `json:"title"`
	Country  string `json:"country"`
	Impact   string `json:"impact"`
	Time     string `json:"time"`
	Forecast string `json:"forecast"`
	Previous string `json:"previous"`
	Actual   string `json:"actual"`
}

func (s *Server) handleListEconomicEvents(c echo.Context) error {
	from, err := parseEconTime(c.QueryParam("from"))
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid from: RFC3339 or YYYY-MM-DD required", nil)
	}
	to, err := parseEconTime(c.QueryParam("to"))
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid to: RFC3339 or YYYY-MM-DD required", nil)
	}
	if !to.After(from) {
		return Fail(http.StatusBadRequest, "bad_request", "to must be after from", nil)
	}
	if to.Sub(from) > 366*24*time.Hour {
		return Fail(http.StatusBadRequest, "bad_request", "range too large (max 366 days)", nil)
	}

	if s.deps.Econ == nil {
		return Fail(http.StatusServiceUnavailable, "unavailable", "economic calendar not configured", nil)
	}
	// Refresh is best-effort: a feed outage degrades to cached rows.
	if err := s.deps.Econ.EnsureFresh(c.Request().Context()); err != nil {
		s.logger.Warn("economic events refresh failed", "err", err)
	}

	rows, err := s.deps.Store.ListEconomicEvents(c.Request().Context(), store.ListEconomicEventsParams{
		EventTs:   from.UTC().Format(time.RFC3339),
		EventTs_2: to.UTC().Format(time.RFC3339),
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not list economic events", nil)
	}

	impacts := csvSet(c.QueryParam("impact"))
	countries := csvSet(c.QueryParam("country"))
	out := make([]economicEventDTO, 0, len(rows))
	for _, r := range rows {
		if impacts != nil && !impacts[strings.ToLower(r.Impact)] {
			continue
		}
		if countries != nil && !countries[strings.ToLower(r.Country)] {
			continue
		}
		out = append(out, economicEventDTO{
			ID:       r.ID,
			Provider: r.Provider,
			Title:    r.Title,
			Country:  r.Country,
			Impact:   r.Impact,
			Time:     r.EventTs,
			Forecast: r.Forecast,
			Previous: r.Previous,
			Actual:   r.Actual,
		})
	}
	return c.JSON(http.StatusOK, out)
}

func parseEconTime(raw string) (time.Time, error) {
	raw = strings.TrimSpace(raw)
	if t, err := time.Parse(time.RFC3339, raw); err == nil {
		return t, nil
	}
	return time.Parse("2006-01-02", raw)
}

// csvSet lowercases a comma-separated filter into a set; nil means no filter.
func csvSet(raw string) map[string]bool {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	set := make(map[string]bool)
	for _, p := range strings.Split(raw, ",") {
		p = strings.ToLower(strings.TrimSpace(p))
		if p != "" {
			set[p] = true
		}
	}
	if len(set) == 0 {
		return nil
	}
	return set
}
