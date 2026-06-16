package api

import (
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"

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
	headers = records[0]
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

func (s *Server) handleImportPreview(c echo.Context) error {
	uid := auth.UserID(c)
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
	return c.JSON(http.StatusOK, map[string]any{
		"import_batch_id":   batch.ID,
		"headers":           headers,
		"sample_rows":       sample,
		"suggested_mapping": importer.SuggestMapping(headers),
	})
}

type importResult struct {
	Inserted int                 `json:"inserted"`
	Skipped  int                 `json:"skipped"`
	Errors   []importer.RowError `json:"errors"`
}

func (s *Server) handleImportCommit(c echo.Context) error {
	ctx := c.Request().Context()
	uid := auth.UserID(c)
	batchID := c.Param("id")

	batch, err := s.deps.Store.GetImportBatch(ctx, store.GetImportBatchParams{ID: batchID, UserID: uid})
	if err != nil {
		return Fail(http.StatusNotFound, "not_found", "import batch not found", nil)
	}

	var mapping map[string]string
	if err := json.Unmarshal([]byte(c.FormValue("column_mapping")), &mapping); err != nil || len(mapping) == 0 {
		return Fail(http.StatusBadRequest, "bad_request", "column_mapping (JSON) is required", nil)
	}
	instrumentType := c.FormValue("instrument_type")
	if instrumentType == "" {
		instrumentType = "stock"
	}
	fh, err := c.FormFile("file")
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "file is required", nil)
	}
	_, rows, err := readCSV(fh)
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "could not parse CSV", err.Error())
	}

	parsed := importer.NewGeneric(mapping, instrumentType).ParseRows(rows)
	res := importResult{Errors: parsed.Errors}
	if res.Errors == nil {
		res.Errors = []importer.RowError{}
	}
	for _, pe := range parsed.Executions {
		hash := importer.DedupHash(pe.Symbol, pe.Side, pe.Quantity, pe.Price, pe.ExecutedAt)
		exists, err := s.deps.Store.ExecutionExists(ctx, store.ExecutionExistsParams{AccountID: batch.AccountID, DedupHash: hash})
		if err != nil {
			return Fail(http.StatusInternalServerError, "internal", "dedup check failed", nil)
		}
		if exists == 1 {
			res.Skipped++
			continue
		}
		ext := sql.NullString{}
		if pe.ExternalID != "" {
			ext = sql.NullString{String: pe.ExternalID, Valid: true}
		}
		if _, err := s.deps.Store.InsertExecution(ctx, store.InsertExecutionParams{
			ID: uuid.NewString(), UserID: uid, AccountID: batch.AccountID, ExternalID: ext,
			Symbol: pe.Symbol, InstrumentType: pe.InstrumentType, Side: pe.Side,
			Quantity: pe.Quantity, Price: pe.Price, Fees: pe.Fees, Commission: pe.Commission,
			ExecutedAt: pe.ExecutedAt, Multiplier: 1,
			ImportBatchID: sql.NullString{String: batch.ID, Valid: true}, DedupHash: hash,
		}); err != nil {
			return Fail(http.StatusInternalServerError, "internal", "could not insert execution", nil)
		}
		res.Inserted++
	}

	if err := s.deps.Store.SetImportBatchStatus(ctx, store.SetImportBatchStatusParams{Status: "committed", ID: batch.ID, UserID: uid}); err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not finalize batch", nil)
	}
	if err := s.deps.Trades.Regroup(ctx, uid, batch.AccountID); err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not regroup trades", nil)
	}
	return c.JSON(http.StatusOK, res)
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
