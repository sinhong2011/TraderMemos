package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
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

type noteSymbolDTO struct {
	Symbol string `json:"symbol"`
	Body   string `json:"body"`
}

const (
	noteTypeNote     = "note"
	noteTypeDailyLog = "daily_log"
)

type noteDTO struct {
	ID         string          `json:"id"`
	Type       string          `json:"type"`
	OccurredAt string          `json:"occurred_at"`
	Title      string          `json:"title"`
	Body       string          `json:"body"`
	Symbols    []noteSymbolDTO `json:"symbols"`
	CreatedAt  time.Time       `json:"created_at"`
	UpdatedAt  time.Time       `json:"updated_at"`
}

type noteBody struct {
	Type       string          `json:"type"`
	OccurredAt string          `json:"occurred_at"`
	Title      string          `json:"title"`
	Body       string          `json:"body"`
	Symbols    []noteSymbolDTO `json:"symbols"`
}

func normalizeNoteType(raw string) (string, bool) {
	switch strings.TrimSpace(raw) {
	case "", noteTypeNote:
		return noteTypeNote, true
	case noteTypeDailyLog:
		return noteTypeDailyLog, true
	default:
		return "", false
	}
}

func defaultNoteTitle(noteType, title string) string {
	title = strings.TrimSpace(title)
	if title != "" {
		return title
	}
	if noteType == noteTypeDailyLog {
		return "Daily log"
	}
	return "Untitled"
}

func parseNoteSymbols(raw string) []noteSymbolDTO {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return []noteSymbolDTO{}
	}
	var out []noteSymbolDTO
	if err := json.Unmarshal([]byte(raw), &out); err != nil || out == nil {
		return []noteSymbolDTO{}
	}
	return out
}

func encodeNoteSymbols(symbols []noteSymbolDTO) string {
	cleaned := normalizeNoteSymbols(symbols)
	b, err := json.Marshal(cleaned)
	if err != nil {
		return "[]"
	}
	return string(b)
}

func normalizeNoteSymbols(symbols []noteSymbolDTO) []noteSymbolDTO {
	if len(symbols) == 0 {
		return []noteSymbolDTO{}
	}
	seen := map[string]struct{}{}
	out := make([]noteSymbolDTO, 0, len(symbols))
	for _, s := range symbols {
		sym := strings.ToUpper(strings.TrimSpace(s.Symbol))
		if sym == "" {
			continue
		}
		if _, ok := seen[sym]; ok {
			continue
		}
		seen[sym] = struct{}{}
		out = append(out, noteSymbolDTO{Symbol: sym, Body: strings.TrimSpace(s.Body)})
	}
	return out
}

func noteHasContent(body string, symbols []noteSymbolDTO) bool {
	if strings.TrimSpace(body) != "" {
		return true
	}
	for _, s := range symbols {
		if strings.TrimSpace(s.Body) != "" {
			return true
		}
	}
	return len(symbols) > 0
}

func toNoteDTO(n store.JournalNote) noteDTO {
	noteType, ok := normalizeNoteType(n.NoteType)
	if !ok {
		noteType = noteTypeNote
	}
	symbols := parseNoteSymbols(n.Symbols)
	if noteType != noteTypeDailyLog {
		symbols = []noteSymbolDTO{}
	}
	return noteDTO{
		ID: n.ID, Type: noteType, OccurredAt: n.OccurredAt, Title: n.Title, Body: n.Body,
		Symbols: symbols,
		CreatedAt: n.CreatedAt, UpdatedAt: n.UpdatedAt,
	}
}

func (s *Server) handleCreateNote(c echo.Context) error {
	var in noteBody
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}
	noteType, ok := normalizeNoteType(in.Type)
	if !ok {
		return Fail(http.StatusBadRequest, "bad_request", "type must be note or daily_log", nil)
	}
	symbols := normalizeNoteSymbols(in.Symbols)
	if noteType != noteTypeDailyLog {
		symbols = []noteSymbolDTO{}
	}
	if !noteHasContent(in.Body, symbols) {
		return Fail(http.StatusBadRequest, "bad_request", "body or symbols required", nil)
	}
	if strings.TrimSpace(in.OccurredAt) == "" {
		return Fail(http.StatusBadRequest, "bad_request", "occurred_at is required", nil)
	}
	title := defaultNoteTitle(noteType, in.Title)
	n, err := s.deps.Store.CreateJournalNote(c.Request().Context(), store.CreateJournalNoteParams{
		ID: uuid.NewString(), UserID: auth.UserID(c),
		OccurredAt: in.OccurredAt, Title: title,
		Body: strings.TrimSpace(in.Body), Symbols: encodeNoteSymbols(symbols),
		NoteType: noteType,
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
	noteType, ok := normalizeNoteType(in.Type)
	if !ok {
		return Fail(http.StatusBadRequest, "bad_request", "type must be note or daily_log", nil)
	}
	symbols := normalizeNoteSymbols(in.Symbols)
	if noteType != noteTypeDailyLog {
		symbols = []noteSymbolDTO{}
	}
	if strings.TrimSpace(in.OccurredAt) == "" {
		return Fail(http.StatusBadRequest, "bad_request", "occurred_at is required", nil)
	}
	if !noteHasContent(in.Body, symbols) {
		return Fail(http.StatusBadRequest, "bad_request", "body or symbols required", nil)
	}
	title := defaultNoteTitle(noteType, in.Title)
	n, err := s.deps.Store.UpdateJournalNote(c.Request().Context(), store.UpdateJournalNoteParams{
		OccurredAt: in.OccurredAt, Title: title,
		Body: strings.TrimSpace(in.Body), Symbols: encodeNoteSymbols(symbols),
		NoteType: noteType,
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
	Items   []string `json:"items"`
	Content string   `json:"content"`
}

var checklistTaskLine = regexp.MustCompile(`(?m)^\s*[-*+]\s+\[([ xX])\]\s+(.+?)\s*$`)

func checklistMarkdownFromItems(items []string) string {
	if len(items) == 0 {
		return ""
	}
	lines := make([]string, 0, len(items))
	for _, item := range items {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		lines = append(lines, "- [ ] "+item)
	}
	return strings.Join(lines, "\n")
}

func itemsFromChecklistMarkdown(content string) []string {
	matches := checklistTaskLine.FindAllStringSubmatch(content, -1)
	if len(matches) == 0 {
		// Fallback: one non-empty line per item when not written as tasks.
		out := []string{}
		for _, line := range strings.Split(content, "\n") {
			line = strings.TrimSpace(line)
			line = strings.TrimLeft(line, "#*-+ ")
			if line == "" {
				continue
			}
			out = append(out, line)
		}
		return out
	}
	out := make([]string, 0, len(matches))
	seen := map[string]struct{}{}
	for _, m := range matches {
		item := strings.TrimSpace(m[2])
		if item == "" {
			continue
		}
		key := strings.ToLower(item)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, item)
	}
	return out
}

func resolveChecklist(row store.ChecklistTemplate) checklistDTO {
	items := parseChecklist(row.Items)
	content := strings.TrimSpace(row.Content)
	if content == "" && len(items) > 0 {
		content = checklistMarkdownFromItems(items)
	}
	if len(items) == 0 && content != "" {
		items = itemsFromChecklistMarkdown(content)
	}
	return checklistDTO{Items: items, Content: content}
}

func (s *Server) handleGetChecklist(c echo.Context) error {
	row, err := s.deps.Store.GetChecklistTemplate(c.Request().Context(), auth.UserID(c))
	if errors.Is(err, sql.ErrNoRows) {
		return c.JSON(http.StatusOK, checklistDTO{Items: []string{}, Content: ""})
	}
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load checklist", nil)
	}
	return c.JSON(http.StatusOK, resolveChecklist(row))
}

func (s *Server) handlePutChecklist(c echo.Context) error {
	var in checklistDTO
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}
	content := strings.TrimSpace(in.Content)
	items := in.Items
	if content != "" {
		items = itemsFromChecklistMarkdown(content)
	} else if len(items) > 0 {
		content = checklistMarkdownFromItems(items)
	} else {
		items = []string{}
		content = ""
	}
	row, err := s.deps.Store.UpsertChecklistTemplate(c.Request().Context(), store.UpsertChecklistTemplateParams{
		UserID:  auth.UserID(c),
		Items:   encodeChecklist(items),
		Content: content,
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not save checklist", nil)
	}
	return c.JSON(http.StatusOK, resolveChecklist(row))
}
