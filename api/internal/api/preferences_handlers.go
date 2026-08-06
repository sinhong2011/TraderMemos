package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/store"
)

// Preferences that belong to the account rather than to a device. The server
// stores them as an opaque JSON object: clients own the shape, and a column
// per toggle would be a migration on two dialects every time one is added.
func (s *Server) preferenceRoutes(g *echo.Group) {
	g.GET("/me/preferences", s.handleGetPreferences)
	g.PATCH("/me/preferences", s.handlePatchPreferences)
}

// Bounds on an otherwise opaque blob. Preferences are a few dozen short
// scalars; anything near these is a client bug or someone using the account
// as a key-value store.
const (
	maxPrefsBytes = 16 << 10
	maxPrefsKeys  = 200
)

type preferencesDTO struct {
	Prefs map[string]json.RawMessage `json:"prefs"`
	// Absent until something is stored — a client with nothing to sync still
	// gets a well-formed empty answer rather than a 404 to special-case.
	UpdatedAt *time.Time `json:"updated_at,omitempty"`
}

func (s *Server) loadPreferences(c echo.Context) (map[string]json.RawMessage, *time.Time, error) {
	row, err := s.deps.Store.GetUserPreferences(c.Request().Context(), auth.UserID(c))
	if errors.Is(err, sql.ErrNoRows) {
		return map[string]json.RawMessage{}, nil, nil
	}
	if err != nil {
		return nil, nil, Fail(http.StatusInternalServerError, "internal", "could not read preferences", nil)
	}
	prefs := map[string]json.RawMessage{}
	// A blob that will not parse is treated as empty rather than fatal: it can
	// only come from a hand-edited database, and refusing to start the app over
	// it would be the worse failure.
	_ = json.Unmarshal([]byte(row.Prefs), &prefs)
	updated := row.UpdatedAt
	return prefs, &updated, nil
}

func (s *Server) handleGetPreferences(c echo.Context) error {
	prefs, updated, err := s.loadPreferences(c)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, preferencesDTO{Prefs: prefs, UpdatedAt: updated})
}

/*
handlePatchPreferences merges the body's keys into what is stored and returns
the whole result.

Merge per key, not replace, is the point: two devices that change different
preferences while offline both keep their change, and neither has to send a
full snapshot it might have built from stale data. Two devices changing the
*same* key is last-write-wins, which for a preference is as good an answer as
any — the alternative is a conflict UI for whether your clock reads 24-hour.

A key set to JSON null is stored as null, not deleted. `displayCurrency: null`
means "follow the account's base currency", so null has to survive the round
trip.
*/
func (s *Server) handlePatchPreferences(c echo.Context) error {
	var patch map[string]json.RawMessage
	if err := c.Bind(&patch); err != nil || patch == nil {
		return Fail(http.StatusBadRequest, "bad_request", "body must be a JSON object", nil)
	}

	prefs, _, err := s.loadPreferences(c)
	if err != nil {
		return err
	}
	for k, v := range patch {
		prefs[k] = v
	}
	if len(prefs) > maxPrefsKeys {
		return Fail(http.StatusRequestEntityTooLarge, "too_large", "too many preferences", nil)
	}
	encoded, err := json.Marshal(prefs)
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "preferences are not encodable", nil)
	}
	if len(encoded) > maxPrefsBytes {
		return Fail(http.StatusRequestEntityTooLarge, "too_large", "preferences are too large", nil)
	}

	row, err := s.deps.Store.UpsertUserPreferences(c.Request().Context(), store.UpsertUserPreferencesParams{
		UserID: auth.UserID(c),
		Prefs:  string(encoded),
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not save preferences", nil)
	}
	return c.JSON(http.StatusOK, preferencesDTO{Prefs: prefs, UpdatedAt: &row.UpdatedAt})
}
