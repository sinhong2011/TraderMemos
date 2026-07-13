package api

import (
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/importer"
	"github.com/tradermemos/api/internal/store"
)

func (s *Server) importRoutes(g *echo.Group) {
	g.POST("/imports", s.handleImportPreview)
	g.POST("/imports/:id/commit", s.handleImportCommit)
	g.GET("/imports", s.handleListImports)
	g.DELETE("/imports/:id", s.handleDeleteImport)
}

// readCSV parses an uploaded multipart file into headers + row maps.
func readCSV(fh *multipart.FileHeader) (headers []string, rows []map[string]string, err error) {
	f, err := fh.Open()
	if err != nil {
		return nil, nil, err
	}
	defer f.Close()
	r := csv.NewReader(f)
	r.FieldsPerRecord = -1
	records, err := r.ReadAll()
	if err != nil {
		return nil, nil, err
	}
	if len(records) == 0 {
		return nil, nil, io.ErrUnexpectedEOF
	}
	headers = stripBOMHeaders(records[0])
	for _, rec := range records[1:] {
		m := map[string]string{}
		for i, h := range headers {
			if i < len(rec) {
				m[h] = rec[i]
			}
		}
		rows = append(rows, m)
	}
	return headers, rows, nil
}

func stripBOMHeaders(headers []string) []string {
	out := make([]string, len(headers))
	for i, h := range headers {
		out[i] = strings.TrimPrefix(strings.TrimSpace(h), "\ufeff")
	}
	return out
}

func (s *Server) handleImportPreview(c echo.Context) error {
	uid := auth.UserID(c)
	if s.deps.ImportMaxBytes > 0 && c.Request().ContentLength > s.deps.ImportMaxBytes {
		return Fail(http.StatusRequestEntityTooLarge, "too_large", "upload exceeds size limit", nil)
	}
	accountID := c.FormValue("account_id")
	if accountID == "" {
		return Fail(http.StatusBadRequest, "bad_request", "account_id is required", nil)
	}
	if err := s.assertAccount(c.Request().Context(), uid, accountID); err != nil {
		return Fail(http.StatusNotFound, "not_found", "account not found", nil)
	}
	fh, err := c.FormFile("file")
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "file is required", nil)
	}
	headers, rows, err := readCSV(fh)
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "could not parse CSV", err.Error())
	}
	batch, err := s.deps.Store.CreateImportBatch(c.Request().Context(), store.CreateImportBatchParams{
		ID: uuid.NewString(), UserID: uid, AccountID: accountID, Source: "csv",
		Filename: sql.NullString{String: fh.Filename, Valid: true},
		RowCount: int64(len(rows)), Status: "pending",
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not create import batch", nil)
	}
	sample := rows
	if len(sample) > 5 {
		sample = sample[:5]
	}
	format := importer.DetectFormat(headers)
	suggested := importer.SuggestMapping(headers)
	if format == "journal_trades" {
		suggested = map[string]string{} // auto-mapped; UI skips column mapping
	}
	resp := map[string]any{
		"import_batch_id":   batch.ID,
		"headers":           headers,
		"sample_rows":       sample,
		"suggested_mapping": suggested,
		"format":            format,
		"row_count":         len(rows),
	}
	if format == "journal_trades" {
		summary, sampleTrades := importer.BuildJournalPreview(rows)
		resp["journal_summary"] = summary
		resp["sample_trades"] = sampleTrades
	}
	return c.JSON(http.StatusOK, resp)
}

type importResult struct {
	Inserted  int                 `json:"inserted"`
	Skipped   int                 `json:"skipped"`
	Annotated int                 `json:"annotated"`
	Trades    int                 `json:"trades"`
	Format    string              `json:"format"`
	Errors    []importer.RowError `json:"errors"`
}

func (s *Server) handleImportCommit(c echo.Context) error {
	ctx := c.Request().Context()
	uid := auth.UserID(c)
	if s.deps.ImportMaxBytes > 0 && c.Request().ContentLength > s.deps.ImportMaxBytes {
		return Fail(http.StatusRequestEntityTooLarge, "too_large", "upload exceeds size limit", nil)
	}
	batchID := c.Param("id")

	batch, err := s.deps.Store.GetImportBatch(ctx, store.GetImportBatchParams{ID: batchID, UserID: uid})
	if err != nil {
		return Fail(http.StatusNotFound, "not_found", "import batch not found", nil)
	}

	fh, err := c.FormFile("file")
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "file is required", nil)
	}
	headers, rows, err := readCSV(fh)
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "could not parse CSV", err.Error())
	}

	format := importer.DetectFormat(headers)
	var parsed importer.ParseResult
	if format == "journal_trades" {
		opts := (*importer.JournalParseOptions)(nil)
		if raw := c.FormValue("journal_option_overrides"); raw != "" {
			rawOverrides := map[string]string{}
			if err := json.Unmarshal([]byte(raw), &rawOverrides); err != nil {
				return Fail(http.StatusBadRequest, "bad_request", "journal_option_overrides must be JSON object keyed by row number", nil)
			}
			overrides := map[int]string{}
			for k, v := range rawOverrides {
				rowNum, err := strconv.Atoi(k)
				if err != nil || rowNum <= 0 {
					continue
				}
				if right := importer.ParseOptionRight(v); right != "" {
					overrides[rowNum] = right
				}
			}
			if len(overrides) > 0 {
				opts = &importer.JournalParseOptions{OptionRightByRow: overrides}
			}
		}
		parsed = importer.NewJournal().ParseRowsWithOptions(rows, opts)
	} else {
		var mapping map[string]string
		if raw := c.FormValue("column_mapping"); raw != "" {
			if err := json.Unmarshal([]byte(raw), &mapping); err != nil || len(mapping) == 0 {
				return Fail(http.StatusBadRequest, "bad_request", "column_mapping (JSON) is required", nil)
			}
		} else {
			return Fail(http.StatusBadRequest, "bad_request", "column_mapping (JSON) is required", nil)
		}
		parsed = importer.NewGeneric(mapping).ParseRows(rows)
		parsed.Format = "executions"
	}

	committed, err := importer.Commit(ctx, s.deps.Store, uid, batch.AccountID,
		sql.NullString{String: batch.ID, Valid: true}, parsed)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not import", err.Error())
	}

	if err := s.deps.Store.SetImportBatchStatus(ctx, store.SetImportBatchStatusParams{Status: "committed", ID: batch.ID, UserID: uid}); err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not finalize batch", nil)
	}
	return c.JSON(http.StatusOK, importResult{
		Inserted: committed.Inserted, Skipped: committed.Skipped,
		Annotated: committed.Annotated, Trades: committed.Trades,
		Format: committed.Format, Errors: committed.Errors,
	})
}

func (s *Server) handleListImports(c echo.Context) error {
	rows, err := s.deps.Store.ListImportBatches(c.Request().Context(), auth.UserID(c))
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not list imports", nil)
	}
	if rows == nil {
		rows = []store.ImportBatch{}
	}
	return c.JSON(http.StatusOK, rows)
}

func (s *Server) handleDeleteImport(c echo.Context) error {
	ctx := c.Request().Context()
	uid := auth.UserID(c)
	batchID := c.Param("id")
	batch, err := s.deps.Store.GetImportBatch(ctx, store.GetImportBatchParams{ID: batchID, UserID: uid})
	if err != nil {
		return Fail(http.StatusNotFound, "not_found", "import batch not found", nil)
	}
	if err := s.deps.Store.DeleteExecutionsForBatch(ctx, store.DeleteExecutionsForBatchParams{
		ImportBatchID: sql.NullString{String: batch.ID, Valid: true}, UserID: uid,
	}); err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not reverse import", nil)
	}
	if err := s.deps.Store.SetImportBatchStatus(ctx, store.SetImportBatchStatusParams{Status: "reversed", ID: batch.ID, UserID: uid}); err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not update batch", nil)
	}
	if err := s.deps.Trades.Regroup(ctx, uid, batch.AccountID); err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not regroup trades", nil)
	}
	return c.NoContent(http.StatusNoContent)
}
