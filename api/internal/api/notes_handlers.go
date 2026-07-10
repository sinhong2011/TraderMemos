package api

import (
	"database/sql"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/store"
)

func (s *Server) noteRoutes(g *echo.Group) {
	g.POST("/notes", s.handleCreateNote)
	g.GET("/notes", s.handleListNotes)
	g.GET("/notes/:id", s.handleGetNote)
	g.PATCH("/notes/:id", s.handleUpdateNote)
	g.DELETE("/notes/:id", s.handleDeleteNote)
}

type noteDTO struct {
	ID         string    `json:"id"`
	OccurredAt string    `json:"occurred_at"`
	Title      string    `json:"title"`
	Body       string    `json:"body"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type noteBody struct {
	OccurredAt string `json:"occurred_at"`
	Title      string `json:"title"`
	Body       string `json:"body"`
}

func toNoteDTO(n store.JournalNote) noteDTO {
	return noteDTO{
		ID: n.ID, OccurredAt: n.OccurredAt, Title: n.Title, Body: n.Body,
		CreatedAt: n.CreatedAt, UpdatedAt: n.UpdatedAt,
	}
}

func (s *Server) handleCreateNote(c echo.Context) error {
	var in noteBody
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}
	if strings.TrimSpace(in.Body) == "" {
		return Fail(http.StatusBadRequest, "bad_request", "body is required", nil)
	}
	if strings.TrimSpace(in.OccurredAt) == "" {
		return Fail(http.StatusBadRequest, "bad_request", "occurred_at is required", nil)
	}
	title := strings.TrimSpace(in.Title)
	if title == "" {
		title = "Untitled note"
	}
	n, err := s.deps.Store.CreateJournalNote(c.Request().Context(), store.CreateJournalNoteParams{
		ID: uuid.NewString(), UserID: auth.UserID(c),
		OccurredAt: in.OccurredAt, Title: title, Body: strings.TrimSpace(in.Body),
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not create note", nil)
	}
	return c.JSON(http.StatusCreated, toNoteDTO(n))
}

func (s *Server) handleListNotes(c echo.Context) error {
	rows, err := s.deps.Store.ListJournalNotes(c.Request().Context(), store.ListJournalNotesParams{
		UserID:   auth.UserID(c),
		FromDate: nullStr(c.QueryParam("from")),
		ToDate:   nullStr(c.QueryParam("to")),
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not list notes", nil)
	}
	out := make([]noteDTO, 0, len(rows))
	for _, r := range rows {
		out = append(out, toNoteDTO(r))
	}
	return c.JSON(http.StatusOK, out)
}

func (s *Server) handleGetNote(c echo.Context) error {
	n, err := s.deps.Store.GetJournalNote(c.Request().Context(), store.GetJournalNoteParams{
		ID: c.Param("id"), UserID: auth.UserID(c),
	})
	if errors.Is(err, sql.ErrNoRows) {
		return Fail(http.StatusNotFound, "not_found", "note not found", nil)
	}
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load note", nil)
	}
	return c.JSON(http.StatusOK, toNoteDTO(n))
}

func (s *Server) handleUpdateNote(c echo.Context) error {
	var in noteBody
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}
	if strings.TrimSpace(in.Body) == "" || strings.TrimSpace(in.OccurredAt) == "" {
		return Fail(http.StatusBadRequest, "bad_request", "occurred_at and body are required", nil)
	}
	title := strings.TrimSpace(in.Title)
	if title == "" {
		title = "Untitled note"
	}
	n, err := s.deps.Store.UpdateJournalNote(c.Request().Context(), store.UpdateJournalNoteParams{
		OccurredAt: in.OccurredAt, Title: title, Body: strings.TrimSpace(in.Body),
		ID: c.Param("id"), UserID: auth.UserID(c),
	})
	if errors.Is(err, sql.ErrNoRows) {
		return Fail(http.StatusNotFound, "not_found", "note not found", nil)
	}
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not update note", nil)
	}
	return c.JSON(http.StatusOK, toNoteDTO(n))
}

func (s *Server) handleDeleteNote(c echo.Context) error {
	n, err := s.deps.Store.DeleteJournalNote(c.Request().Context(), store.DeleteJournalNoteParams{
		ID: c.Param("id"), UserID: auth.UserID(c),
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not delete note", nil)
	}
	if n == 0 {
		return Fail(http.StatusNotFound, "not_found", "note not found", nil)
	}
	return c.NoContent(http.StatusNoContent)
}

func nullStr(v string) sql.NullString {
	if v == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: v, Valid: true}
}

// Checklist template routes live under settings.
func (s *Server) checklistRoutes(g *echo.Group) {
	g.GET("/settings/checklist-template", s.handleGetChecklist)
	g.PUT("/settings/checklist-template", s.handlePutChecklist)
}

type checklistDTO struct {
	Items []string `json:"items"`
}

func (s *Server) handleGetChecklist(c echo.Context) error {
	row, err := s.deps.Store.GetChecklistTemplate(c.Request().Context(), auth.UserID(c))
	if errors.Is(err, sql.ErrNoRows) {
		return c.JSON(http.StatusOK, checklistDTO{Items: []string{}})
	}
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load checklist", nil)
	}
	return c.JSON(http.StatusOK, checklistDTO{Items: parseChecklist(row.Items)})
}

func (s *Server) handlePutChecklist(c echo.Context) error {
	var in checklistDTO
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}
	row, err := s.deps.Store.UpsertChecklistTemplate(c.Request().Context(), store.UpsertChecklistTemplateParams{
		UserID: auth.UserID(c),
		Items:  encodeChecklist(in.Items),
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not save checklist", nil)
	}
	return c.JSON(http.StatusOK, checklistDTO{Items: parseChecklist(row.Items)})
}
