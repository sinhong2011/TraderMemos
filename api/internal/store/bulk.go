package store

import (
	"context"
	"strconv"
	"strings"
)

// BulkWriter is the optional set-at-a-time counterpart to the row-at-a-time
// sqlc methods. Imports and regroups write thousands of rows; one round trip
// per row is fine against local SQLite and ruinous against a hosted Postgres
// where every statement costs a network hop.
//
// Both concrete stores implement it. The Bulk* package functions below take a
// plain Querier and fall back to the row-at-a-time methods when it does not,
// so mocks and partial fakes keep working — same shape as TxRunner / InTx.
type BulkWriter interface {
	InsertExecutionsBulk(ctx context.Context, rows []InsertExecutionParams) error
	ExistingDedupHashesBulk(ctx context.Context, accountID string, hashes []string) (map[string]struct{}, error)
	UpsertTradesBulk(ctx context.Context, rows []UpsertTradeParams) error
	ClearTradeExecutionsBulk(ctx context.Context, tradeIDs []string) error
	LinkTradeExecutionsBulk(ctx context.Context, rows []LinkTradeExecutionParams) error
	UpsertTradeJournalsBulk(ctx context.Context, rows []UpsertTradeJournalParams) error
	SetTradeTagsBulk(ctx context.Context, rows []SetTradeTagsParams) error
}

// BulkInsertExecutions inserts executions in as few statements as the driver allows.
func BulkInsertExecutions(ctx context.Context, q Querier, rows []InsertExecutionParams) error {
	if b, ok := q.(BulkWriter); ok {
		return b.InsertExecutionsBulk(ctx, rows)
	}
	for _, r := range rows {
		if _, err := q.InsertExecution(ctx, r); err != nil {
			return err
		}
	}
	return nil
}

// BulkExistingDedupHashes reports which of hashes already exist on the account.
// Replaces one ExecutionExists round trip per incoming fill.
func BulkExistingDedupHashes(ctx context.Context, q Querier, accountID string, hashes []string) (map[string]struct{}, error) {
	if b, ok := q.(BulkWriter); ok {
		return b.ExistingDedupHashesBulk(ctx, accountID, hashes)
	}
	out := map[string]struct{}{}
	for _, h := range hashes {
		n, err := q.ExecutionExists(ctx, ExecutionExistsParams{AccountID: accountID, DedupHash: h})
		if err != nil {
			return nil, err
		}
		if n == 1 {
			out[h] = struct{}{}
		}
	}
	return out, nil
}

// BulkUpsertTrades upserts trades by id.
func BulkUpsertTrades(ctx context.Context, q Querier, rows []UpsertTradeParams) error {
	if b, ok := q.(BulkWriter); ok {
		return b.UpsertTradesBulk(ctx, rows)
	}
	for _, r := range rows {
		if err := q.UpsertTrade(ctx, r); err != nil {
			return err
		}
	}
	return nil
}

// BulkClearTradeExecutions drops the execution links of every listed trade.
func BulkClearTradeExecutions(ctx context.Context, q Querier, tradeIDs []string) error {
	if b, ok := q.(BulkWriter); ok {
		return b.ClearTradeExecutionsBulk(ctx, tradeIDs)
	}
	for _, id := range tradeIDs {
		if err := q.ClearTradeExecutions(ctx, id); err != nil {
			return err
		}
	}
	return nil
}

// BulkLinkTradeExecutions links executions to trades.
func BulkLinkTradeExecutions(ctx context.Context, q Querier, rows []LinkTradeExecutionParams) error {
	if b, ok := q.(BulkWriter); ok {
		return b.LinkTradeExecutionsBulk(ctx, rows)
	}
	for _, r := range rows {
		if err := q.LinkTradeExecution(ctx, r); err != nil {
			return err
		}
	}
	return nil
}

// BulkUpsertTradeJournals upserts journal rows by trade id.
func BulkUpsertTradeJournals(ctx context.Context, q Querier, rows []UpsertTradeJournalParams) error {
	if b, ok := q.(BulkWriter); ok {
		return b.UpsertTradeJournalsBulk(ctx, rows)
	}
	for _, r := range rows {
		if err := q.UpsertTradeJournal(ctx, r); err != nil {
			return err
		}
	}
	return nil
}

// BulkSetTradeTags links tags to trades, ignoring links that already exist.
func BulkSetTradeTags(ctx context.Context, q Querier, rows []SetTradeTagsParams) error {
	if b, ok := q.(BulkWriter); ok {
		return b.SetTradeTagsBulk(ctx, rows)
	}
	for _, r := range rows {
		if err := q.SetTradeTags(ctx, r); err != nil {
			return err
		}
	}
	return nil
}

// --- statement building ------------------------------------------------------

// bulkDialect is everything the generic builders need to know about a driver:
// how to write the nth bind marker, and how many markers one statement may carry.
type bulkDialect struct {
	placeholder func(n int) string
	maxParams   int
}

func qmark(int) string { return "?" }

func dollar(n int) string { return "$" + strconv.Itoa(n) }

// SQLite's compiled-in variable ceiling is 32766 on current builds but 999 on
// older ones; 900 is safe everywhere and still collapses a 370-fill import into
// single-digit statements.
var sqliteBulk = bulkDialect{placeholder: qmark, maxParams: 900}

// Postgres' wire protocol caps parameters at 65535 per statement.
var postgresBulk = bulkDialect{placeholder: dollar, maxParams: 60000}

// execValues runs `prefix VALUES (…),(…) suffix`, splitting into as many
// statements as the parameter ceiling requires. rowExtra is written inside each
// tuple after the bind markers, for columns the query fills with a literal
// (an empty string, CURRENT_TIMESTAMP).
func execValues(ctx context.Context, db DBTX, d bulkDialect, prefix, rowExtra, suffix string, rows [][]any) error {
	if len(rows) == 0 {
		return nil
	}
	perRow := len(rows[0])
	if perRow == 0 {
		return nil
	}
	chunk := max(d.maxParams/perRow, 1)

	for start := 0; start < len(rows); start += chunk {
		end := min(start+chunk, len(rows))
		var b strings.Builder
		b.WriteString(prefix)
		b.WriteString(" VALUES ")
		args := make([]any, 0, (end-start)*perRow)
		for i := start; i < end; i++ {
			if i > start {
				b.WriteString(",")
			}
			b.WriteString("(")
			for j := range rows[i] {
				if j > 0 {
					b.WriteString(",")
				}
				b.WriteString(d.placeholder(len(args) + j + 1))
			}
			b.WriteString(rowExtra)
			b.WriteString(")")
			args = append(args, rows[i]...)
		}
		b.WriteString(suffix)
		if _, err := db.ExecContext(ctx, b.String(), args...); err != nil {
			return err
		}
	}
	return nil
}

// execIn runs `prefix (…)` with one bind marker per value, chunked. leading are
// fixed arguments bound before the list on every chunk.
func execIn(ctx context.Context, db DBTX, d bulkDialect, prefix string, leading []any, values []string) error {
	if len(values) == 0 {
		return nil
	}
	chunk := max(d.maxParams-len(leading), 1)
	for start := 0; start < len(values); start += chunk {
		end := min(start+chunk, len(values))
		stmt, args := inClause(d, prefix, leading, values[start:end])
		if _, err := db.ExecContext(ctx, stmt, args...); err != nil {
			return err
		}
	}
	return nil
}

func inClause(d bulkDialect, prefix string, leading []any, values []string) (string, []any) {
	args := make([]any, 0, len(leading)+len(values))
	args = append(args, leading...)
	var b strings.Builder
	b.WriteString(prefix)
	b.WriteString(" (")
	for i, v := range values {
		if i > 0 {
			b.WriteString(",")
		}
		b.WriteString(d.placeholder(len(leading) + i + 1))
		args = append(args, v)
	}
	b.WriteString(")")
	return b.String(), args
}

// queryDedupHashes returns the subset of hashes present on the account.
func queryDedupHashes(ctx context.Context, db DBTX, d bulkDialect, accountID string, hashes []string) (map[string]struct{}, error) {
	out := make(map[string]struct{}, len(hashes))
	if len(hashes) == 0 {
		return out, nil
	}
	prefix := "SELECT dedup_hash FROM executions WHERE account_id = " + d.placeholder(1) + " AND dedup_hash IN"
	chunk := max(d.maxParams-1, 1)
	for start := 0; start < len(hashes); start += chunk {
		end := min(start+chunk, len(hashes))
		stmt, args := inClause(d, prefix, []any{accountID}, hashes[start:end])
		rows, err := db.QueryContext(ctx, stmt, args...)
		if err != nil {
			return nil, err
		}
		for rows.Next() {
			var h string
			if err := rows.Scan(&h); err != nil {
				rows.Close()
				return nil, err
			}
			out[h] = struct{}{}
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			return nil, err
		}
		rows.Close()
	}
	return out, nil
}

// --- shared row shapes -------------------------------------------------------
//
// Column lists and conflict clauses mirror queries/*.sql and queries_pg/*.sql.
// Keep them in step when those change.

const (
	insertExecutionsPrefix = `INSERT INTO executions (id, user_id, account_id, external_id, symbol, instrument_type, side,
    quantity, price, fees, commission, executed_at, multiplier, details, import_batch_id, dedup_hash)`

	upsertTradesPrefix = `INSERT INTO trades (id, user_id, account_id, symbol, instrument_type, direction, status,
    opened_at, closed_at, qty_opened, qty_remaining, avg_entry_price, avg_exit_price, gross_pnl, fees_total,
    net_pnl, pnl_currency, return_pct, r_multiple, time_in_trade_secs, notes)`

	upsertTradesConflict = ` ON CONFLICT(id) DO UPDATE SET
    account_id = excluded.account_id, symbol = excluded.symbol,
    instrument_type = excluded.instrument_type, direction = excluded.direction,
    status = excluded.status, opened_at = excluded.opened_at, closed_at = excluded.closed_at,
    qty_opened = excluded.qty_opened, qty_remaining = excluded.qty_remaining,
    avg_entry_price = excluded.avg_entry_price,
    avg_exit_price = excluded.avg_exit_price, gross_pnl = excluded.gross_pnl,
    fees_total = excluded.fees_total, net_pnl = excluded.net_pnl,
    pnl_currency = excluded.pnl_currency, return_pct = excluded.return_pct,
    time_in_trade_secs = excluded.time_in_trade_secs, updated_at = CURRENT_TIMESTAMP`

	upsertTradeJournalsPrefix = `INSERT INTO trade_journal (
    trade_id, user_id, notes, setup_id, initial_risk, target_price, stop_price,
    emotional_state, confidence, trade_quality, mae, mfe,
    post_exit_mae, post_exit_mfe, updated_at)`

	upsertTradeJournalsConflict = ` ON CONFLICT(trade_id) DO UPDATE SET
    notes = excluded.notes,
    setup_id = excluded.setup_id,
    initial_risk = excluded.initial_risk,
    target_price = excluded.target_price,
    stop_price = excluded.stop_price,
    emotional_state = excluded.emotional_state,
    confidence = excluded.confidence,
    trade_quality = excluded.trade_quality,
    mae = excluded.mae,
    mfe = excluded.mfe,
    post_exit_mae = excluded.post_exit_mae,
    post_exit_mfe = excluded.post_exit_mfe,
    updated_at = CURRENT_TIMESTAMP`

	linkTradeExecutionsPrefix = `INSERT INTO trade_executions (trade_id, execution_id)`

	setTradeTagsPrefix   = `INSERT INTO trade_tags (trade_id, tag_id)`
	setTradeTagsConflict = ` ON CONFLICT (trade_id, tag_id) DO NOTHING`

	clearTradeExecutionsPrefix = `DELETE FROM trade_executions WHERE trade_id IN`
)

func executionRows(rows []InsertExecutionParams) [][]any {
	out := make([][]any, len(rows))
	for i, r := range rows {
		out[i] = []any{
			r.ID, r.UserID, r.AccountID, r.ExternalID, r.Symbol, r.InstrumentType, r.Side,
			r.Quantity, r.Price, r.Fees, r.Commission, r.ExecutedAt, r.Multiplier, r.Details,
			r.ImportBatchID, r.DedupHash,
		}
	}
	return out
}

// tradeRows drops all but the last row for a repeated id: Postgres rejects a
// multi-row ON CONFLICT DO UPDATE that touches the same row twice.
func tradeRows(rows []UpsertTradeParams) [][]any {
	rows = lastPerKey(rows, func(r UpsertTradeParams) string { return r.ID })
	out := make([][]any, len(rows))
	for i, r := range rows {
		out[i] = []any{
			r.ID, r.UserID, r.AccountID, r.Symbol, r.InstrumentType, r.Direction, r.Status,
			r.OpenedAt, r.ClosedAt, r.QtyOpened, r.QtyRemaining, r.AvgEntryPrice, r.AvgExitPrice,
			r.GrossPnl, r.FeesTotal, r.NetPnl, r.PnlCurrency, r.ReturnPct, r.RMultiple,
			r.TimeInTradeSecs,
		}
	}
	return out
}

func tradeJournalRows(rows []UpsertTradeJournalParams) [][]any {
	rows = lastPerKey(rows, func(r UpsertTradeJournalParams) string { return r.TradeID })
	out := make([][]any, len(rows))
	for i, r := range rows {
		out[i] = []any{
			r.TradeID, r.UserID, r.Notes, r.SetupID, r.InitialRisk, r.TargetPrice, r.StopPrice,
			r.EmotionalState, r.Confidence, r.TradeQuality, r.Mae, r.Mfe, r.PostExitMae, r.PostExitMfe,
		}
	}
	return out
}

func linkRows(rows []LinkTradeExecutionParams) [][]any {
	out := make([][]any, len(rows))
	for i, r := range rows {
		out[i] = []any{r.TradeID, r.ExecutionID}
	}
	return out
}

// tagRows also de-duplicates: ON CONFLICT DO NOTHING tolerates a clashing row
// already in the table, but not the same pair twice inside one statement.
func tagRows(rows []SetTradeTagsParams) [][]any {
	rows = lastPerKey(rows, func(r SetTradeTagsParams) string { return r.TradeID + "\x00" + r.TagID })
	out := make([][]any, len(rows))
	for i, r := range rows {
		out[i] = []any{r.TradeID, r.TagID}
	}
	return out
}

// lastPerKey keeps one entry per key — the last one wins, matching the
// row-at-a-time path where a later write overwrites an earlier one.
func lastPerKey[T any](rows []T, key func(T) string) []T {
	at := make(map[string]int, len(rows))
	out := make([]T, 0, len(rows))
	for _, r := range rows {
		k := key(r)
		if i, ok := at[k]; ok {
			out[i] = r
			continue
		}
		at[k] = len(out)
		out = append(out, r)
	}
	return out
}

// --- SQLite ------------------------------------------------------------------

var _ BulkWriter = (*Queries)(nil)

func (q *Queries) InsertExecutionsBulk(ctx context.Context, rows []InsertExecutionParams) error {
	return execValues(ctx, q.db, sqliteBulk, insertExecutionsPrefix, "", "", executionRows(rows))
}

func (q *Queries) ExistingDedupHashesBulk(ctx context.Context, accountID string, hashes []string) (map[string]struct{}, error) {
	return queryDedupHashes(ctx, q.db, sqliteBulk, accountID, hashes)
}

func (q *Queries) UpsertTradesBulk(ctx context.Context, rows []UpsertTradeParams) error {
	return execValues(ctx, q.db, sqliteBulk, upsertTradesPrefix, ", ''", upsertTradesConflict, tradeRows(rows))
}

func (q *Queries) ClearTradeExecutionsBulk(ctx context.Context, tradeIDs []string) error {
	return execIn(ctx, q.db, sqliteBulk, clearTradeExecutionsPrefix, nil, tradeIDs)
}

func (q *Queries) LinkTradeExecutionsBulk(ctx context.Context, rows []LinkTradeExecutionParams) error {
	return execValues(ctx, q.db, sqliteBulk, linkTradeExecutionsPrefix, "", "", linkRows(rows))
}

func (q *Queries) UpsertTradeJournalsBulk(ctx context.Context, rows []UpsertTradeJournalParams) error {
	return execValues(ctx, q.db, sqliteBulk, upsertTradeJournalsPrefix, ", CURRENT_TIMESTAMP",
		upsertTradeJournalsConflict, tradeJournalRows(rows))
}

func (q *Queries) SetTradeTagsBulk(ctx context.Context, rows []SetTradeTagsParams) error {
	return execValues(ctx, q.db, sqliteBulk, setTradeTagsPrefix, "", setTradeTagsConflict, tagRows(rows))
}

// --- Postgres ----------------------------------------------------------------

var _ BulkWriter = (*PG)(nil)

func (p *PG) InsertExecutionsBulk(ctx context.Context, rows []InsertExecutionParams) error {
	return execValues(ctx, p.db, postgresBulk, insertExecutionsPrefix, "", "", executionRows(rows))
}

func (p *PG) ExistingDedupHashesBulk(ctx context.Context, accountID string, hashes []string) (map[string]struct{}, error) {
	return queryDedupHashes(ctx, p.db, postgresBulk, accountID, hashes)
}

func (p *PG) UpsertTradesBulk(ctx context.Context, rows []UpsertTradeParams) error {
	return execValues(ctx, p.db, postgresBulk, upsertTradesPrefix, ", ''", upsertTradesConflict, tradeRows(rows))
}

func (p *PG) ClearTradeExecutionsBulk(ctx context.Context, tradeIDs []string) error {
	return execIn(ctx, p.db, postgresBulk, clearTradeExecutionsPrefix, nil, tradeIDs)
}

func (p *PG) LinkTradeExecutionsBulk(ctx context.Context, rows []LinkTradeExecutionParams) error {
	return execValues(ctx, p.db, postgresBulk, linkTradeExecutionsPrefix, "", "", linkRows(rows))
}

func (p *PG) UpsertTradeJournalsBulk(ctx context.Context, rows []UpsertTradeJournalParams) error {
	return execValues(ctx, p.db, postgresBulk, upsertTradeJournalsPrefix, ", CURRENT_TIMESTAMP",
		upsertTradeJournalsConflict, tradeJournalRows(rows))
}

func (p *PG) SetTradeTagsBulk(ctx context.Context, rows []SetTradeTagsParams) error {
	return execValues(ctx, p.db, postgresBulk, setTradeTagsPrefix, "", setTradeTagsConflict, tagRows(rows))
}
