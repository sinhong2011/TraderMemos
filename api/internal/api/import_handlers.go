package api

import (
	"context"
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

type loadedImport struct {
	Source  string // csv|json
	Format  string
	Headers []string
	Rows    []map[string]string
	JSON    importer.JSONImport
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

func readUploadBytes(fh *multipart.FileHeader) ([]byte, error) {
	f, err := fh.Open()
	if err != nil {
		return nil, err
	}
	defer f.Close()
	return io.ReadAll(f)
}

func loadImportFile(fh *multipart.FileHeader) (loadedImport, error) {
	if importer.IsJSONFilename(fh.Filename) {
		data, err := readUploadBytes(fh)
		if err != nil {
			return loadedImport{}, err
		}
		j, err := importer.ParseJSONImport(data)
		if err != nil {
			return loadedImport{}, err
		}
		return loadedImport{
			Source:  "json",
			Format:  j.Format,
			Headers: j.Headers,
			Rows:    j.Rows,
			JSON:    j,
		}, nil
	}

	headers, rows, err := readCSV(fh)
	if err != nil {
		return loadedImport{}, err
	}
	format := importer.DetectFormat(headers)
	return loadedImport{
		Source:  "csv",
		Format:  format,
		Headers: headers,
		Rows:    rows,
	}, nil
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
	loaded, err := loadImportFile(fh)
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "could not parse upload", err.Error())
	}
	source := loaded.Source
	rowCount := len(loaded.Rows)
	if source == "json" && rowCount == 0 {
		rowCount = len(loaded.JSON.Result.Executions)
		if loaded.Format == "journal_trades" {
			rowCount = importer.CountJournalTrades(loaded.JSON.Result.Executions)
		}
	}
	batch, err := s.deps.Store.CreateImportBatch(c.Request().Context(), store.CreateImportBatchParams{
		ID: uuid.NewString(), UserID: uid, AccountID: accountID, Source: source,
		Filename: sql.NullString{String: fh.Filename, Valid: true},
		RowCount: int64(rowCount), Status: "pending",
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not create import batch", nil)
	}
	sample := loaded.Rows
	if len(sample) > 5 {
		sample = sample[:5]
	}
	suggested := importer.SuggestMapping(loaded.Headers)
	if loaded.Format == "journal_trades" {
		suggested = map[string]string{}
	}
	resp := map[string]any{
		"import_batch_id":   batch.ID,
		"headers":           loaded.Headers,
		"sample_rows":       sample,
		"suggested_mapping": suggested,
		"format":            loaded.Format,
		"source":            source,
		"row_count":         rowCount,
	}
	if loaded.Format == "journal_trades" {
		summary, sampleTrades := importer.BuildJournalPreview(loaded.Rows)
		resp["journal_summary"] = summary
		resp["sample_trades"] = sampleTrades
	}
	return c.JSON(http.StatusOK, resp)
}

type importResult struct {
	Inserted      int                 `json:"inserted"`
	Skipped       int                 `json:"skipped"`
	Annotated     int                 `json:"annotated"`
	Trades        int                 `json:"trades"`
	CashInserted  int                 `json:"cash_inserted"`
	SetupsUpserted int                `json:"setups_upserted"`
	Format        string              `json:"format"`
	Errors        []importer.RowError `json:"errors"`
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
	loaded, err := loadImportFile(fh)
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "could not parse upload", err.Error())
	}

	var parsed importer.ParseResult
	switch {
	case loaded.Source == "json":
		parsed = loaded.JSON.Result
		if loaded.Format == "journal_trades" {
			if opts := journalOptionOverrides(c); opts != nil && len(loaded.Rows) > 0 {
				parsed = importer.NewJournal().ParseRowsWithOptions(loaded.Rows, opts)
			}
		}
	case loaded.Format == "journal_trades":
		opts := journalOptionOverrides(c)
		parsed = importer.NewJournal().ParseRowsWithOptions(loaded.Rows, opts)
	default:
		var mapping map[string]string
		if raw := c.FormValue("column_mapping"); raw != "" {
			if err := json.Unmarshal([]byte(raw), &mapping); err != nil || len(mapping) == 0 {
				return Fail(http.StatusBadRequest, "bad_request", "column_mapping (JSON) is required", nil)
			}
		} else {
			return Fail(http.StatusBadRequest, "bad_request", "column_mapping (JSON) is required", nil)
		}
		parsed = importer.NewGeneric(mapping).ParseRows(loaded.Rows)
		parsed.Format = "executions"
	}

	setupsUpserted := 0
	if loaded.Source == "json" {
		// Restore playbook catalog first so trade annotations link to full setups.
		n, err := importer.UpsertSetups(ctx, s.deps.Store, uid, loaded.JSON.Setups)
		if err != nil {
			return Fail(http.StatusInternalServerError, "internal", "could not import setups", err.Error())
		}
		setupsUpserted = n
	}

	committed, err := importer.Commit(ctx, s.deps.Store, uid, batch.AccountID,
		sql.NullString{String: batch.ID, Valid: true}, parsed)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not import", err.Error())
	}

	cashInserted := 0
	if loaded.Source == "json" {
		if err := s.applyJSONAccountMeta(ctx, uid, batch.AccountID, loaded.JSON.Account); err != nil {
			return Fail(http.StatusInternalServerError, "internal", "could not apply account metadata", err.Error())
		}
		cashN, err := s.applyJSONCashTransactions(ctx, uid, batch.AccountID,
			sql.NullString{String: batch.ID, Valid: true}, loaded.JSON.Cash)
		if err != nil {
			return Fail(http.StatusInternalServerError, "internal", "could not import cash transactions", err.Error())
		}
		cashInserted = cashN
		acc, err := s.deps.Store.GetAccount(ctx, store.GetAccountParams{ID: batch.AccountID, UserID: uid})
		if err == nil {
			if err := s.ensureOpeningDeposit(ctx, uid, acc); err != nil {
				return Fail(http.StatusInternalServerError, "internal", "could not seed opening deposit", err.Error())
			}
		}
	}

	if err := s.deps.Store.SetImportBatchStatus(ctx, store.SetImportBatchStatusParams{Status: "committed", ID: batch.ID, UserID: uid}); err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not finalize batch", nil)
	}
	return c.JSON(http.StatusOK, importResult{
		Inserted: committed.Inserted, Skipped: committed.Skipped,
		Annotated: committed.Annotated, Trades: committed.Trades,
		Format: committed.Format, Errors: committed.Errors,
		CashInserted: cashInserted, SetupsUpserted: setupsUpserted,
	})
}

func (s *Server) applyJSONAccountMeta(ctx context.Context, userID, accountID string, meta *importer.JSONAccountMeta) error {
	if meta == nil {
		return nil
	}
	acc, err := s.deps.Store.GetAccount(ctx, store.GetAccountParams{ID: accountID, UserID: userID})
	if err != nil {
		return err
	}
	name := acc.Name
	broker := acc.Broker
	accountType := acc.AccountType
	baseCurrency := acc.BaseCurrency
	startingBalance := acc.StartingBalance
	changed := false

	if meta.Name != "" && meta.Name != name {
		name = meta.Name
		changed = true
	}
	if meta.Broker != "" && meta.Broker != broker {
		broker = meta.Broker
		changed = true
	}
	if meta.AccountType != "" && meta.AccountType != accountType {
		accountType = meta.AccountType
		changed = true
	}
	if meta.BaseCurrency != "" && meta.BaseCurrency != baseCurrency {
		baseCurrency = meta.BaseCurrency
		changed = true
	}
	if meta.StartingBalance != nil && *meta.StartingBalance != startingBalance {
		startingBalance = *meta.StartingBalance
		changed = true
	}
	if !changed {
		return nil
	}
	_, err = s.deps.Store.UpdateAccount(ctx, store.UpdateAccountParams{
		Name: name, Broker: broker, AccountType: accountType,
		BaseCurrency: baseCurrency, StartingBalance: startingBalance,
		ID: accountID, UserID: userID,
	})
	return err
}

func (s *Server) applyJSONCashTransactions(
	ctx context.Context,
	userID, accountID string,
	batchID sql.NullString,
	rows []importer.JSONCashTx,
) (int, error) {
	if len(rows) == 0 {
		return 0, nil
	}
	inserted := 0
	for _, row := range rows {
		if !validCashTypes[row.Type] {
			continue
		}
		if _, err := s.deps.Store.InsertCashTransaction(ctx, store.InsertCashTransactionParams{
			ID: uuid.NewString(), UserID: userID, AccountID: accountID,
			Type: row.Type, Amount: row.Amount, Currency: row.Currency,
			OccurredAt: row.OccurredAt, Note: row.Note, ImportBatchID: batchID,
		}); err != nil {
			return inserted, err
		}
		inserted++
	}
	return inserted, nil
}

func journalOptionOverrides(c echo.Context) *importer.JournalParseOptions {
	raw := c.FormValue("journal_option_overrides")
	if raw == "" {
		return nil
	}
	rawOverrides := map[string]string{}
	if err := json.Unmarshal([]byte(raw), &rawOverrides); err != nil {
		return nil
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
	if len(overrides) == 0 {
		return nil
	}
	return &importer.JournalParseOptions{OptionRightByRow: overrides}
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
