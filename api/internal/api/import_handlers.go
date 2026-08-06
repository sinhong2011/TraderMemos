package api

import (
	"context"
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/importer"
	"github.com/tradermemos/api/internal/store"
)

func (s *Server) importRoutes(g *echo.Group) {
	g.POST("/imports", s.handleImportPreview)
	// Fresh commit (no preview batch) — used when JSON account creation is deferred to confirm.
	g.POST("/imports/commit", s.handleImportCommitFresh)
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
	ctx := c.Request().Context()
	if s.deps.ImportMaxBytes > 0 && c.Request().ContentLength > s.deps.ImportMaxBytes {
		return Fail(http.StatusRequestEntityTooLarge, "too_large", "upload exceeds size limit", nil)
	}
	fh, err := c.FormFile("file")
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "file is required", nil)
	}
	loaded, err := loadImportFile(fh)
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "could not parse upload", err.Error())
	}

	accountID := strings.TrimSpace(c.FormValue("account_id"))
	var pendingAccount *importer.JSONAccountMeta
	if accountID == "" {
		matched, pending, rerr := s.matchJSONImportAccount(ctx, uid, loaded)
		if rerr != nil {
			return rerr
		}
		accountID = matched
		pendingAccount = pending
	} else if err := s.assertAccount(ctx, uid, accountID); err != nil {
		return Fail(http.StatusNotFound, "not_found", "account not found", nil)
	}

	source := loaded.Source
	rowCount := len(loaded.Rows)
	if source == "json" && rowCount == 0 {
		rowCount = len(loaded.JSON.Result.Executions)
		if loaded.Format == "journal_trades" {
			rowCount = importer.CountJournalTrades(loaded.JSON.Result.Executions)
		}
	}
	sample := loaded.Rows
	if len(sample) > 5 {
		sample = sample[:5]
	}
	suggested := importer.SuggestMapping(loaded.Headers)
	detectedBroker := ""
	suggestedTZ := ""
	if loaded.Format == "journal_trades" {
		suggested = map[string]string{}
	} else if name, presetMap, presetTZ, ok := importer.MatchBroker(loaded.Headers); ok {
		// A recognized broker export beats header-substring guessing.
		for field, header := range presetMap {
			suggested[field] = header
		}
		detectedBroker = name
		suggestedTZ = presetTZ
	}
	resp := map[string]any{
		"headers":           loaded.Headers,
		"sample_rows":       sample,
		"suggested_mapping": suggested,
		"detected_broker":   detectedBroker,
		// IANA zone the file's offset-less timestamps are assumed to be in;
		// clients may override with the source_tz form value on commit.
		"suggested_source_tz": suggestedTZ,
		"format":              loaded.Format,
		"source":              source,
		"row_count":           rowCount,
		// Preview is parse-only — batch is created on confirm.
		"import_batch_id": "",
	}
	if loaded.Format == "journal_trades" {
		summary, sampleTrades := importer.BuildJournalPreview(loaded.Rows)
		resp["journal_summary"] = summary
		resp["sample_trades"] = sampleTrades
	}

	if accountID == "" && pendingAccount != nil {
		resp["account_id"] = ""
		resp["pending_account"] = pendingAccountJSON(pendingAccount)
		return c.JSON(http.StatusOK, resp)
	}

	resp["account_id"] = accountID
	return c.JSON(http.StatusOK, resp)
}

func pendingAccountJSON(meta *importer.JSONAccountMeta) map[string]any {
	out := map[string]any{
		"name":          strings.TrimSpace(meta.Name),
		"broker":        strings.TrimSpace(meta.Broker),
		"account_type":  strings.TrimSpace(meta.AccountType),
		"base_currency": strings.TrimSpace(meta.BaseCurrency),
	}
	if meta.StartingBalance != nil {
		out["starting_balance"] = *meta.StartingBalance
	}
	return out
}

// matchJSONImportAccount matches an existing account from JSON metadata.
// If none match, returns pending metadata for deferred creation on confirm.
// CSV uploads still require account_id.
func (s *Server) matchJSONImportAccount(ctx context.Context, userID string, loaded loadedImport) (matchedID string, pending *importer.JSONAccountMeta, err error) {
	if loaded.Source != "json" || loaded.JSON.Account == nil || strings.TrimSpace(loaded.JSON.Account.Name) == "" {
		return "", nil, Fail(http.StatusBadRequest, "bad_request", "account_id is required", nil)
	}
	meta := loaded.JSON.Account
	name := strings.TrimSpace(meta.Name)
	broker := strings.TrimSpace(meta.Broker)

	accs, err := s.deps.Store.ListAccounts(ctx, userID)
	if err != nil {
		return "", nil, Fail(http.StatusInternalServerError, "internal", "could not list accounts", nil)
	}
	var nameMatch *store.Account
	for i := range accs {
		acc := &accs[i]
		if !strings.EqualFold(strings.TrimSpace(acc.Name), name) {
			continue
		}
		if broker != "" && strings.EqualFold(strings.TrimSpace(acc.Broker), broker) {
			return acc.ID, nil, nil
		}
		if nameMatch == nil {
			nameMatch = acc
		}
	}
	if nameMatch != nil {
		return nameMatch.ID, nil, nil
	}
	return "", meta, nil
}

func (s *Server) createAccountFromJSONMeta(ctx context.Context, userID string, meta *importer.JSONAccountMeta) (store.Account, error) {
	if meta == nil || strings.TrimSpace(meta.Name) == "" {
		return store.Account{}, Fail(http.StatusBadRequest, "bad_request", "account metadata is required", nil)
	}
	name := strings.TrimSpace(meta.Name)
	broker := strings.TrimSpace(meta.Broker)
	accountType := strings.TrimSpace(meta.AccountType)
	if accountType == "" {
		accountType = "cash"
	}
	baseCurrency := strings.TrimSpace(meta.BaseCurrency)
	if baseCurrency == "" {
		baseCurrency = "USD"
	}
	var startingBalance float64
	if meta.StartingBalance != nil {
		startingBalance = *meta.StartingBalance
	}
	acc, err := s.deps.Store.CreateAccount(ctx, store.CreateAccountParams{
		ID: uuid.NewString(), UserID: userID, Name: name, Broker: broker,
		AccountType: accountType, BaseCurrency: baseCurrency, StartingBalance: startingBalance,
	})
	if err != nil {
		return store.Account{}, Fail(http.StatusInternalServerError, "internal", "could not create account from import", nil)
	}
	if err := s.ensureOpeningDeposit(ctx, s.deps.Store, userID, acc); err != nil {
		return store.Account{}, Fail(http.StatusInternalServerError, "internal", "account created but opening deposit failed", nil)
	}
	return acc, nil
}

type importResult struct {
	Inserted       int                 `json:"inserted"`
	Skipped        int                 `json:"skipped"`
	Annotated      int                 `json:"annotated"`
	Trades         int                 `json:"trades"`
	CashInserted   int                 `json:"cash_inserted"`
	SetupsUpserted int                 `json:"setups_upserted"`
	Format         string              `json:"format"`
	AccountID      string              `json:"account_id,omitempty"`
	Errors         []importer.RowError `json:"errors"`
}

// handleImportCommitFresh creates account (if needed) + batch, then commits in one step.
// Web uses this after a parse-only preview (no pending batch).
func (s *Server) handleImportCommitFresh(c echo.Context) error {
	ctx := c.Request().Context()
	uid := auth.UserID(c)
	if s.deps.ImportMaxBytes > 0 && c.Request().ContentLength > s.deps.ImportMaxBytes {
		return Fail(http.StatusRequestEntityTooLarge, "too_large", "upload exceeds size limit", nil)
	}
	fh, err := c.FormFile("file")
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "file is required", nil)
	}
	loaded, err := loadImportFile(fh)
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "could not parse upload", err.Error())
	}

	accountID := strings.TrimSpace(c.FormValue("account_id"))
	if accountID == "" {
		matched, pending, rerr := s.matchJSONImportAccount(ctx, uid, loaded)
		if rerr != nil {
			return rerr
		}
		if matched != "" {
			accountID = matched
		} else {
			acc, cerr := s.createAccountFromJSONMeta(ctx, uid, pending)
			if cerr != nil {
				return cerr
			}
			accountID = acc.ID
		}
	} else if err := s.assertAccount(ctx, uid, accountID); err != nil {
		return Fail(http.StatusNotFound, "not_found", "account not found", nil)
	}

	rowCount := len(loaded.Rows)
	if loaded.Source == "json" && rowCount == 0 {
		rowCount = len(loaded.JSON.Result.Executions)
		if loaded.Format == "journal_trades" {
			rowCount = importer.CountJournalTrades(loaded.JSON.Result.Executions)
		}
	}
	batch, err := s.deps.Store.CreateImportBatch(ctx, store.CreateImportBatchParams{
		ID: uuid.NewString(), UserID: uid, AccountID: accountID, Source: loaded.Source,
		Filename: sql.NullString{String: fh.Filename, Valid: true},
		RowCount: int64(rowCount), Status: "pending",
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not create import batch", nil)
	}
	return s.finishImportCommit(c, uid, batch, loaded)
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
	return s.finishImportCommit(c, uid, batch, loaded)
}

func (s *Server) finishImportCommit(c echo.Context, uid string, batch store.ImportBatch, loaded loadedImport) error {
	// The upload is fully read by now. Detach from the request context so a
	// client or proxy disconnect (e.g. a 120s proxy timeout on a large file)
	// cannot cancel the import halfway through.
	ctx := context.WithoutCancel(c.Request().Context())

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
		sourceTZ := strings.TrimSpace(c.FormValue("source_tz"))
		if sourceTZ != "" {
			if _, err := time.LoadLocation(sourceTZ); err != nil {
				return Fail(http.StatusBadRequest, "bad_request", "invalid 'source_tz' (want IANA timezone name)", nil)
			}
		} else if _, _, presetTZ, ok := importer.MatchBroker(loaded.Headers); ok {
			// No explicit override: naive broker times are the broker's wall
			// clock (US Eastern / exchange time), not UTC.
			sourceTZ = presetTZ
		}
		parsed = importer.NewGeneric(mapping).WithSourceTZ(sourceTZ).ParseRows(loaded.Rows)
		parsed.Format = "executions"
	}

	var committed importer.CommitResult
	setupsUpserted := 0
	cashInserted := 0
	// One transaction for the whole commit: a failure anywhere leaves no
	// partial rows behind, and SQLite pays a single fsync instead of one per row.
	err := store.InTx(ctx, s.deps.Store, func(q store.Querier) error {
		if loaded.Source == "json" {
			// Restore playbook catalog first so trade annotations link to full setups.
			n, err := importer.UpsertSetups(ctx, q, uid, loaded.JSON.Setups)
			if err != nil {
				return fmt.Errorf("upsert setups: %w", err)
			}
			setupsUpserted = n
		}

		var err error
		committed, err = importer.Commit(ctx, q, uid, batch.AccountID,
			sql.NullString{String: batch.ID, Valid: true}, parsed)
		if err != nil {
			return fmt.Errorf("commit executions: %w", err)
		}

		if loaded.Source == "json" {
			if err := s.applyJSONAccountMeta(ctx, q, uid, batch.AccountID, loaded.JSON.Account); err != nil {
				return fmt.Errorf("apply account metadata: %w", err)
			}
			cashInserted, err = s.applyJSONCashTransactions(ctx, q, uid, batch.AccountID,
				sql.NullString{String: batch.ID, Valid: true}, loaded.JSON.Cash)
			if err != nil {
				return fmt.Errorf("import cash transactions: %w", err)
			}
			acc, err := q.GetAccount(ctx, store.GetAccountParams{ID: batch.AccountID, UserID: uid})
			if err == nil {
				if err := s.ensureOpeningDeposit(ctx, q, uid, acc); err != nil {
					return fmt.Errorf("seed opening deposit: %w", err)
				}
			}
		}

		if err := q.SetImportBatchStatus(ctx, store.SetImportBatchStatusParams{Status: "committed", ID: batch.ID, UserID: uid}); err != nil {
			return fmt.Errorf("finalize batch: %w", err)
		}
		return nil
	})
	if err != nil {
		// The transaction rolled back; leave a marker so the batch is not retried as pending.
		_ = s.deps.Store.SetImportBatchStatus(ctx, store.SetImportBatchStatusParams{Status: "failed", ID: batch.ID, UserID: uid})
		return Fail(http.StatusInternalServerError, "internal", "could not import", err.Error())
	}
	return c.JSON(http.StatusOK, importResult{
		Inserted: committed.Inserted, Skipped: committed.Skipped,
		Annotated: committed.Annotated, Trades: committed.Trades,
		Format: committed.Format, Errors: committed.Errors,
		CashInserted: cashInserted, SetupsUpserted: setupsUpserted,
		AccountID: batch.AccountID,
	})
}

func (s *Server) applyJSONAccountMeta(ctx context.Context, q store.Querier, userID, accountID string, meta *importer.JSONAccountMeta) error {
	if meta == nil {
		return nil
	}
	acc, err := q.GetAccount(ctx, store.GetAccountParams{ID: accountID, UserID: userID})
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
	_, err = q.UpdateAccount(ctx, store.UpdateAccountParams{
		Name: name, Broker: broker, AccountType: accountType,
		BaseCurrency: baseCurrency, StartingBalance: startingBalance,
		ID: accountID, UserID: userID,
	})
	return err
}

func (s *Server) applyJSONCashTransactions(
	ctx context.Context,
	q store.Querier,
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
		if _, err := q.InsertCashTransaction(ctx, store.InsertCashTransactionParams{
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
