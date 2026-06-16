# TraderMemos Phase 2A — Backend Additions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the backend capabilities the Phase 2 web journal needs — durable trade identity so journaling survives re-imports, a `trade_journal` (notes/setup/risk), playbook setups, mistake tags, screenshot attachments, breakdown reports, R-multiple, and an enriched trade-detail payload — plus the Phase-1 review follow-ups.

**Architecture:** Extends the existing Go/Echo/sqlc/SQLite backend under `api/`. The central change is making a trade's primary key its **opening execution's id** so `Regroup` can **upsert computed fields and prune removed trades** instead of delete-and-recreate, letting `trade_journal`, `trade_tags`, and `trade_attachments` (all keyed by `trade_id`) survive re-imports. New domain packages: `internal/storage` (pluggable attachment store). Analytics gains a `Breakdown`.

**Tech Stack:** Go 1.26, Echo v4, sqlc, golang-migrate, modernc.org/sqlite, testify (all already in the repo).

**Spec:** `docs/superpowers/specs/2026-06-16-phase2-web-journal-design.md`

**Conventions (already established in Phase 1 — follow them):**
- Migrations live ONLY in `api/internal/db/migrations/` (single embedded dir). After adding `.sql` queries, run `sqlc generate` from `api/`.
- Handlers follow the pattern in `api/internal/api/account_handlers.go`: read `auth.UserID(c)`, validate, call `s.deps.Store`, return JSON via the uniform `Fail(...)` envelope; lists never return `null`.
- Account-ownership guard exists: `s.assertAccount(ctx, userID, accountID)` in `account_handlers.go`.
- Run Go from `/Users/niskan516/Sync/Workspace/dev/TraderMemos/api`. If `go`/`sqlc` errors with a mise "no version set" message, prefix `mise exec --`.
- Commit trailer on every commit: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. If git identity errors: `git -c user.name='TraderMemos' -c user.email='sinhong2011@gmail.com' commit ...`.

---

## File Structure

```
api/internal/db/migrations/
  000012_setups.{up,down}.sql
  000013_trade_journal.{up,down}.sql
  000014_tags_kind.{up,down}.sql
  000015_trade_attachments.{up,down}.sql
api/internal/store/queries/
  setups.sql            (new)
  trade_journal.sql     (new)
  attachments.sql       (new)
  trades.sql            (modify: UpsertTrade, DeleteTradesNotInAccount, ClearTradeExecutions, ListExecutionsForTrade)
  tags.sql              (modify: kind in CreateTag, add UpdateTag)
api/internal/storage/
  storage.go            (Storage interface + LocalDisk impl)
  storage_test.go
api/internal/trades/service.go   (modify: deterministic id + upsert/prune)
api/internal/analytics/
  breakdown.go          (new)
  breakdown_test.go
api/internal/api/
  setup_handlers.go     (new)
  attachment_handlers.go(new)
  trade_handlers.go     (modify: journal write, enriched detail)
  tag_handlers.go       (modify: kind)
  analytics_handlers.go (modify: breakdown)
  account_handlers.go / cash_handlers.go / import_handlers.go (modify: 404-on-missing deletes, filter validation, CSV cap)
  server.go             (modify: register new routes; add Storage to Deps)
api/cmd/server/main.go  (modify: construct Storage, pass into Deps)
```

---

## Milestone A — Durable Trade Identity

### Task 1: Migrations for setups, trade_journal, tags.kind, trade_attachments

**Files:** four migration pairs in `api/internal/db/migrations/`.

- [ ] **Step 1: Write `000012_setups.up.sql`**

```sql
CREATE TABLE setups (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name)
);
CREATE INDEX idx_setups_user ON setups(user_id);
```
`000012_setups.down.sql`: `DROP TABLE setups;`

- [ ] **Step 2: Write `000013_trade_journal.up.sql`**

```sql
CREATE TABLE trade_journal (
    trade_id     TEXT PRIMARY KEY REFERENCES trades(id) ON DELETE CASCADE,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notes        TEXT NOT NULL DEFAULT '',
    setup_id     TEXT REFERENCES setups(id) ON DELETE SET NULL,
    initial_risk REAL,
    updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_trade_journal_user ON trade_journal(user_id);
CREATE INDEX idx_trade_journal_setup ON trade_journal(setup_id);
```
`000013_trade_journal.down.sql`: `DROP TABLE trade_journal;`

- [ ] **Step 3: Write `000014_tags_kind.up.sql`**

```sql
ALTER TABLE tags ADD COLUMN kind TEXT NOT NULL DEFAULT 'custom';
```
`000014_tags_kind.down.sql`: (SQLite can't easily drop a column; a no-op down is acceptable here)
```sql
-- irreversible: ADD COLUMN; no-op down
```

- [ ] **Step 4: Write `000015_trade_attachments.up.sql`**

```sql
CREATE TABLE trade_attachments (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trade_id     TEXT NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    filename     TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size_bytes   INTEGER NOT NULL,
    storage_key  TEXT NOT NULL,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_attachments_trade ON trade_attachments(trade_id);
```
`000015_trade_attachments.down.sql`: `DROP TABLE trade_attachments;`

- [ ] **Step 5: Verify migrations apply**

Run: `cd api && go test ./internal/db/...`
Expected: PASS (existing `TestOpenAndMigrate` now applies all 15 migrations).

- [ ] **Step 6: Commit**

```bash
git add api/internal/db/migrations
git commit -m "feat: phase 2 migrations (setups, trade_journal, tags.kind, attachments)"
```

---

### Task 2: sqlc queries for new tables + trades upsert/prune

**Files:** new `setups.sql`, `trade_journal.sql`, `attachments.sql`; modify `trades.sql`, `tags.sql`; regenerate.

- [ ] **Step 1: Write `api/internal/store/queries/setups.sql`**

```sql
-- name: CreateSetup :one
INSERT INTO setups (id, user_id, name, description) VALUES (?, ?, ?, ?) RETURNING *;

-- name: ListSetups :many
SELECT * FROM setups WHERE user_id = ? ORDER BY name;

-- name: GetSetup :one
SELECT * FROM setups WHERE id = ? AND user_id = ?;

-- name: UpdateSetup :exec
UPDATE setups SET name = ?, description = ? WHERE id = ? AND user_id = ?;

-- name: DeleteSetup :execrows
DELETE FROM setups WHERE id = ? AND user_id = ?;
```

- [ ] **Step 2: Write `api/internal/store/queries/trade_journal.sql`**

```sql
-- name: UpsertTradeJournal :exec
INSERT INTO trade_journal (trade_id, user_id, notes, setup_id, initial_risk, updated_at)
VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
ON CONFLICT(trade_id) DO UPDATE SET
    notes = excluded.notes, setup_id = excluded.setup_id,
    initial_risk = excluded.initial_risk, updated_at = CURRENT_TIMESTAMP;

-- name: GetTradeJournal :one
SELECT * FROM trade_journal WHERE trade_id = ? AND user_id = ?;
```

- [ ] **Step 3: Write `api/internal/store/queries/attachments.sql`**

```sql
-- name: InsertAttachment :one
INSERT INTO trade_attachments (id, user_id, trade_id, filename, content_type, size_bytes, storage_key)
VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *;

-- name: ListAttachmentsForTrade :many
SELECT * FROM trade_attachments WHERE trade_id = ? AND user_id = ? ORDER BY created_at;

-- name: GetAttachment :one
SELECT * FROM trade_attachments WHERE id = ? AND user_id = ?;

-- name: DeleteAttachment :execrows
DELETE FROM trade_attachments WHERE id = ? AND user_id = ?;
```

- [ ] **Step 4: Add to `api/internal/store/queries/trades.sql`**

```sql
-- name: UpsertTrade :exec
INSERT INTO trades (id, user_id, account_id, symbol, instrument_type, direction, status,
    opened_at, closed_at, qty_opened, avg_entry_price, avg_exit_price, gross_pnl, fees_total,
    net_pnl, pnl_currency, return_pct, r_multiple, time_in_trade_secs, notes)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '')
ON CONFLICT(id) DO UPDATE SET
    account_id = excluded.account_id, symbol = excluded.symbol,
    instrument_type = excluded.instrument_type, direction = excluded.direction,
    status = excluded.status, opened_at = excluded.opened_at, closed_at = excluded.closed_at,
    qty_opened = excluded.qty_opened, avg_entry_price = excluded.avg_entry_price,
    avg_exit_price = excluded.avg_exit_price, gross_pnl = excluded.gross_pnl,
    fees_total = excluded.fees_total, net_pnl = excluded.net_pnl,
    pnl_currency = excluded.pnl_currency, return_pct = excluded.return_pct,
    time_in_trade_secs = excluded.time_in_trade_secs, updated_at = CURRENT_TIMESTAMP;

-- name: DeleteTradesNotInAccount :exec
DELETE FROM trades WHERE user_id = ? AND account_id = ? AND id NOT IN (sqlc.slice('keep'));

-- name: ClearTradeExecutions :exec
DELETE FROM trade_executions WHERE trade_id = ?;

-- name: ListExecutionsForTrade :many
SELECT e.* FROM executions e
JOIN trade_executions te ON te.execution_id = e.id
WHERE te.trade_id = ? ORDER BY e.executed_at, e.id;
```
Note: `r_multiple` is intentionally NOT updated by `UpsertTrade` (it is derived from `trade_journal.initial_risk` at read time, kept null in the row). `notes` column is vestigial (authored notes live in `trade_journal`); upsert leaves it `''`.

- [ ] **Step 5: Modify `api/internal/store/queries/tags.sql`**

Change `CreateTag` and add `UpdateTag`:
```sql
-- name: CreateTag :one
INSERT INTO tags (id, user_id, name, color, description, kind) VALUES (?, ?, ?, ?, ?, ?) RETURNING *;

-- name: UpdateTag :exec
UPDATE tags SET name = ?, color = ?, description = ?, kind = ? WHERE id = ? AND user_id = ?;
```
(Keep the existing `ListTags`, `DeleteTag`, `SetTradeTags`, `ClearTradeTags`, `ListTagsForTrade`. Change `DeleteTag` to `:execrows`.)

- [ ] **Step 6: Regenerate + build**

Run: `cd api && sqlc generate && go build ./...`
Expected: regenerates `internal/store/*`, builds. If `sqlc.slice` errors, confirm sqlc version supports it (it does for SQLite v1.30+); the generated param is `Keep []string`.

- [ ] **Step 7: Commit**

```bash
git add api/sqlc.yaml api/internal/store
git commit -m "feat: sqlc queries for setups, journal, attachments, trade upsert/prune"
```

---

### Task 3: Deterministic trade id + upsert Regroup (preservation)

**Files:** Modify `api/internal/trades/service.go`; Test `api/internal/trades/preservation_test.go`.

**Key facts:** the engine's `Trade.ExecutionIDs` is ordered with the **opening fill first** (`newOpen` appends it before any scale-in/reduce). So the deterministic trade id is `tr.ExecutionIDs[0]`. Each execution opens at most one trade, so these ids are unique.

- [ ] **Step 1: Write the failing preservation test**

`api/internal/trades/preservation_test.go`:
```go
package trades_test

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/db"
	"github.com/tradermemos/api/internal/store"
	"github.com/tradermemos/api/internal/trades"
)

func TestRegroupPreservesJournalAndTags(t *testing.T) {
	conn, err := db.Open(filepath.Join(t.TempDir(), "t.db"))
	require.NoError(t, err)
	require.NoError(t, db.Migrate(conn))
	q := store.New(conn)
	ctx := context.Background()

	u, _ := q.CreateUser(ctx, store.CreateUserParams{ID: uuid.NewString(), Email: "a@b.com", PasswordHash: "x"})
	acc, _ := q.CreateAccount(ctx, store.CreateAccountParams{ID: uuid.NewString(), UserID: u.ID, Name: "M", BaseCurrency: "USD"})

	mk := func(side string, qty, price float64, ts string) {
		tt, _ := time.Parse(time.RFC3339, ts)
		_, err := q.InsertExecution(ctx, store.InsertExecutionParams{
			ID: uuid.NewString(), UserID: u.ID, AccountID: acc.ID, Symbol: "AAPL",
			InstrumentType: "stock", Side: side, Quantity: qty, Price: price,
			ExecutedAt: tt, Multiplier: 1, DedupHash: uuid.NewString(),
		})
		require.NoError(t, err)
	}
	mk("buy", 100, 10, "2026-01-01T10:00:00Z")
	mk("sell", 100, 12, "2026-01-01T11:00:00Z")

	svc := trades.NewService(q)
	require.NoError(t, svc.Regroup(ctx, u.ID, acc.ID))

	closed, _ := q.ListClosedTrades(ctx, store.ListClosedTradesParams{UserID: u.ID})
	require.Len(t, closed, 1)
	tradeID := closed[0].ID

	// journal the trade
	require.NoError(t, q.UpsertTradeJournal(ctx, store.UpsertTradeJournalParams{
		TradeID: tradeID, UserID: u.ID, Notes: "good entry",
	}))

	// re-run regroup (idempotent) — journal must survive because the id is stable
	require.NoError(t, svc.Regroup(ctx, u.ID, acc.ID))

	closed2, _ := q.ListClosedTrades(ctx, store.ListClosedTradesParams{UserID: u.ID})
	require.Len(t, closed2, 1)
	require.Equal(t, tradeID, closed2[0].ID) // SAME id

	j, err := q.GetTradeJournal(ctx, store.GetTradeJournalParams{TradeID: tradeID, UserID: u.ID})
	require.NoError(t, err)
	require.Equal(t, "good entry", j.Notes)
}
```

- [ ] **Step 2: Run to verify fail**

Run: `cd api && go test ./internal/trades/... -run TestRegroupPreserves`
Expected: FAIL (current Regroup uses random uuid ids + delete-recreate, so the journal is orphaned / id changes).

- [ ] **Step 3: Rewrite `Regroup` to use deterministic ids + upsert + prune**

Replace the body of `Regroup` in `api/internal/trades/service.go`:
```go
func (s *Service) Regroup(ctx context.Context, userID, accountID string) error {
	acc, err := s.q.GetAccount(ctx, store.GetAccountParams{ID: accountID, UserID: userID})
	if err != nil {
		return err
	}
	rows, err := s.q.ListExecutionsForAccount(ctx, store.ListExecutionsForAccountParams{UserID: userID, AccountID: accountID})
	if err != nil {
		return err
	}
	groups := map[string][]Execution{}
	for _, r := range rows {
		key := r.Symbol + "|" + r.InstrumentType
		groups[key] = append(groups[key], Execution{
			ID: r.ID, Symbol: r.Symbol, InstrumentType: r.InstrumentType, Side: r.Side,
			Quantity: r.Quantity, Price: r.Price, Fees: r.Fees, Commission: r.Commission,
			ExecutedAt: r.ExecutedAt, Multiplier: r.Multiplier,
		})
	}

	keep := []string{}
	for _, g := range groups {
		for _, tr := range Group(g) {
			id := tr.ExecutionIDs[0] // opening fill = stable id
			if err := s.q.UpsertTrade(ctx, toUpsertParams(id, userID, accountID, acc.BaseCurrency, tr)); err != nil {
				return err
			}
			if err := s.q.ClearTradeExecutions(ctx, id); err != nil {
				return err
			}
			for _, eid := range tr.ExecutionIDs {
				if err := s.q.LinkTradeExecution(ctx, store.LinkTradeExecutionParams{TradeID: id, ExecutionID: eid}); err != nil {
					return err
				}
			}
			keep = append(keep, id)
		}
	}

	if len(keep) == 0 {
		return s.q.DeleteTradesForAccount(ctx, store.DeleteTradesForAccountParams{UserID: userID, AccountID: accountID})
	}
	return s.q.DeleteTradesNotInAccount(ctx, store.DeleteTradesNotInAccountParams{UserID: userID, AccountID: accountID, Keep: keep})
}
```
Rename the existing `toInsertParams` helper to `toUpsertParams` returning `store.UpsertTradeParams` (same field mapping; `UpsertTradeParams` has the same fields as `InsertTradeParams` minus the RETURNING — verify field names after `sqlc generate`, they match the insert). Keep the `nf/nt/ni` null helpers.

- [ ] **Step 4: Run to verify pass + the existing service test still green**

Run: `cd api && go test ./internal/trades/...`
Expected: PASS (preservation + existing `TestRegroupPersistsClosedTrade`). The existing test asserts net P&L 200 — still valid since grouping math is unchanged.

- [ ] **Step 5: Run the full suite**

Run: `cd api && go test ./... -count=1`
Expected: PASS. (The `internal/api` execution/import tests call Regroup; they must still pass with upsert.)

- [ ] **Step 6: Commit**

```bash
git add api/internal/trades
git commit -m "feat: deterministic trade id + upsert/prune Regroup (journal survives re-import)"
```

---

## Milestone B — New Domain & Endpoints

### Task 4: Setups CRUD

**Files:** Create `api/internal/api/setup_handlers.go`, `api/internal/api/setup_handlers_test.go`; modify `server.go` to register.

- [ ] **Step 1: Write the failing test** (`setup_handlers_test.go`) — register/login, create a setup, list it, assert another user can't see it:
```go
package api_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSetupCRUDAndIsolation(t *testing.T) {
	s := testServer(t)
	tokA := registerAndLogin(t, s, "a@s.com")
	tokB := registerAndLogin(t, s, "b@s.com")

	rec := do(s, http.MethodPost, "/api/v1/setups", `{"name":"Breakout","description":"ORB"}`, tokA)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())

	rec = do(s, http.MethodGet, "/api/v1/setups", "", tokB)
	var setups []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &setups))
	require.Len(t, setups, 0)

	rec = do(s, http.MethodGet, "/api/v1/setups", "", tokA)
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &setups))
	require.Len(t, setups, 1)
}
```

- [ ] **Step 2: Run to verify fail**

Run: `cd api && go test ./internal/api/... -run TestSetupCRUD`
Expected: FAIL — 404 (route not registered).

- [ ] **Step 3: Implement `setup_handlers.go`**

Follow the `tag_handlers.go` pattern exactly. Routes: `POST /setups` (`{name,description}` → `CreateSetup` with `uuid`, 409 on duplicate), `GET /setups` (`ListSetups`, never nil), `PATCH /setups/:id` (`{name,description}` → `UpdateSetup`), `DELETE /setups/:id` (`DeleteSetup` `:execrows` → 404 if 0 rows). Register `s.setupRoutes(protected)` in `server.go`'s `routes()`.

- [ ] **Step 4: Run to verify pass + commit**

Run: `cd api && go test ./internal/api/... -run TestSetupCRUD`
Expected: PASS.
```bash
git add api/internal/api/setup_handlers.go api/internal/api/setup_handlers_test.go api/internal/api/server.go
git commit -m "feat: setups (playbook) CRUD endpoints"
```

---

### Task 5: Journal write path + tags.kind

**Files:** Modify `api/internal/api/trade_handlers.go` (PATCH writes journal), `api/internal/api/tag_handlers.go` (kind); test in `trade_handlers_test.go` (new).

- [ ] **Step 1: Write the failing test**

`api/internal/api/trade_journal_test.go`:
```go
package api_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPatchTradeWritesJournal(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "j@x.com")
	acc := accountID(t, s, tok)
	// make a closed trade
	buy := `{"account_id":"` + acc + `","symbol":"AAPL","instrument_type":"stock","side":"buy","quantity":100,"price":10,"executed_at":"2026-01-01T10:00:00Z"}`
	sell := `{"account_id":"` + acc + `","symbol":"AAPL","instrument_type":"stock","side":"sell","quantity":100,"price":12,"executed_at":"2026-01-01T11:00:00Z"}`
	do(s, http.MethodPost, "/api/v1/executions", buy, tok)
	do(s, http.MethodPost, "/api/v1/executions", sell, tok)
	rec := do(s, http.MethodGet, "/api/v1/trades?account_id="+acc, "", tok)
	var trs []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &trs))
	id := trs[0]["id"].(string)

	// setup to attach
	rec = do(s, http.MethodPost, "/api/v1/setups", `{"name":"ORB"}`, tok)
	var setup map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &setup))

	body := `{"notes":"clean break","setup_id":"` + setup["id"].(string) + `","initial_risk":100}`
	rec = do(s, http.MethodPatch, "/api/v1/trades/"+id, body, tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	rec = do(s, http.MethodGet, "/api/v1/trades/"+id, "", tok)
	var detail map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &detail))
	require.Equal(t, "clean break", detail["notes"])
	require.Equal(t, 2.0, detail["r_multiple"]) // net 200 / risk 100
}
```

- [ ] **Step 2: Run to verify fail**

Run: `cd api && go test ./internal/api/... -run TestPatchTradeWritesJournal`
Expected: FAIL (PATCH doesn't write journal; detail lacks notes/r_multiple).

- [ ] **Step 3: Extend `handlePatchTrade`**

In `trade_handlers.go`, change `patchTradeReq` to:
```go
type patchTradeReq struct {
	Notes       *string  `json:"notes"`
	SetupID     *string  `json:"setup_id"`
	InitialRisk *float64 `json:"initial_risk"`
	TagIDs      []string `json:"tag_ids"`
}
```
After the ownership check + tag validation (keep existing tag-ownership guard), build and write the journal whenever any journal field is present. Validate `setup_id` ownership via `s.deps.Store.GetSetup` (400 if not owned). Call `UpsertTradeJournal` with `notes` (default to existing/`""`), `setup_id` (`sql.NullString`), `initial_risk` (`sql.NullFloat64`). Then return the enriched detail (Task 8 provides `buildTradeDetail`; for this task, return via the enriched `handleGetTrade`).

- [ ] **Step 4: Update tags for `kind`**

In `tag_handlers.go`, add `Kind string` to `createTagReq` (validate `kind ∈ {custom,mistake}`, default `custom`); pass to `CreateTag`. Add a `PATCH /tags/:id` handler calling `UpdateTag`. Register the PATCH route in `tagRoutes`.

- [ ] **Step 5: Run to verify pass + commit**

Run: `cd api && go test ./internal/api/... -run 'TestPatchTradeWritesJournal|Tag'`
Expected: PASS.
```bash
git add api/internal/api/trade_handlers.go api/internal/api/tag_handlers.go api/internal/api/trade_journal_test.go
git commit -m "feat: trade journal write path (notes/setup/risk) + tag kind"
```

---

### Task 6: Attachment storage (`internal/storage`)

**Files:** Create `api/internal/storage/storage.go`, `storage_test.go`.

- [ ] **Step 1: Write the failing test**

`api/internal/storage/storage_test.go`:
```go
package storage

import (
	"bytes"
	"io"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestLocalDiskRoundTrip(t *testing.T) {
	s := NewLocalDisk(t.TempDir())
	key := "user1/att1.png"
	require.NoError(t, s.Put(key, bytes.NewReader([]byte("PNGDATA"))))
	r, err := s.Get(key)
	require.NoError(t, err)
	defer r.Close()
	b, _ := io.ReadAll(r)
	require.Equal(t, "PNGDATA", string(b))
	require.NoError(t, s.Delete(key))
	_, err = s.Get(key)
	require.Error(t, err)
}
```

- [ ] **Step 2: Run to verify fail**

Run: `cd api && go test ./internal/storage/...`
Expected: FAIL — undefined.

- [ ] **Step 3: Implement `storage.go`**

```go
package storage

import (
	"io"
	"os"
	"path/filepath"
)

type Storage interface {
	Put(key string, r io.Reader) error
	Get(key string) (io.ReadCloser, error)
	Delete(key string) error
}

type LocalDisk struct{ root string }

func NewLocalDisk(root string) *LocalDisk { return &LocalDisk{root: root} }

func (l *LocalDisk) path(key string) string { return filepath.Join(l.root, filepath.Clean("/"+key)) }

func (l *LocalDisk) Put(key string, r io.Reader) error {
	p := l.path(key)
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		return err
	}
	f, err := os.Create(p)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = io.Copy(f, r)
	return err
}

func (l *LocalDisk) Get(key string) (io.ReadCloser, error) { return os.Open(l.path(key)) }
func (l *LocalDisk) Delete(key string) error               { return os.Remove(l.path(key)) }
```
`filepath.Clean("/"+key)` neutralizes `..` traversal before joining to root.

- [ ] **Step 4: Run to verify pass + commit**

Run: `cd api && go test ./internal/storage/...`
Expected: PASS.
```bash
git add api/internal/storage
git commit -m "feat: pluggable attachment storage (local disk)"
```

---

### Task 7: Attachment endpoints

**Files:** Create `api/internal/api/attachment_handlers.go`, `attachment_handlers_test.go`; modify `server.go` (Deps gets `Storage storage.Storage`; register routes); modify `cmd/server/main.go` (construct `storage.NewLocalDisk(<dataDir>/attachments)`); add `AttachMaxBytes` to config (default 10<<20).

- [ ] **Step 1: Write the failing test**

`attachment_handlers_test.go`: create a closed trade (helper as in Task 5), POST a multipart PNG to `/api/v1/trades/:id/attachments`, assert 201; GET list returns 1; GET file returns the bytes; a second user gets 404 on that trade's attachments. Use the `multipartReq` helper pattern from `testhelpers_test.go` (field name `file`). For `testServer`, pass a `storage.NewLocalDisk(t.TempDir())` into `api.Deps`.

- [ ] **Step 2: Run to verify fail**

Run: `cd api && go test ./internal/api/... -run Attachment`
Expected: FAIL — routes/Deps.Storage missing.

- [ ] **Step 3: Implement**

Add `Storage storage.Storage` to `Deps` (server.go) and construct it in `main.go` (`storage.NewLocalDisk(filepath.Join(filepath.Dir(cfg.DBPath), "attachments"))`). Implement `attachment_handlers.go`:
- `POST /trades/:id/attachments`: verify trade ownership (`GetTrade{id,uid}` → 404); read `FormFile("file")`; reject if `content_type` not in `{image/png,image/jpeg,image/webp}` (400) or size > `cfg.AttachMaxBytes` (413); `id=uuid`, `storage_key = uid + "/" + id`; `Storage.Put(key, file)`; `InsertAttachment`; return 201 + row.
- `GET /trades/:id/attachments`: verify trade ownership; `ListAttachmentsForTrade`.
- `GET /attachments/:id/file`: `GetAttachment{id,uid}` (404); `Storage.Get(storage_key)`; stream with `c.Stream(200, content_type, reader)`.
- `DELETE /attachments/:id`: `GetAttachment` (404); `Storage.Delete(key)`; `DeleteAttachment`.
Register `s.attachmentRoutes(protected)`.

- [ ] **Step 4: Run + full build + commit**

Run: `cd api && go build ./... && go test ./internal/api/... -run Attachment`
Expected: PASS.
```bash
git add api/internal/api api/internal/config api/cmd/server/main.go
git commit -m "feat: trade screenshot attachment endpoints + storage wiring"
```

---

### Task 8: Enriched trade detail

**Files:** Modify `api/internal/api/trade_handlers.go` (+ `dto.go` for the detail shape); test in `trade_journal_test.go` (extend).

- [ ] **Step 1: Write the failing assertion**

Extend `TestPatchTradeWritesJournal` (or add `TestTradeDetailIncludesFills`) to assert `GET /trades/:id` returns a `fills` array of length 2 and an `attachments` array (possibly empty) and a `setup` object when set.

- [ ] **Step 2: Run to verify fail**

Run: `cd api && go test ./internal/api/... -run TestTradeDetail`
Expected: FAIL — detail lacks `fills`.

- [ ] **Step 3: Implement the enriched detail**

In `dto.go`, add a `tradeDetailDTO` embedding `tradeDTO` plus `Fills []store.Execution`, `Setup *store.Setup`, `InitialRisk *float64`, `RMultiple *float64`, `Attachments []store.TradeAttachment`. In `handleGetTrade`, after loading the trade: load journal (`GetTradeJournal`, tolerate `sql.ErrNoRows` → empty), fills (`ListExecutionsForTrade`), tags (`ListTagsForTrade`), attachments (`ListAttachmentsForTrade`), and setup (if `setup_id` set). Compute `r_multiple = net_pnl / initial_risk` when both present. Return the detail DTO. Ensure `notes` comes from the journal.

- [ ] **Step 4: Run + commit**

Run: `cd api && go test ./internal/api/...`
Expected: PASS.
```bash
git add api/internal/api
git commit -m "feat: enriched trade detail (fills, journal, setup, tags, attachments, R)"
```

---

### Task 9: Breakdown analytics

**Files:** Create `api/internal/analytics/breakdown.go`, `breakdown_test.go`; modify `analytics_handlers.go`.

- [ ] **Step 1: Write the failing test**

`api/internal/analytics/breakdown_test.go`:
```go
package analytics

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestBreakdownByKey(t *testing.T) {
	tt, _ := time.Parse(time.RFC3339, "2026-01-01T11:00:00Z")
	groups := map[string][]ClosedTrade{
		"AAPL": {{NetPnl: 200, ClosedAt: tt}, {NetPnl: -50, ClosedAt: tt}},
		"MSFT": {{NetPnl: 300, ClosedAt: tt}},
	}
	out := Breakdown(groups)
	require.Len(t, out, 2)
	// sorted by net pnl desc: MSFT(300) then AAPL(150)
	require.Equal(t, "MSFT", out[0].Key)
	require.Equal(t, 300.0, out[0].Summary.NetPnl)
	require.Equal(t, "AAPL", out[1].Key)
	require.Equal(t, 150.0, out[1].Summary.NetPnl)
}
```

- [ ] **Step 2: Run to verify fail**

Run: `cd api && go test ./internal/analytics/... -run TestBreakdown`
Expected: FAIL — undefined.

- [ ] **Step 3: Implement `breakdown.go`**

```go
package analytics

import "sort"

type BreakGroup struct {
	Key     string  `json:"key"`
	Summary Summary `json:"summary"`
}

// Breakdown summarizes each group and returns them sorted by net P&L desc.
func Breakdown(groups map[string][]ClosedTrade) []BreakGroup {
	out := make([]BreakGroup, 0, len(groups))
	for k, ts := range groups {
		out = append(out, BreakGroup{Key: k, Summary: Summarize(ts)})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Summary.NetPnl != out[j].Summary.NetPnl {
			return out[i].Summary.NetPnl > out[j].Summary.NetPnl
		}
		return out[i].Key < out[j].Key
	})
	return out
}
```

- [ ] **Step 4: Implement the handler**

In `analytics_handlers.go`, add `GET /analytics/breakdown`. Read `by` query param (`symbol|setup|day_of_week|hour_of_day|tag`; 400 otherwise). Load closed trades via `loadClosedTrades`. Build `map[string][]analytics.ClosedTrade` by extracting the key per trade:
- `symbol` → `t.Symbol`
- `day_of_week` → `t.ClosedAt.Time.Weekday().String()`
- `hour_of_day` → `fmt.Sprintf("%02d:00", t.ClosedAt.Time.UTC().Hour())`
- `setup` → look up `GetTradeJournal` per trade; key = setup name (via `GetSetup`) or `"(none)"`
- `tag` → `ListTagsForTrade` per trade; a trade contributes to each of its tag names
Then `c.JSON(200, analytics.Breakdown(groups))`. Register the route.

- [ ] **Step 5: Run + commit**

Run: `cd api && go test ./internal/analytics/... ./internal/api/...`
Expected: PASS.
```bash
git add api/internal/analytics api/internal/api/analytics_handlers.go api/internal/api/server.go
git commit -m "feat: breakdown analytics endpoint (by symbol/setup/day/hour/tag)"
```

---

## Milestone C — Phase-1 Follow-ups & Wrap

### Task 10: Delete-404, filter validation, CSV cap

**Files:** Modify `account_handlers.go`, `cash_handlers.go`, `tag_handlers.go` (delete → 404 on 0 rows), `filters.go` (reject bad dates), `import_handlers.go` (size cap), and the relevant queries to `:execrows`.

- [ ] **Step 1: Write failing tests**

Add to an isolation/edge test file: deleting a nonexistent account id returns 404; `GET /trades?from=notadate` returns 400; uploading an over-cap CSV to `/imports` returns 413. (Use a small `cfg`/Deps cap for the test, e.g., inject a tiny `ImportMaxBytes`.)

- [ ] **Step 2: Run to verify fail**

Run: `cd api && go test ./internal/api/... -run 'Delete|BadFilter|ImportCap'`
Expected: FAIL.

- [ ] **Step 3: Implement**

- Change `DeleteAccount`, `DeleteCashTransaction`, `DeleteTag` queries to `:execrows`; regenerate; in handlers return 404 when `RowsAffected()==0`.
- In `parseFilters`, if `from`/`to` present but unpar. seable, set a `f.Err` flag; handlers using filters return 400 when set. (Or parse in the handler and 400 on error.)
- In `import_handlers.go`, enforce `c.Request().ContentLength <= cfg.ImportMaxBytes` (add `ImportMaxBytes` to config, default 10<<20) → 413.

- [ ] **Step 4: Run + commit**

Run: `cd api && go test ./... -count=1`
Expected: PASS.
```bash
git add api/internal
git commit -m "fix: 404 on missing deletes, reject bad date filters, cap CSV upload size"
```

---

### Task 11: Route registration sweep + end-to-end verification

**Files:** Verify `server.go` registers all new groups; `api/cmd/cli` unaffected.

- [ ] **Step 1: Confirm routes**

Run: `cd api && grep -rE 'g\.(GET|POST|PATCH|DELETE)\("' internal/api/ | sort`
Expected: includes `/setups`, `/setups/:id`, `/trades/:id/attachments`, `/attachments/:id/file`, `/attachments/:id`, `/analytics/breakdown`, `PATCH /tags/:id`.

- [ ] **Step 2: Full suite + vet**

Run: `cd api && go vet ./... && go test ./... -count=1`
Expected: ALL PASS.

- [ ] **Step 3: Live smoke (the preservation guarantee end-to-end)**

Start the server on a temp DB (as in the Phase 1 e2e). Create user+account, import the sample CSV, `PATCH` a trade with notes+setup+initial_risk, then **re-import the same CSV** (dedup skips duplicates, Regroup runs) and `GET /trades/:id` — assert the notes/setup/r_multiple are still present. Also hit `GET /analytics/breakdown?by=symbol`.

- [ ] **Step 4: Tag + commit**

```bash
git add -A && git commit -m "chore: phase 2a backend additions complete" || true
git tag phase-2a-backend
```

---

## Self-Review Notes

- **Spec coverage:** §2.1 stable id → T2/T3; §2.2 tables → T1/T2; §2.3 storage → T6/T7; §2.4 R-multiple → T5/T8; §2.5 endpoints → T4/T5/T7/T8/T9; §2.6 follow-ups → T10. All covered.
- **Type consistency:** `UpsertTradeParams` mirrors `InsertTradeParams` fields (verify after `sqlc generate`); `toUpsertParams` replaces `toInsertParams`; deterministic id = `Trade.ExecutionIDs[0]`; `BreakGroup`/`Breakdown` names consistent T9.
- **Watch-out:** after `sqlc generate`, `DeleteTradesNotInAccountParams.Keep` is `[]string`; `:execrows` queries return `(sql.Result, error)` so handlers call `RowsAffected()`.
```
