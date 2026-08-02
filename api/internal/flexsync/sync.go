package flexsync

import (
	"context"
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/tradermemos/api/internal/importer"
	"github.com/tradermemos/api/internal/store"
)

// Result summarizes one account sync.
type Result struct {
	Inserted int `json:"inserted"`
	Skipped  int `json:"skipped"`
	Trades   int `json:"trades"`
	Rows     int `json:"rows"`
}

// Summary is the human-readable status line stored on the settings row.
func (r Result) Summary() string {
	return fmt.Sprintf("%d new, %d duplicate of %d rows", r.Inserted, r.Skipped, r.Rows)
}

// Sync fetches one account's Flex statement and runs it through the standard
// import pipeline (broker preset mapping → dedup → commit → regroup),
// recording an import batch for history. The statement must be a CSV Flex
// Query containing the Trades → Executions section.
func Sync(ctx context.Context, q store.Querier, client *Client, s store.FlexSyncSetting) (Result, error) {
	data, err := client.FetchStatement(ctx, s.Token, s.QueryID)
	if err != nil {
		return Result{}, err
	}
	headers, rows, err := parseCSV(data)
	if err != nil {
		return Result{}, fmt.Errorf("statement is not parseable CSV — set the Flex Query format to CSV: %w", err)
	}
	name, mapping, ok := importer.MatchBroker(headers)
	if !ok || !strings.Contains(strings.ToLower(name), "interactive brokers") {
		return Result{}, errors.New("statement did not match the IBKR executions layout — include the Trades → Executions section in the Flex Query")
	}

	mappingJSON, _ := json.Marshal(mapping)
	batch, err := q.CreateImportBatch(ctx, store.CreateImportBatchParams{
		ID: uuid.NewString(), UserID: s.UserID, AccountID: s.AccountID,
		Source: "ibkr-flex-sync",
		Filename: sql.NullString{
			String: fmt.Sprintf("flex-%s-%s.csv", s.QueryID, time.Now().UTC().Format("20060102-150405")),
			Valid:  true,
		},
		ColumnMapping: sql.NullString{String: string(mappingJSON), Valid: true},
		RowCount:      int64(len(rows)),
		Status:        "pending",
	})
	if err != nil {
		return Result{}, fmt.Errorf("create batch: %w", err)
	}

	parsed := importer.NewGeneric(mapping).ParseRows(rows)
	parsed.Format = "executions"
	committed, err := importer.Commit(ctx, q, s.UserID, s.AccountID,
		sql.NullString{String: batch.ID, Valid: true}, parsed)
	if err != nil {
		return Result{}, fmt.Errorf("commit: %w", err)
	}
	if err := q.SetImportBatchStatus(ctx, store.SetImportBatchStatusParams{
		Status: "committed", ID: batch.ID, UserID: s.UserID,
	}); err != nil {
		return Result{}, fmt.Errorf("finalize batch: %w", err)
	}

	return Result{
		Inserted: committed.Inserted, Skipped: committed.Skipped,
		Trades: committed.Trades, Rows: len(rows),
	}, nil
}

// RecordOutcome persists the sync outcome onto the settings row.
func RecordOutcome(ctx context.Context, q store.Querier, s store.FlexSyncSetting, res Result, syncErr error) {
	status, errMsg := res.Summary(), ""
	if syncErr != nil {
		status, errMsg = "error", syncErr.Error()
	}
	_ = q.UpdateFlexSyncStatus(ctx, store.UpdateFlexSyncStatusParams{
		LastSyncedAt: sql.NullTime{Time: time.Now().UTC(), Valid: true},
		LastStatus:   status,
		LastError:    errMsg,
		AccountID:    s.AccountID,
		UserID:       s.UserID,
	})
}

func parseCSV(data []byte) (headers []string, rows []map[string]string, err error) {
	r := csv.NewReader(strings.NewReader(strings.TrimPrefix(string(data), "\ufeff")))
	r.FieldsPerRecord = -1
	records, err := r.ReadAll()
	if err != nil {
		return nil, nil, err
	}
	if len(records) < 1 {
		return nil, nil, errors.New("empty statement")
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
