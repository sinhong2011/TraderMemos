# TraderMemos Phase 1 — Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the self-hostable Go backend for a multi-instrument trading journal — executions→trades grouping engine, manual + CSV entry, a cash ledger, core analytics, multi-user auth — plus a thin web client and Docker packaging that proves the API end-to-end.

**Architecture:** A single Go/Echo binary serves a JSON API over SQLite (sqlc-generated queries, golang-migrate migrations). Raw fills land in `executions`; a server-owned grouping engine (`internal/trades`) folds them into round-trip `trades` using average-cost; `internal/analytics` computes KPIs and a balance-based equity curve from trades + a `cash_transactions` ledger. Every row is scoped by `user_id`. A Vite/React thin client and `docker-compose.yml` round out the deliverable.

**Tech Stack:** Go 1.26, Echo v4, `modernc.org/sqlite` (pure-Go, cgo-free), sqlc, golang-migrate, koanf (config), zerolog (logging), cobra (CLI), golang-jwt/v5 + `golang.org/x/crypto/bcrypt` (auth), stretchr/testify (tests); Vite + React + TanStack Query (thin web).

**Reference template:** `/Users/niskan516/Sync/Workspace/dev/milmil` (`api/`) uses these exact libraries — consult it for idiomatic Echo handlers, sqlc layout, migration style, and the auth package. Do not copy blindly; follow the patterns.

**Spec:** `docs/superpowers/specs/2026-06-15-phase1-backend-foundation-design.md`

---

## File Structure

```
api/
├── go.mod
├── sqlc.yaml
├── Makefile
├── Dockerfile
├── cmd/
│   ├── server/main.go            # wires config→db→store→services→Echo, starts server
│   └── cli/main.go               # cobra root: migrate, create-user, import, regroup
├── internal/
│   ├── config/config.go          # koanf load + Config struct
│   ├── db/db.go                  # sqlite open
│   ├── db/migrate.go             # golang-migrate runner
│   ├── store/                    # sqlc-GENERATED (do not hand-edit): db.go, models.go, *.sql.go, querier.go
│   │   └── queries/              # *.sql source files (hand-written)
│   ├── auth/
│   │   ├── password.go           # bcrypt hash/verify
│   │   ├── jwt.go                # access/refresh token mint + parse
│   │   ├── service.go            # Register/Login/Refresh
│   │   └── middleware.go         # Echo JWT middleware → injects user_id into context
│   ├── money/money.go            # integer-cents money type + helpers (avoid float drift)
│   ├── trades/
│   │   ├── engine.go             # grouping engine: executions → trades
│   │   ├── engine_test.go
│   │   └── service.go            # Regroup(accountID): rebuild trades from executions via store
│   ├── importer/
│   │   ├── importer.go           # Importer interface + ParsedExecution + Registry
│   │   ├── generic.go            # generic column-mapping importer
│   │   ├── mapping.go            # heuristic header→field mapping suggestion
│   │   ├── dedup.go              # external_id / hash dedup
│   │   └── *_test.go
│   ├── analytics/
│   │   ├── analytics.go          # KPI + equity-curve computations (pure funcs)
│   │   └── analytics_test.go
│   └── api/
│       ├── server.go             # Echo instance, middleware, route registration
│       ├── errors.go             # central error handler + APIError envelope
│       ├── auth_handlers.go
│       ├── account_handlers.go
│       ├── execution_handlers.go
│       ├── cash_handlers.go
│       ├── import_handlers.go
│       ├── trade_handlers.go
│       ├── tag_handlers.go
│       ├── analytics_handlers.go
│       └── filters.go            # shared query-param filter parsing
├── migrations/                   # NNNNNN_name.up.sql / .down.sql
└── testdata/                     # CSV fixtures for importer tests
web/                              # thin Vite client (Milestone 7)
docker-compose.yml
```

**Money handling rule (applies throughout):** store all monetary values and prices as **integer minor units** where practical, OR as REAL in SQLite but compute P&L through the `money` package to control rounding. Prices can have fractional ticks, so prices are stored as REAL; P&L results are rounded to the instrument currency's minor unit at the end. Tests assert exact rounded values.

---

## Milestone 0 — Scaffolding

### Task 1: Go module + buildable skeleton

**Files:**
- Create: `api/go.mod`, `api/cmd/server/main.go`, `api/Makefile`

- [ ] **Step 1: Initialize the module**

Run:
```bash
cd /Users/niskan516/Sync/Workspace/dev/TraderMemos/api
go mod init github.com/tradermemos/api
```

- [ ] **Step 2: Write a trivial main**

`api/cmd/server/main.go`:
```go
package main

import "fmt"

func main() {
	fmt.Println("tradermemos server")
}
```

- [ ] **Step 3: Add a Makefile**

`api/Makefile`:
```makefile
.PHONY: build test run sqlc migrate
build:
	go build ./...
test:
	go test ./...
run:
	go run ./cmd/server
sqlc:
	sqlc generate
```

- [ ] **Step 4: Verify it builds**

Run: `cd api && go build ./...`
Expected: exit 0, no output.

- [ ] **Step 5: Commit**

```bash
git add api/go.mod api/cmd/server/main.go api/Makefile
git commit -m "chore: scaffold api go module"
```

---

### Task 2: Config package (koanf)

**Files:**
- Create: `api/internal/config/config.go`, `api/internal/config/config_test.go`

- [ ] **Step 1: Write the failing test**

`api/internal/config/config_test.go`:
```go
package config

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestLoadDefaults(t *testing.T) {
	cfg, err := Load()
	require.NoError(t, err)
	require.Equal(t, "8080", cfg.HTTPPort)
	require.Equal(t, "data/tradermemos.db", cfg.DBPath)
	require.Equal(t, "USD", cfg.DefaultCurrency)
}

func TestLoadEnvOverride(t *testing.T) {
	t.Setenv("TM_HTTP_PORT", "9999")
	t.Setenv("TM_JWT_SECRET", "s3cr3t")
	cfg, err := Load()
	require.NoError(t, err)
	require.Equal(t, "9999", cfg.HTTPPort)
	require.Equal(t, "s3cr3t", cfg.JWTSecret)
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd api && go test ./internal/config/...`
Expected: FAIL — package/function not defined.

- [ ] **Step 3: Implement config**

`api/internal/config/config.go`:
```go
package config

import (
	"strings"

	"github.com/knadh/koanf/providers/confmap"
	"github.com/knadh/koanf/providers/env"
	"github.com/knadh/koanf/v2"
)

type Config struct {
	HTTPPort        string
	DBPath          string
	JWTSecret       string
	DefaultCurrency string
	LogLevel        string
}

func Load() (Config, error) {
	k := koanf.New(".")
	_ = k.Load(confmap.Provider(map[string]interface{}{
		"http_port":        "8080",
		"db_path":          "data/tradermemos.db",
		"jwt_secret":       "dev-insecure-change-me",
		"default_currency": "USD",
		"log_level":        "info",
	}, "."), nil)

	// TM_HTTP_PORT -> http_port
	_ = k.Load(env.Provider("TM_", ".", func(s string) string {
		return strings.ReplaceAll(strings.ToLower(strings.TrimPrefix(s, "TM_")), "__", ".")
	}), nil)

	return Config{
		HTTPPort:        k.String("http_port"),
		DBPath:          k.String("db_path"),
		JWTSecret:       k.String("jwt_secret"),
		DefaultCurrency: k.String("default_currency"),
		LogLevel:        k.String("log_level"),
	}, nil
}
```

- [ ] **Step 4: Add deps and run tests**

Run:
```bash
cd api && go get github.com/knadh/koanf/v2 github.com/knadh/koanf/providers/env github.com/knadh/koanf/providers/confmap github.com/stretchr/testify
go test ./internal/config/...
```
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add api/internal/config api/go.mod api/go.sum
git commit -m "feat: config package with koanf + env overrides"
```

---

### Task 3: SQLite open + migration runner

**Files:**
- Create: `api/internal/db/db.go`, `api/internal/db/migrate.go`, `api/internal/db/db_test.go`
- Create: `api/migrations/000001_init.up.sql`, `api/migrations/000001_init.down.sql` (placeholder no-op to prove the runner)

- [ ] **Step 1: Write the failing test**

`api/internal/db/db_test.go`:
```go
package db

import (
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestOpenAndMigrate(t *testing.T) {
	path := filepath.Join(t.TempDir(), "test.db")
	conn, err := Open(path)
	require.NoError(t, err)
	defer conn.Close()

	require.NoError(t, Migrate(conn))
	require.NoError(t, conn.Ping())
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd api && go test ./internal/db/...`
Expected: FAIL — `Open`/`Migrate` undefined.

- [ ] **Step 3: Add a no-op first migration**

`api/migrations/000001_init.up.sql`:
```sql
PRAGMA foreign_keys = ON;
```
`api/migrations/000001_init.down.sql`:
```sql
-- no-op
```

- [ ] **Step 4: Implement db open**

`api/internal/db/db.go`:
```go
package db

import (
	"database/sql"

	_ "modernc.org/sqlite"
)

func Open(path string) (*sql.DB, error) {
	dsn := "file:" + path + "?_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)"
	conn, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	conn.SetMaxOpenConns(1) // sqlite single-writer; serialize writes
	return conn, nil
}
```

- [ ] **Step 5: Implement migrate runner (embedded migrations)**

`api/internal/db/migrate.go`:
```go
package db

import (
	"database/sql"
	"embed"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/sqlite"
	"github.com/golang-migrate/migrate/v4/source/iofs"
)

//go:embed all:../../migrations
var migrationsFS embed.FS

func Migrate(conn *sql.DB) error {
	src, err := iofs.New(migrationsFS, "migrations")
	if err != nil {
		return err
	}
	drv, err := sqlite.WithInstance(conn, &sqlite.Config{})
	if err != nil {
		return err
	}
	m, err := migrate.NewWithInstance("iofs", src, "sqlite", drv)
	if err != nil {
		return err
	}
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return err
	}
	return nil
}
```

Note: the embed path `../../migrations` resolves from `internal/db`. If the toolchain rejects the relative embed, move `migrate.go` to a package that sits at `api/` root level, or copy migrations under `internal/db/migrations`. Verify with Step 6; if embed fails, relocate the embed directive to `api/cmd` and pass the FS into `Migrate`.

- [ ] **Step 6: Add deps and run tests**

Run:
```bash
cd api && go get modernc.org/sqlite github.com/golang-migrate/migrate/v4
go test ./internal/db/...
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add api/internal/db api/migrations api/go.mod api/go.sum
git commit -m "feat: sqlite open + embedded migration runner"
```

---

### Task 4: Echo server + health endpoint + error envelope + logging

**Files:**
- Create: `api/internal/api/errors.go`, `api/internal/api/server.go`, `api/internal/api/server_test.go`

- [ ] **Step 1: Write the failing test**

`api/internal/api/server_test.go`:
```go
package api

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestHealthz(t *testing.T) {
	s := New(Deps{})
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)
	require.Contains(t, rec.Body.String(), `"status":"ok"`)
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd api && go test ./internal/api/...`
Expected: FAIL — `New`/`Deps` undefined.

- [ ] **Step 3: Implement the error envelope**

`api/internal/api/errors.go`:
```go
package api

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

type APIError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Details any    `json:"details,omitempty"`
}

type errEnvelope struct {
	Error APIError `json:"error"`
}

// Fail returns a typed API error with an HTTP status.
func Fail(status int, code, msg string, details any) *echo.HTTPError {
	return &echo.HTTPError{Code: status, Message: errEnvelope{APIError{code, msg, details}}}
}

func errorHandler(err error, c echo.Context) {
	if c.Response().Committed {
		return
	}
	if he, ok := err.(*echo.HTTPError); ok {
		if env, ok := he.Message.(errEnvelope); ok {
			_ = c.JSON(he.Code, env)
			return
		}
		_ = c.JSON(he.Code, errEnvelope{APIError{"error", http.StatusText(he.Code), he.Message}})
		return
	}
	_ = c.JSON(http.StatusInternalServerError, errEnvelope{APIError{"internal", "internal server error", nil}})
}
```

- [ ] **Step 4: Implement the server**

`api/internal/api/server.go`:
```go
package api

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

// Deps holds the services handlers need. Populated in cmd/server.
// Fields added as later tasks introduce services.
type Deps struct {
	JWTSecret string
}

type Server struct {
	Echo *echo.Echo
	deps Deps
}

func New(deps Deps) *Server {
	e := echo.New()
	e.HideBanner = true
	e.HTTPErrorHandler = errorHandler
	e.Use(middleware.Recover())
	e.Use(middleware.RequestID())

	s := &Server{Echo: e, deps: deps}
	e.GET("/healthz", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
	})
	return s
}
```

- [ ] **Step 5: Add deps and run tests**

Run:
```bash
cd api && go get github.com/labstack/echo/v4
go test ./internal/api/...
```
Expected: PASS.

- [ ] **Step 6: Wire main to start the server**

Replace `api/cmd/server/main.go`:
```go
package main

import (
	"log"

	"github.com/tradermemos/api/internal/api"
	"github.com/tradermemos/api/internal/config"
	"github.com/tradermemos/api/internal/db"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	conn, err := db.Open(cfg.DBPath)
	if err != nil {
		log.Fatal(err)
	}
	if err := db.Migrate(conn); err != nil {
		log.Fatal(err)
	}
	s := api.New(api.Deps{JWTSecret: cfg.JWTSecret})
	log.Fatal(s.Echo.Start(":" + cfg.HTTPPort))
}
```

Note: ensure `data/` exists before opening (`os.MkdirAll(filepath.Dir(cfg.DBPath), 0o755)`); add that to main.

- [ ] **Step 7: Verify build + commit**

Run: `cd api && go build ./... && go test ./...`
Expected: PASS.
```bash
git add api
git commit -m "feat: echo server, health endpoint, error envelope"
```

---

## Milestone 1 — Schema & Store

### Task 5: Migrations for all Phase 1 tables

**Files:**
- Create migrations (each `.up.sql` + `.down.sql`):
  - `000002_users`, `000003_accounts`, `000004_instrument_specs`, `000005_import_batches`,
    `000006_executions`, `000007_trades`, `000008_trade_executions`, `000009_tags`,
    `000010_trade_tags`, `000011_cash_transactions`

- [ ] **Step 1: Write `000002_users.up.sql`**

```sql
CREATE TABLE users (
    id           TEXT PRIMARY KEY,
    email        TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    totp_secret  TEXT,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```
`000002_users.down.sql`: `DROP TABLE users;`

- [ ] **Step 2: Write `000003_accounts.up.sql`**

```sql
CREATE TABLE accounts (
    id               TEXT PRIMARY KEY,
    user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    broker           TEXT NOT NULL DEFAULT '',
    account_type     TEXT NOT NULL DEFAULT 'cash',   -- cash|margin|prop
    base_currency    TEXT NOT NULL DEFAULT 'USD',
    starting_balance REAL NOT NULL DEFAULT 0,
    created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_accounts_user ON accounts(user_id);
```
`down`: `DROP TABLE accounts;`

- [ ] **Step 3: Write `000004_instrument_specs.up.sql`**

```sql
CREATE TABLE instrument_specs (
    id              TEXT PRIMARY KEY,
    symbol_root     TEXT NOT NULL,
    instrument_type TEXT NOT NULL,    -- stock|option|future|forex|crypto
    tick_size       REAL NOT NULL DEFAULT 0.01,
    tick_value      REAL NOT NULL DEFAULT 0.01,
    multiplier      REAL NOT NULL DEFAULT 1,
    currency        TEXT NOT NULL DEFAULT 'USD',
    UNIQUE(symbol_root, instrument_type)
);
```
`down`: `DROP TABLE instrument_specs;`

- [ ] **Step 4: Write `000005_import_batches.up.sql`**

```sql
CREATE TABLE import_batches (
    id             TEXT PRIMARY KEY,
    user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id     TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    source         TEXT NOT NULL,                 -- csv|manual|api
    filename       TEXT,
    column_mapping TEXT,                          -- JSON
    row_count      INTEGER NOT NULL DEFAULT 0,
    status         TEXT NOT NULL DEFAULT 'pending', -- pending|committed|reversed
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_import_batches_user ON import_batches(user_id);
```
`down`: `DROP TABLE import_batches;`

- [ ] **Step 5: Write `000006_executions.up.sql`**

```sql
CREATE TABLE executions (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id      TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    external_id     TEXT,
    symbol          TEXT NOT NULL,
    instrument_type TEXT NOT NULL,
    side            TEXT NOT NULL,                 -- buy|sell
    quantity        REAL NOT NULL,
    price           REAL NOT NULL,
    fees            REAL NOT NULL DEFAULT 0,
    commission      REAL NOT NULL DEFAULT 0,
    executed_at     TIMESTAMP NOT NULL,
    multiplier      REAL NOT NULL DEFAULT 1,
    details         TEXT,                          -- JSON
    import_batch_id TEXT REFERENCES import_batches(id) ON DELETE SET NULL,
    dedup_hash      TEXT NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_exec_group ON executions(user_id, account_id, symbol, instrument_type, executed_at);
CREATE UNIQUE INDEX idx_exec_dedup ON executions(account_id, dedup_hash);
```
`down`: `DROP TABLE executions;`

- [ ] **Step 6: Write `000007_trades.up.sql`**

```sql
CREATE TABLE trades (
    id                TEXT PRIMARY KEY,
    user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id        TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    symbol            TEXT NOT NULL,
    instrument_type   TEXT NOT NULL,
    direction         TEXT NOT NULL,               -- long|short
    status            TEXT NOT NULL,               -- open|closed
    opened_at         TIMESTAMP NOT NULL,
    closed_at         TIMESTAMP,
    qty_opened        REAL NOT NULL,
    avg_entry_price   REAL NOT NULL,
    avg_exit_price    REAL,
    gross_pnl         REAL,
    fees_total        REAL NOT NULL DEFAULT 0,
    net_pnl           REAL,
    pnl_currency      TEXT NOT NULL DEFAULT 'USD',
    return_pct        REAL,
    r_multiple        REAL,
    time_in_trade_secs INTEGER,
    notes             TEXT NOT NULL DEFAULT '',
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_trades_account_closed ON trades(user_id, account_id, closed_at);
CREATE INDEX idx_trades_symbol ON trades(user_id, symbol);
```
`down`: `DROP TABLE trades;`

- [ ] **Step 7: Write the remaining migrations**

`000008_trade_executions.up.sql`:
```sql
CREATE TABLE trade_executions (
    trade_id     TEXT NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    execution_id TEXT NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
    PRIMARY KEY (trade_id, execution_id)
);
CREATE INDEX idx_te_execution ON trade_executions(execution_id);
```
`000009_tags.up.sql`:
```sql
CREATE TABLE tags (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    color       TEXT NOT NULL DEFAULT '#CBD5E1',
    description TEXT NOT NULL DEFAULT '',
    UNIQUE(user_id, name)
);
```
`000010_trade_tags.up.sql`:
```sql
CREATE TABLE trade_tags (
    trade_id TEXT NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    tag_id   TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (trade_id, tag_id)
);
```
`000011_cash_transactions.up.sql`:
```sql
CREATE TABLE cash_transactions (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id      TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    type            TEXT NOT NULL,                 -- deposit|withdrawal|fee|dividend|interest|adjustment
    amount          REAL NOT NULL,                 -- signed
    currency        TEXT NOT NULL DEFAULT 'USD',
    occurred_at     TIMESTAMP NOT NULL,
    note            TEXT NOT NULL DEFAULT '',
    import_batch_id TEXT REFERENCES import_batches(id) ON DELETE SET NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_cash_account ON cash_transactions(user_id, account_id, occurred_at);
```
Each gets a matching `.down.sql` with `DROP TABLE <name>;`.

- [ ] **Step 8: Verify migrations apply**

Run: `cd api && go test ./internal/db/...`
Expected: PASS (the existing `TestOpenAndMigrate` now runs all 11 migrations).

- [ ] **Step 9: Commit**

```bash
git add api/migrations
git commit -m "feat: phase 1 schema migrations"
```

---

### Task 6: sqlc setup + generated store

**Files:**
- Create: `api/sqlc.yaml`, query files under `api/internal/store/queries/`, generated code under `api/internal/store/`
- Create: `api/internal/store/store_test.go`

- [ ] **Step 1: Write `api/sqlc.yaml`**

```yaml
version: "2"
sql:
  - engine: "sqlite"
    schema: "migrations"
    queries: "internal/store/queries"
    gen:
      go:
        package: "store"
        out: "internal/store"
        emit_json_tags: true
        emit_interface: true
        overrides:
          - db_type: "TIMESTAMP"
            go_type: "time.Time"
```

- [ ] **Step 2: Write user + account queries**

`api/internal/store/queries/users.sql`:
```sql
-- name: CreateUser :one
INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?) RETURNING *;

-- name: GetUserByEmail :one
SELECT * FROM users WHERE email = ?;

-- name: GetUserByID :one
SELECT * FROM users WHERE id = ?;
```

`api/internal/store/queries/accounts.sql`:
```sql
-- name: CreateAccount :one
INSERT INTO accounts (id, user_id, name, broker, account_type, base_currency, starting_balance)
VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *;

-- name: ListAccounts :many
SELECT * FROM accounts WHERE user_id = ? ORDER BY created_at;

-- name: GetAccount :one
SELECT * FROM accounts WHERE id = ? AND user_id = ?;

-- name: DeleteAccount :exec
DELETE FROM accounts WHERE id = ? AND user_id = ?;
```

- [ ] **Step 3: Write execution / trade / cash / tag / import queries**

`api/internal/store/queries/executions.sql`:
```sql
-- name: InsertExecution :one
INSERT INTO executions (id, user_id, account_id, external_id, symbol, instrument_type, side,
    quantity, price, fees, commission, executed_at, multiplier, details, import_batch_id, dedup_hash)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *;

-- name: ListExecutionsForAccount :many
SELECT * FROM executions WHERE user_id = ? AND account_id = ? ORDER BY executed_at, id;

-- name: DeleteExecutionsForBatch :exec
DELETE FROM executions WHERE import_batch_id = ? AND user_id = ?;

-- name: ExecutionExists :one
SELECT EXISTS(SELECT 1 FROM executions WHERE account_id = ? AND dedup_hash = ?);
```

`api/internal/store/queries/trades.sql`:
```sql
-- name: DeleteTradesForAccount :exec
DELETE FROM trades WHERE user_id = ? AND account_id = ?;

-- name: InsertTrade :one
INSERT INTO trades (id, user_id, account_id, symbol, instrument_type, direction, status,
    opened_at, closed_at, qty_opened, avg_entry_price, avg_exit_price, gross_pnl, fees_total,
    net_pnl, pnl_currency, return_pct, r_multiple, time_in_trade_secs, notes)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *;

-- name: LinkTradeExecution :exec
INSERT INTO trade_executions (trade_id, execution_id) VALUES (?, ?);

-- name: GetTrade :one
SELECT * FROM trades WHERE id = ? AND user_id = ?;

-- name: UpdateTradeNotes :exec
UPDATE trades SET notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?;

-- name: ListClosedTrades :many
SELECT * FROM trades
WHERE user_id = ? AND status = 'closed'
  AND (sqlc.narg('account_id') IS NULL OR account_id = sqlc.narg('account_id'))
  AND (sqlc.narg('from') IS NULL OR closed_at >= sqlc.narg('from'))
  AND (sqlc.narg('to') IS NULL OR closed_at <= sqlc.narg('to'))
ORDER BY closed_at;
```

`api/internal/store/queries/cash.sql`:
```sql
-- name: InsertCashTransaction :one
INSERT INTO cash_transactions (id, user_id, account_id, type, amount, currency, occurred_at, note, import_batch_id)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *;

-- name: ListCashTransactions :many
SELECT * FROM cash_transactions
WHERE user_id = ? AND (sqlc.narg('account_id') IS NULL OR account_id = sqlc.narg('account_id'))
ORDER BY occurred_at;

-- name: DeleteCashTransaction :exec
DELETE FROM cash_transactions WHERE id = ? AND user_id = ?;
```

`api/internal/store/queries/tags.sql`:
```sql
-- name: CreateTag :one
INSERT INTO tags (id, user_id, name, color, description) VALUES (?, ?, ?, ?, ?) RETURNING *;

-- name: ListTags :many
SELECT * FROM tags WHERE user_id = ? ORDER BY name;

-- name: DeleteTag :exec
DELETE FROM tags WHERE id = ? AND user_id = ?;

-- name: SetTradeTags :exec
INSERT OR IGNORE INTO trade_tags (trade_id, tag_id) VALUES (?, ?);

-- name: ClearTradeTags :exec
DELETE FROM trade_tags WHERE trade_id = ?;

-- name: ListTagsForTrade :many
SELECT t.* FROM tags t JOIN trade_tags tt ON tt.tag_id = t.id WHERE tt.trade_id = ?;
```

`api/internal/store/queries/imports.sql`:
```sql
-- name: CreateImportBatch :one
INSERT INTO import_batches (id, user_id, account_id, source, filename, column_mapping, row_count, status)
VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *;

-- name: SetImportBatchStatus :exec
UPDATE import_batches SET status = ? WHERE id = ? AND user_id = ?;

-- name: ListImportBatches :many
SELECT * FROM import_batches WHERE user_id = ? ORDER BY created_at DESC;

-- name: GetImportBatch :one
SELECT * FROM import_batches WHERE id = ? AND user_id = ?;
```

`api/internal/store/queries/instrument_specs.sql`:
```sql
-- name: UpsertInstrumentSpec :exec
INSERT INTO instrument_specs (id, symbol_root, instrument_type, tick_size, tick_value, multiplier, currency)
VALUES (?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(symbol_root, instrument_type) DO UPDATE SET
    tick_size = excluded.tick_size, tick_value = excluded.tick_value,
    multiplier = excluded.multiplier, currency = excluded.currency;

-- name: GetInstrumentSpec :one
SELECT * FROM instrument_specs WHERE symbol_root = ? AND instrument_type = ?;
```

- [ ] **Step 4: Generate the store**

Run:
```bash
cd api && sqlc generate
```
Expected: creates `internal/store/{db.go,models.go,querier.go,*.sql.go}`, exit 0. If `sqlc` is not installed: `go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest`.

- [ ] **Step 5: Write a store round-trip test**

`api/internal/store/store_test.go`:
```go
package store_test

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/db"
	"github.com/tradermemos/api/internal/store"
)

func newStore(t *testing.T) (*store.Queries, func()) {
	conn, err := db.Open(filepath.Join(t.TempDir(), "t.db"))
	require.NoError(t, err)
	require.NoError(t, db.Migrate(conn))
	return store.New(conn), func() { conn.Close() }
}

func TestUserAccountRoundTrip(t *testing.T) {
	q, done := newStore(t)
	defer done()
	ctx := context.Background()

	u, err := q.CreateUser(ctx, store.CreateUserParams{
		ID: uuid.NewString(), Email: "a@b.com", PasswordHash: "x",
	})
	require.NoError(t, err)

	acc, err := q.CreateAccount(ctx, store.CreateAccountParams{
		ID: uuid.NewString(), UserID: u.ID, Name: "Main",
		Broker: "ibkr", AccountType: "margin", BaseCurrency: "USD", StartingBalance: 10000,
	})
	require.NoError(t, err)

	got, err := q.GetAccount(ctx, store.GetAccountParams{ID: acc.ID, UserID: u.ID})
	require.NoError(t, err)
	require.Equal(t, "Main", got.Name)
	require.WithinDuration(t, time.Now(), got.CreatedAt, time.Minute)
}
```

- [ ] **Step 6: Add deps, generate, run**

Run:
```bash
cd api && go get github.com/google/uuid
go test ./internal/store/...
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add api/sqlc.yaml api/internal/store api/go.mod api/go.sum
git commit -m "feat: sqlc store for phase 1 tables"
```

---

## Milestone 2 — Domain Core

### Task 7: Money helper

**Files:**
- Create: `api/internal/money/money.go`, `api/internal/money/money_test.go`

- [ ] **Step 1: Write the failing test**

`api/internal/money/money_test.go`:
```go
package money

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRound2(t *testing.T) {
	require.Equal(t, 12.35, Round2(12.345))
	require.Equal(t, -0.01, Round2(-0.005))
	require.Equal(t, 100.0, Round2(99.999999))
}
```

- [ ] **Step 2: Run to verify fail**

Run: `cd api && go test ./internal/money/...`
Expected: FAIL — undefined.

- [ ] **Step 3: Implement**

`api/internal/money/money.go`:
```go
package money

import "math"

// Round2 rounds to 2 decimal places using round-half-away-from-zero.
func Round2(v float64) float64 {
	if v >= 0 {
		return math.Floor(v*100+0.5) / 100
	}
	return math.Ceil(v*100-0.5) / 100
}
```

- [ ] **Step 4: Run to verify pass + commit**

Run: `cd api && go test ./internal/money/...`
Expected: PASS.
```bash
git add api/internal/money
git commit -m "feat: money rounding helper"
```

---

### Task 8: Grouping engine — the crux (TDD)

**Files:**
- Create: `api/internal/trades/engine.go`, `api/internal/trades/engine_test.go`

The engine is a **pure function** over a slice of input executions (no DB), so it is exhaustively unit-testable. The service layer (Task 9) loads from the store and persists results.

- [ ] **Step 1: Define the engine's input/output types and write the first failing test (simple long round-trip)**

`api/internal/trades/engine_test.go`:
```go
package trades

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func ex(id, side string, qty, price float64, t string, mult float64) Execution {
	ts, _ := time.Parse(time.RFC3339, t)
	return Execution{ID: id, Symbol: "AAPL", InstrumentType: "stock", Side: side,
		Quantity: qty, Price: price, ExecutedAt: ts, Multiplier: mult}
}

func TestSimpleLongRoundTrip(t *testing.T) {
	fills := []Execution{
		ex("1", "buy", 100, 10.0, "2026-01-01T10:00:00Z", 1),
		ex("2", "sell", 100, 12.0, "2026-01-01T11:00:00Z", 1),
	}
	out := Group(fills)
	require.Len(t, out, 1)
	tr := out[0]
	require.Equal(t, "long", tr.Direction)
	require.Equal(t, "closed", tr.Status)
	require.Equal(t, 100.0, tr.QtyOpened)
	require.Equal(t, 10.0, tr.AvgEntryPrice)
	require.Equal(t, 12.0, *tr.AvgExitPrice)
	require.Equal(t, 200.0, *tr.NetPnl) // (12-10)*100
	require.Equal(t, []string{"1", "2"}, tr.ExecutionIDs)
}
```

- [ ] **Step 2: Run to verify fail**

Run: `cd api && go test ./internal/trades/...`
Expected: FAIL — `Group`/`Execution` undefined.

- [ ] **Step 3: Implement the engine**

`api/internal/trades/engine.go`:
```go
package trades

import (
	"sort"
	"time"

	"github.com/tradermemos/api/internal/money"
)

type Execution struct {
	ID             string
	Symbol         string
	InstrumentType string
	Side           string // buy|sell
	Quantity       float64
	Price          float64
	Fees           float64
	Commission     float64
	ExecutedAt     time.Time
	Multiplier     float64 // 1 stock, 100 option, tick-derived for futures
}

type Trade struct {
	Symbol           string
	InstrumentType   string
	Direction        string // long|short
	Status           string // open|closed
	OpenedAt         time.Time
	ClosedAt         *time.Time
	QtyOpened        float64
	AvgEntryPrice    float64
	AvgExitPrice     *float64
	GrossPnl         *float64
	FeesTotal        float64
	NetPnl           *float64
	ReturnPct        *float64
	TimeInTradeSecs  *int64
	ExecutionIDs     []string
}

// Group folds executions for a SINGLE (account,symbol,instrument) stream into round-trip trades
// using average-cost. Callers must pre-partition by symbol+instrument+account.
func Group(fills []Execution) []Trade {
	sort.SliceStable(fills, func(i, j int) bool {
		if fills[i].ExecutedAt.Equal(fills[j].ExecutedAt) {
			return fills[i].ID < fills[j].ID
		}
		return fills[i].ExecutedAt.Before(fills[j].ExecutedAt)
	})

	var trades []Trade
	var cur *openState

	for _, f := range fills {
		signed := f.Quantity
		if f.Side == "sell" {
			signed = -f.Quantity
		}
		mult := f.Multiplier
		if mult == 0 {
			mult = 1
		}

		if cur == nil {
			cur = newOpen(f, signed, mult)
			continue
		}

		// same direction → scale in
		if (cur.position > 0) == (signed > 0) {
			cur.scaleIn(f, signed, mult)
			continue
		}

		// opposite direction → reduce/close, possibly cross zero
		closeQty := min(abs(signed), abs(cur.position))
		cur.reduce(f, closeQty, mult)

		remaining := abs(signed) - closeQty
		if abs(cur.position) < 1e-9 {
			trades = append(trades, cur.finalize(f.ExecutedAt))
			cur = nil
			if remaining > 1e-9 {
				// crossing fill opens an opposite trade with the remainder
				crossSigned := remaining
				if signed < 0 {
					crossSigned = -remaining
				}
				cur = newOpen(f, crossSigned, mult)
				cur.opened.Quantity = remaining // record remainder qty for this leg
			}
		}
	}

	if cur != nil {
		trades = append(trades, cur.finalizeOpen())
	}
	return trades
}

type openState struct {
	symbol, instrument string
	direction          string
	position           float64 // signed remaining qty
	qtyOpened          float64 // total opened (absolute) for return calc
	entryNotional      float64 // sum(price*qty) on the opening side
	entryQty           float64
	exitNotional       float64
	exitQty            float64
	feesTotal          float64
	openedAt           time.Time
	execIDs            []string
	opened             Execution
}

func newOpen(f Execution, signed, mult float64) *openState {
	s := &openState{
		symbol: f.Symbol, instrument: f.InstrumentType,
		openedAt: f.ExecutedAt, opened: f,
	}
	if signed > 0 {
		s.direction = "long"
	} else {
		s.direction = "short"
	}
	s.position = signed
	q := abs(signed)
	s.qtyOpened = q
	s.entryNotional = f.Price * q
	s.entryQty = q
	s.feesTotal += f.Fees + f.Commission
	s.execIDs = append(s.execIDs, f.ID)
	return s
}

func (s *openState) scaleIn(f Execution, signed, mult float64) {
	q := abs(signed)
	s.position += signed
	s.qtyOpened += q
	s.entryNotional += f.Price * q
	s.entryQty += q
	s.feesTotal += f.Fees + f.Commission
	s.execIDs = append(s.execIDs, f.ID)
}

func (s *openState) reduce(f Execution, closeQty, mult float64) {
	s.exitNotional += f.Price * closeQty
	s.exitQty += closeQty
	s.feesTotal += f.Fees + f.Commission
	s.execIDs = append(s.execIDs, f.ID)
	if s.position > 0 {
		s.position -= closeQty
	} else {
		s.position += closeQty
	}
	s.lastMult = mult
}

// add lastMult field used by finalize
```

Note for the implementer: add `lastMult float64` to `openState`. Continue with finalize methods in the next step.

- [ ] **Step 4: Add the finalize methods + helpers**

Append to `api/internal/trades/engine.go`:
```go
func (s *openState) finalize(closedAt time.Time) Trade {
	avgEntry := s.entryNotional / s.entryQty
	avgExit := s.exitNotional / s.exitQty
	mult := s.lastMult
	if mult == 0 {
		mult = 1
	}
	dirSign := 1.0
	if s.direction == "short" {
		dirSign = -1.0
	}
	gross := money.Round2((avgExit - avgEntry) * s.exitQty * dirSign * mult)
	net := money.Round2(gross - s.feesTotal)
	ret := 0.0
	if base := avgEntry * s.exitQty * mult; base != 0 {
		ret = money.Round2(net / base * 100)
	}
	secs := int64(closedAt.Sub(s.openedAt).Seconds())
	return Trade{
		Symbol: s.symbol, InstrumentType: s.instrument, Direction: s.direction,
		Status: "closed", OpenedAt: s.openedAt, ClosedAt: &closedAt,
		QtyOpened: s.qtyOpened, AvgEntryPrice: money.Round2(avgEntry),
		AvgExitPrice: f64(money.Round2(avgExit)), GrossPnl: f64(gross),
		FeesTotal: money.Round2(s.feesTotal), NetPnl: f64(net), ReturnPct: f64(ret),
		TimeInTradeSecs: &secs, ExecutionIDs: s.execIDs,
	}
}

func (s *openState) finalizeOpen() Trade {
	avgEntry := s.entryNotional / s.entryQty
	return Trade{
		Symbol: s.symbol, InstrumentType: s.instrument, Direction: s.direction,
		Status: "open", OpenedAt: s.openedAt, QtyOpened: s.qtyOpened,
		AvgEntryPrice: money.Round2(avgEntry), FeesTotal: money.Round2(s.feesTotal),
		ExecutionIDs: s.execIDs,
	}
}

func f64(v float64) *float64 { return &v }
func abs(v float64) float64  { if v < 0 { return -v }; return v }
func min(a, b float64) float64 { if a < b { return a }; return b }
```

- [ ] **Step 5: Run the first test**

Run: `cd api && go test ./internal/trades/... -run TestSimpleLongRoundTrip -v`
Expected: PASS.

- [ ] **Step 6: Add the full table of edge-case tests**

Append to `engine_test.go`:
```go
func TestShortRoundTrip(t *testing.T) {
	out := Group([]Execution{
		ex("1", "sell", 50, 20, "2026-01-01T10:00:00Z", 1),
		ex("2", "buy", 50, 18, "2026-01-01T12:00:00Z", 1),
	})
	require.Len(t, out, 1)
	require.Equal(t, "short", out[0].Direction)
	require.Equal(t, 100.0, *out[0].NetPnl) // (18-20)*50*-1
}

func TestScaleInAverageCost(t *testing.T) {
	out := Group([]Execution{
		ex("1", "buy", 100, 10, "2026-01-01T10:00:00Z", 1),
		ex("2", "buy", 100, 20, "2026-01-01T10:30:00Z", 1),
		ex("3", "sell", 200, 25, "2026-01-01T11:00:00Z", 1),
	})
	require.Len(t, out, 1)
	require.Equal(t, 15.0, out[0].AvgEntryPrice)      // (10+20)/2
	require.Equal(t, 2000.0, *out[0].NetPnl)          // (25-15)*200
}

func TestPartialExitsStayOneTrade(t *testing.T) {
	out := Group([]Execution{
		ex("1", "buy", 100, 10, "2026-01-01T10:00:00Z", 1),
		ex("2", "sell", 40, 12, "2026-01-01T10:30:00Z", 1),
		ex("3", "sell", 60, 14, "2026-01-01T11:00:00Z", 1),
	})
	require.Len(t, out, 1)
	require.Equal(t, "closed", out[0].Status)
	// avg exit = (12*40 + 14*60)/100 = 13.2 ; pnl = (13.2-10)*100 = 320
	require.Equal(t, 320.0, *out[0].NetPnl)
}

func TestZeroCrossSplitsIntoTwoTrades(t *testing.T) {
	out := Group([]Execution{
		ex("1", "buy", 100, 10, "2026-01-01T10:00:00Z", 1),
		ex("2", "sell", 150, 12, "2026-01-01T11:00:00Z", 1), // closes long 100, opens short 50
		ex("3", "buy", 50, 11, "2026-01-01T12:00:00Z", 1),   // closes the short
	})
	require.Len(t, out, 2)
	require.Equal(t, "long", out[0].Direction)
	require.Equal(t, 200.0, *out[0].NetPnl)  // (12-10)*100
	require.Equal(t, "short", out[1].Direction)
	require.Equal(t, 50.0, *out[1].NetPnl)   // (11-12)*50*-1
}

func TestFuturesMultiplier(t *testing.T) {
	// ES-like: 1 point = $50
	f := func(id, side string, qty, price float64, ts string) Execution {
		tt, _ := time.Parse(time.RFC3339, ts)
		return Execution{ID: id, Symbol: "ES", InstrumentType: "future", Side: side,
			Quantity: qty, Price: price, ExecutedAt: tt, Multiplier: 50}
	}
	out := Group([]Execution{
		f("1", "buy", 2, 5000, "2026-01-01T10:00:00Z"),
		f("2", "sell", 2, 5010, "2026-01-01T11:00:00Z"),
	})
	require.Equal(t, 1000.0, *out[0].NetPnl) // (5010-5000)*2*50
}

func TestFeesReduceNetPnl(t *testing.T) {
	a := ex("1", "buy", 100, 10, "2026-01-01T10:00:00Z", 1)
	a.Commission = 1
	b := ex("2", "sell", 100, 12, "2026-01-01T11:00:00Z", 1)
	b.Commission = 1
	out := Group([]Execution{a, b})
	require.Equal(t, 198.0, *out[0].NetPnl) // 200 - 2
	require.Equal(t, 2.0, out[0].FeesTotal)
}

func TestOpenTradeHasNoPnl(t *testing.T) {
	out := Group([]Execution{ex("1", "buy", 100, 10, "2026-01-01T10:00:00Z", 1)})
	require.Len(t, out, 1)
	require.Equal(t, "open", out[0].Status)
	require.Nil(t, out[0].NetPnl)
	require.Nil(t, out[0].ClosedAt)
}
```

- [ ] **Step 7: Run the full suite, fix until green**

Run: `cd api && go test ./internal/trades/... -v`
Expected: ALL PASS. (If `TestZeroCrossSplitsIntoTwoTrades` fails, the crossing-remainder branch in `Group` and the `opened.Quantity`/qtyOpened bookkeeping for the second leg is the place to fix — the second trade's `QtyOpened` must equal the remainder, 50.)

- [ ] **Step 8: Commit**

```bash
git add api/internal/trades
git commit -m "feat: executions->trades grouping engine (average-cost) with full edge-case tests"
```

---

### Task 9: Grouping service (store-backed Regroup)

**Files:**
- Create: `api/internal/trades/service.go`, `api/internal/trades/service_test.go`

- [ ] **Step 1: Write the failing test**

`api/internal/trades/service_test.go`:
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

func TestRegroupPersistsClosedTrade(t *testing.T) {
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

	closed, err := q.ListClosedTrades(ctx, store.ListClosedTradesParams{UserID: u.ID})
	require.NoError(t, err)
	require.Len(t, closed, 1)
	require.Equal(t, 200.0, *closed[0].NetPnl)
}
```

- [ ] **Step 2: Run to verify fail**

Run: `cd api && go test ./internal/trades/... -run TestRegroup`
Expected: FAIL — `NewService` undefined.

- [ ] **Step 3: Implement the service**

`api/internal/trades/service.go`:
```go
package trades

import (
	"context"

	"github.com/google/uuid"
	"github.com/tradermemos/api/internal/store"
)

type Service struct{ q *store.Queries }

func NewService(q *store.Queries) *Service { return &Service{q: q} }

// Regroup rebuilds all trades for an account from its executions. Idempotent.
func (s *Service) Regroup(ctx context.Context, userID, accountID string) error {
	rows, err := s.q.ListExecutionsForAccount(ctx, store.ListExecutionsForAccountParams{UserID: userID, AccountID: accountID})
	if err != nil {
		return err
	}
	// partition by symbol+instrument
	groups := map[string][]Execution{}
	for _, r := range rows {
		key := r.Symbol + "|" + r.InstrumentType
		groups[key] = append(groups[key], Execution{
			ID: r.ID, Symbol: r.Symbol, InstrumentType: r.InstrumentType, Side: r.Side,
			Quantity: r.Quantity, Price: r.Price, Fees: r.Fees, Commission: r.Commission,
			ExecutedAt: r.ExecutedAt, Multiplier: r.Multiplier,
		})
	}
	if err := s.q.DeleteTradesForAccount(ctx, store.DeleteTradesForAccountParams{UserID: userID, AccountID: accountID}); err != nil {
		return err
	}
	for _, g := range groups {
		for _, tr := range Group(g) {
			id := uuid.NewString()
			_, err := s.q.InsertTrade(ctx, toInsertParams(id, userID, accountID, tr))
			if err != nil {
				return err
			}
			for _, eid := range tr.ExecutionIDs {
				if err := s.q.LinkTradeExecution(ctx, store.LinkTradeExecutionParams{TradeID: id, ExecutionID: eid}); err != nil {
					return err
				}
			}
		}
	}
	return nil
}
```

Add `toInsertParams` mapping `Trade` → `store.InsertTradeParams` (handle nil pointers → `sql.Null*` per the generated types; consult `store.InsertTradeParams` field types after `sqlc generate`). Default `pnl_currency` to the account `base_currency` (load it once at the top of `Regroup`).

- [ ] **Step 4: Run to verify pass**

Run: `cd api && go test ./internal/trades/...`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/internal/trades
git commit -m "feat: store-backed Regroup service rebuilding trades from executions"
```

---

### Task 10: Analytics (pure computations)

**Files:**
- Create: `api/internal/analytics/analytics.go`, `api/internal/analytics/analytics_test.go`

- [ ] **Step 1: Write the failing test**

`api/internal/analytics/analytics_test.go`:
```go
package analytics

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func tr(net float64, closed string) ClosedTrade {
	tt, _ := time.Parse(time.RFC3339, closed)
	return ClosedTrade{NetPnl: net, FeesTotal: 1, ClosedAt: tt}
}

func TestSummary(t *testing.T) {
	in := []ClosedTrade{
		tr(200, "2026-01-01T11:00:00Z"),
		tr(-100, "2026-01-02T11:00:00Z"),
		tr(300, "2026-01-03T11:00:00Z"),
	}
	s := Summarize(in)
	require.Equal(t, 3, s.TotalTrades)
	require.Equal(t, 2, s.Wins)
	require.Equal(t, 1, s.Losses)
	require.InDelta(t, 0.6667, s.WinRate, 0.001)
	require.Equal(t, 400.0, s.NetPnl)          // 200-100+300
	require.Equal(t, 5.0, s.ProfitFactor)      // (200+300)/100
	require.Equal(t, 250.0, s.AvgWin)
	require.Equal(t, 100.0, s.AvgLoss)
}

func TestEquityCurveAndDrawdown(t *testing.T) {
	in := []ClosedTrade{
		tr(100, "2026-01-01T11:00:00Z"),
		tr(-50, "2026-01-02T11:00:00Z"),
		tr(25, "2026-01-03T11:00:00Z"),
	}
	curve := EquityCurve(1000, nil, in)
	require.Equal(t, 1100.0, curve.Points[0].Equity)
	require.Equal(t, 1050.0, curve.Points[1].Equity)
	require.Equal(t, 1075.0, curve.Points[2].Equity)
	require.Equal(t, 50.0, curve.MaxDrawdown) // peak 1100 -> trough 1050
}
```

- [ ] **Step 2: Run to verify fail**

Run: `cd api && go test ./internal/analytics/...`
Expected: FAIL — undefined.

- [ ] **Step 3: Implement analytics**

`api/internal/analytics/analytics.go`:
```go
package analytics

import (
	"sort"
	"time"

	"github.com/tradermemos/api/internal/money"
)

type ClosedTrade struct {
	NetPnl    float64
	FeesTotal float64
	ClosedAt  time.Time
}

type CashFlow struct {
	Amount     float64
	OccurredAt time.Time
}

type Summary struct {
	TotalTrades  int     `json:"total_trades"`
	Wins         int     `json:"wins"`
	Losses       int     `json:"losses"`
	Breakeven    int     `json:"breakeven"`
	WinRate      float64 `json:"win_rate"`
	NetPnl       float64 `json:"net_pnl"`
	GrossProfit  float64 `json:"gross_profit"`
	GrossLoss    float64 `json:"gross_loss"`
	ProfitFactor float64 `json:"profit_factor"`
	Expectancy   float64 `json:"expectancy"`
	AvgWin       float64 `json:"avg_win"`
	AvgLoss      float64 `json:"avg_loss"`
	AvgTrade     float64 `json:"avg_trade"`
	LargestWin   float64 `json:"largest_win"`
	LargestLoss  float64 `json:"largest_loss"`
	TotalFees    float64 `json:"total_fees"`
}

func Summarize(ts []ClosedTrade) Summary {
	var s Summary
	for _, t := range ts {
		s.TotalTrades++
		s.NetPnl += t.NetPnl
		s.TotalFees += t.FeesTotal
		switch {
		case t.NetPnl > 0:
			s.Wins++
			s.GrossProfit += t.NetPnl
			if t.NetPnl > s.LargestWin {
				s.LargestWin = t.NetPnl
			}
		case t.NetPnl < 0:
			s.Losses++
			s.GrossLoss += -t.NetPnl
			if -t.NetPnl > s.LargestLoss {
				s.LargestLoss = -t.NetPnl
			}
		default:
			s.Breakeven++
		}
	}
	if s.TotalTrades > 0 {
		s.WinRate = float64(s.Wins) / float64(s.TotalTrades)
		s.AvgTrade = money.Round2(s.NetPnl / float64(s.TotalTrades))
	}
	if s.Wins > 0 {
		s.AvgWin = money.Round2(s.GrossProfit / float64(s.Wins))
	}
	if s.Losses > 0 {
		s.AvgLoss = money.Round2(s.GrossLoss / float64(s.Losses))
	}
	if s.GrossLoss > 0 {
		s.ProfitFactor = money.Round2(s.GrossProfit / s.GrossLoss)
	}
	lossRate := 0.0
	if s.TotalTrades > 0 {
		lossRate = float64(s.Losses) / float64(s.TotalTrades)
	}
	s.Expectancy = money.Round2(s.WinRate*s.AvgWin - lossRate*s.AvgLoss)
	s.NetPnl = money.Round2(s.NetPnl)
	s.GrossProfit = money.Round2(s.GrossProfit)
	s.GrossLoss = money.Round2(s.GrossLoss)
	s.TotalFees = money.Round2(s.TotalFees)
	return s
}

type EquityPoint struct {
	At     time.Time `json:"at"`
	Equity float64   `json:"equity"`
}
type Equity struct {
	Points      []EquityPoint `json:"points"`
	MaxDrawdown float64       `json:"max_drawdown"`
}

// EquityCurve merges cash flows + closed-trade P&L chronologically onto a starting balance.
func EquityCurve(startingBalance float64, flows []CashFlow, ts []ClosedTrade) Equity {
	type ev struct {
		at     time.Time
		amount float64
	}
	var evs []ev
	for _, f := range flows {
		evs = append(evs, ev{f.OccurredAt, f.Amount})
	}
	for _, t := range ts {
		evs = append(evs, ev{t.ClosedAt, t.NetPnl})
	}
	sort.SliceStable(evs, func(i, j int) bool { return evs[i].at.Before(evs[j].at) })

	eq := startingBalance
	peak := startingBalance
	var out Equity
	for _, e := range evs {
		eq = money.Round2(eq + e.amount)
		if eq > peak {
			peak = eq
		}
		if dd := peak - eq; dd > out.MaxDrawdown {
			out.MaxDrawdown = money.Round2(dd)
		}
		out.Points = append(out.Points, EquityPoint{At: e.at, Equity: eq})
	}
	return out
}

// DailyPnl aggregates net P&L per calendar day (UTC). Feeds the Phase-2 calendar.
func DailyPnl(ts []ClosedTrade) map[string]float64 {
	out := map[string]float64{}
	for _, t := range ts {
		day := t.ClosedAt.UTC().Format("2006-01-02")
		out[day] = money.Round2(out[day] + t.NetPnl)
	}
	return out
}
```

- [ ] **Step 4: Run to verify pass + commit**

Run: `cd api && go test ./internal/analytics/...`
Expected: PASS.
```bash
git add api/internal/analytics
git commit -m "feat: analytics summary, balance-based equity curve, daily pnl"
```

---

## Milestone 3 — Importer

### Task 11: Importer interface + dedup + heuristic mapping

**Files:**
- Create: `api/internal/importer/importer.go`, `api/internal/importer/dedup.go`, `api/internal/importer/mapping.go`, `api/internal/importer/mapping_test.go`, `api/internal/importer/dedup_test.go`

- [ ] **Step 1: Write failing tests**

`api/internal/importer/dedup_test.go`:
```go
package importer

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestDedupHashStable(t *testing.T) {
	ts := time.Date(2026, 1, 1, 10, 0, 0, 0, time.UTC)
	a := DedupHash("AAPL", "buy", 100, 10.5, ts)
	b := DedupHash("AAPL", "buy", 100, 10.5, ts)
	c := DedupHash("AAPL", "sell", 100, 10.5, ts)
	require.Equal(t, a, b)
	require.NotEqual(t, a, c)
}
```

`api/internal/importer/mapping_test.go`:
```go
package importer

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSuggestMapping(t *testing.T) {
	headers := []string{"Symbol", "B/S", "Qty", "Fill Price", "Trade Date", "Commission"}
	m := SuggestMapping(headers)
	require.Equal(t, "Symbol", m["symbol"])
	require.Equal(t, "B/S", m["side"])
	require.Equal(t, "Qty", m["quantity"])
	require.Equal(t, "Fill Price", m["price"])
	require.Equal(t, "Trade Date", m["executed_at"])
	require.Equal(t, "Commission", m["commission"])
}
```

- [ ] **Step 2: Run to verify fail**

Run: `cd api && go test ./internal/importer/...`
Expected: FAIL — undefined.

- [ ] **Step 3: Implement interface + types**

`api/internal/importer/importer.go`:
```go
package importer

import "time"

// ParsedExecution is a broker-agnostic fill produced by an Importer.
type ParsedExecution struct {
	ExternalID     string
	Symbol         string
	InstrumentType string
	Side           string // buy|sell
	Quantity       float64
	Price          float64
	Fees           float64
	Commission     float64
	ExecutedAt     time.Time
}

type RowError struct {
	Row     int    `json:"row"`
	Message string `json:"message"`
}

type ParseResult struct {
	Executions []ParsedExecution
	Errors     []RowError
}

type Importer interface {
	Detect(headers []string) bool
	ParseRows(rows []map[string]string) ParseResult
	Name() string
}
```

- [ ] **Step 4: Implement dedup**

`api/internal/importer/dedup.go`:
```go
package importer

import (
	"crypto/sha256"
	"fmt"
	"time"
)

func DedupHash(symbol, side string, qty, price float64, at time.Time) string {
	raw := fmt.Sprintf("%s|%s|%.4f|%.6f|%d", symbol, side, qty, price, at.UTC().Unix())
	sum := sha256.Sum256([]byte(raw))
	return fmt.Sprintf("%x", sum[:16])
}
```

- [ ] **Step 5: Implement heuristic mapping**

`api/internal/importer/mapping.go`:
```go
package importer

import "strings"

// canonical field -> candidate header substrings (lowercased)
var fieldHints = map[string][]string{
	"symbol":      {"symbol", "ticker", "instrument"},
	"side":        {"side", "b/s", "action", "buy/sell"},
	"quantity":    {"qty", "quantity", "shares", "contracts"},
	"price":       {"fill price", "price", "avg price", "exec price"},
	"executed_at": {"trade date", "date/time", "datetime", "time", "date"},
	"fees":        {"fee", "fees"},
	"commission":  {"commission", "comm"},
}

// SuggestMapping returns canonicalField -> originalHeader best guesses.
func SuggestMapping(headers []string) map[string]string {
	out := map[string]string{}
	for field, hints := range fieldHints {
		best := ""
		bestLen := 1 << 30
		for _, h := range headers {
			lh := strings.ToLower(strings.TrimSpace(h))
			for _, hint := range hints {
				if strings.Contains(lh, hint) && len(lh) < bestLen {
					best = h
					bestLen = len(lh)
				}
			}
		}
		if best != "" {
			out[field] = best
		}
	}
	return out
}
```

- [ ] **Step 6: Run to verify pass + commit**

Run: `cd api && go test ./internal/importer/...`
Expected: PASS.
```bash
git add api/internal/importer
git commit -m "feat: importer interface, dedup hash, heuristic column mapping"
```

---

### Task 12: Generic CSV importer

**Files:**
- Create: `api/internal/importer/generic.go`, `api/internal/importer/generic_test.go`
- Create: `api/testdata/generic_sample.csv`

- [ ] **Step 1: Write fixture + failing test**

`api/testdata/generic_sample.csv`:
```csv
Symbol,B/S,Qty,Fill Price,Trade Date,Commission
AAPL,BUY,100,10.00,2026-01-01T10:00:00Z,1.00
AAPL,SELL,100,12.00,2026-01-01T11:00:00Z,1.00
BADROW,BUY,notanumber,5,2026-01-01T10:00:00Z,0
```

`api/internal/importer/generic_test.go`:
```go
package importer

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGenericImporterParsesAndReportsBadRows(t *testing.T) {
	rows := []map[string]string{
		{"Symbol": "AAPL", "B/S": "BUY", "Qty": "100", "Fill Price": "10.00", "Trade Date": "2026-01-01T10:00:00Z", "Commission": "1.00"},
		{"Symbol": "BADROW", "B/S": "BUY", "Qty": "notanumber", "Fill Price": "5", "Trade Date": "2026-01-01T10:00:00Z", "Commission": "0"},
	}
	mapping := map[string]string{
		"symbol": "Symbol", "side": "B/S", "quantity": "Qty",
		"price": "Fill Price", "executed_at": "Trade Date", "commission": "Commission",
	}
	imp := NewGeneric(mapping, "stock")
	res := imp.ParseRows(rows)
	require.Len(t, res.Executions, 1)
	require.Equal(t, "buy", res.Executions[0].Side)
	require.Equal(t, 100.0, res.Executions[0].Quantity)
	require.Len(t, res.Errors, 1)
	require.Equal(t, 2, res.Errors[0].Row)
}
```

- [ ] **Step 2: Run to verify fail**

Run: `cd api && go test ./internal/importer/... -run TestGeneric`
Expected: FAIL — `NewGeneric` undefined.

- [ ] **Step 3: Implement generic importer**

`api/internal/importer/generic.go`:
```go
package importer

import (
	"fmt"
	"strconv"
	"strings"
	"time"
)

type Generic struct {
	mapping        map[string]string // canonicalField -> header
	instrumentType string
}

func NewGeneric(mapping map[string]string, instrumentType string) *Generic {
	return &Generic{mapping: mapping, instrumentType: instrumentType}
}

func (g *Generic) Name() string              { return "generic" }
func (g *Generic) Detect(_ []string) bool    { return true } // fallback importer

func (g *Generic) ParseRows(rows []map[string]string) ParseResult {
	var res ParseResult
	for i, row := range rows {
		ex, err := g.parseRow(row)
		if err != nil {
			res.Errors = append(res.Errors, RowError{Row: i + 1, Message: err.Error()})
			continue
		}
		res.Executions = append(res.Executions, ex)
	}
	return res
}

func (g *Generic) col(row map[string]string, field string) string {
	return strings.TrimSpace(row[g.mapping[field]])
}

func (g *Generic) parseRow(row map[string]string) (ParsedExecution, error) {
	var p ParsedExecution
	p.Symbol = g.col(row, "symbol")
	if p.Symbol == "" {
		return p, fmt.Errorf("missing symbol")
	}
	switch strings.ToLower(g.col(row, "side")) {
	case "buy", "b", "bot":
		p.Side = "buy"
	case "sell", "s", "sld":
		p.Side = "sell"
	default:
		return p, fmt.Errorf("invalid side %q", g.col(row, "side"))
	}
	qty, err := strconv.ParseFloat(g.col(row, "quantity"), 64)
	if err != nil {
		return p, fmt.Errorf("invalid quantity")
	}
	p.Quantity = qty
	price, err := strconv.ParseFloat(g.col(row, "price"), 64)
	if err != nil {
		return p, fmt.Errorf("invalid price")
	}
	p.Price = price
	ts, err := parseTime(g.col(row, "executed_at"))
	if err != nil {
		return p, fmt.Errorf("invalid date %q", g.col(row, "executed_at"))
	}
	p.ExecutedAt = ts
	if c := g.col(row, "commission"); c != "" {
		p.Commission, _ = strconv.ParseFloat(c, 64)
	}
	if f := g.col(row, "fees"); f != "" {
		p.Fees, _ = strconv.ParseFloat(f, 64)
	}
	p.InstrumentType = g.instrumentType
	return p, nil
}

func parseTime(s string) (time.Time, error) {
	layouts := []string{time.RFC3339, "2006-01-02 15:04:05", "2006-01-02T15:04:05", "01/02/2006 15:04:05", "2006-01-02"}
	for _, l := range layouts {
		if t, err := time.Parse(l, s); err == nil {
			return t.UTC(), nil
		}
	}
	return time.Time{}, fmt.Errorf("unrecognized time")
}
```

- [ ] **Step 4: Run to verify pass + commit**

Run: `cd api && go test ./internal/importer/...`
Expected: PASS.
```bash
git add api/internal/importer api/testdata
git commit -m "feat: generic column-mapping CSV importer with per-row error reporting"
```

---

## Milestone 4 — Auth

### Task 13: Password + JWT + auth service

**Files:**
- Create: `api/internal/auth/password.go`, `api/internal/auth/jwt.go`, `api/internal/auth/service.go`, plus `*_test.go`

- [ ] **Step 1: Write failing tests**

`api/internal/auth/password_test.go`:
```go
package auth

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPasswordHashVerify(t *testing.T) {
	h, err := HashPassword("hunter2")
	require.NoError(t, err)
	require.True(t, VerifyPassword(h, "hunter2"))
	require.False(t, VerifyPassword(h, "wrong"))
}
```

`api/internal/auth/jwt_test.go`:
```go
package auth

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestJWTRoundTrip(t *testing.T) {
	m := NewJWT("secret")
	tok, err := m.Mint("user-123", time.Minute)
	require.NoError(t, err)
	uid, err := m.Parse(tok)
	require.NoError(t, err)
	require.Equal(t, "user-123", uid)
}

func TestJWTExpired(t *testing.T) {
	m := NewJWT("secret")
	tok, _ := m.Mint("u", -time.Minute)
	_, err := m.Parse(tok)
	require.Error(t, err)
}
```

- [ ] **Step 2: Run to verify fail**

Run: `cd api && go test ./internal/auth/...`
Expected: FAIL — undefined.

- [ ] **Step 3: Implement password**

`api/internal/auth/password.go`:
```go
package auth

import "golang.org/x/crypto/bcrypt"

func HashPassword(pw string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(pw), bcrypt.DefaultCost)
	return string(b), err
}

func VerifyPassword(hash, pw string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(pw)) == nil
}
```

- [ ] **Step 4: Implement JWT**

`api/internal/auth/jwt.go`:
```go
package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type JWT struct{ secret []byte }

func NewJWT(secret string) *JWT { return &JWT{secret: []byte(secret)} }

func (j *JWT) Mint(userID string, ttl time.Duration) (string, error) {
	claims := jwt.RegisteredClaims{
		Subject:   userID,
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(ttl)),
		IssuedAt:  jwt.NewNumericDate(time.Now()),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(j.secret)
}

func (j *JWT) Parse(tok string) (string, error) {
	parsed, err := jwt.ParseWithClaims(tok, &jwt.RegisteredClaims{}, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("bad signing method")
		}
		return j.secret, nil
	})
	if err != nil {
		return "", err
	}
	claims, ok := parsed.Claims.(*jwt.RegisteredClaims)
	if !ok || !parsed.Valid {
		return "", errors.New("invalid token")
	}
	return claims.Subject, nil
}
```

- [ ] **Step 5: Implement service**

`api/internal/auth/service.go`:
```go
package auth

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/tradermemos/api/internal/store"
)

var ErrInvalidCredentials = errors.New("invalid credentials")

type Service struct {
	q   *store.Queries
	jwt *JWT
}

func NewService(q *store.Queries, jwt *JWT) *Service { return &Service{q: q, jwt: jwt} }

type Tokens struct {
	Access  string `json:"access_token"`
	Refresh string `json:"refresh_token"`
}

func (s *Service) Register(ctx context.Context, email, password string) (store.User, error) {
	h, err := HashPassword(password)
	if err != nil {
		return store.User{}, err
	}
	return s.q.CreateUser(ctx, store.CreateUserParams{ID: uuid.NewString(), Email: email, PasswordHash: h})
}

func (s *Service) Login(ctx context.Context, email, password string) (Tokens, store.User, error) {
	u, err := s.q.GetUserByEmail(ctx, email)
	if err != nil || !VerifyPassword(u.PasswordHash, password) {
		return Tokens{}, store.User{}, ErrInvalidCredentials
	}
	return s.mint(u.ID), u, nil
}

func (s *Service) Refresh(refresh string) (Tokens, error) {
	uid, err := s.jwt.Parse(refresh)
	if err != nil {
		return Tokens{}, ErrInvalidCredentials
	}
	return s.mint(uid), nil
}

func (s *Service) mint(uid string) Tokens {
	access, _ := s.jwt.Mint(uid, 15*time.Minute)
	refresh, _ := s.jwt.Mint(uid, 30*24*time.Hour)
	return Tokens{Access: access, Refresh: refresh}
}
```

- [ ] **Step 6: Add deps, run tests**

Run:
```bash
cd api && go get github.com/golang-jwt/jwt/v5 golang.org/x/crypto/bcrypt
go test ./internal/auth/...
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add api/internal/auth api/go.mod api/go.sum
git commit -m "feat: auth — bcrypt passwords, JWT access/refresh, register/login/refresh"
```

---

### Task 14: Auth middleware (user_id injection)

**Files:**
- Create: `api/internal/auth/middleware.go`, `api/internal/auth/middleware_test.go`

- [ ] **Step 1: Write the failing test**

`api/internal/auth/middleware_test.go`:
```go
package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/require"
)

func TestMiddlewareRejectsMissingToken(t *testing.T) {
	e := echo.New()
	m := NewJWT("s")
	h := Middleware(m)(func(c echo.Context) error { return c.String(200, "ok") })
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	require.Error(t, h(e.NewContext(req, rec)))
}

func TestMiddlewareInjectsUserID(t *testing.T) {
	e := echo.New()
	m := NewJWT("s")
	tok, _ := m.Mint("u-1", 60_000_000_000) // 1 minute in ns
	var seen string
	h := Middleware(m)(func(c echo.Context) error {
		seen = UserID(c)
		return c.String(200, "ok")
	})
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	require.NoError(t, h(e.NewContext(req, httptest.NewRecorder())))
	require.Equal(t, "u-1", seen)
}
```

- [ ] **Step 2: Run to verify fail**

Run: `cd api && go test ./internal/auth/... -run TestMiddleware`
Expected: FAIL — `Middleware`/`UserID` undefined.

- [ ] **Step 3: Implement middleware**

`api/internal/auth/middleware.go`:
```go
package auth

import (
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
)

const userKey = "uid"

func Middleware(j *JWT) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			h := c.Request().Header.Get("Authorization")
			if !strings.HasPrefix(h, "Bearer ") {
				return echo.NewHTTPError(http.StatusUnauthorized, "missing token")
			}
			uid, err := j.Parse(strings.TrimPrefix(h, "Bearer "))
			if err != nil {
				return echo.NewHTTPError(http.StatusUnauthorized, "invalid token")
			}
			c.Set(userKey, uid)
			return next(c)
		}
	}
}

func UserID(c echo.Context) string {
	if v, ok := c.Get(userKey).(string); ok {
		return v
	}
	return ""
}
```

- [ ] **Step 4: Run to verify pass + commit**

Run: `cd api && go test ./internal/auth/...`
Expected: PASS.
```bash
git add api/internal/auth
git commit -m "feat: JWT auth middleware injecting user_id"
```

---

## Milestone 5 — HTTP API

### Task 15: Wire services into the server + auth routes

**Files:**
- Modify: `api/internal/api/server.go`, `api/internal/api/errors.go`
- Create: `api/internal/api/auth_handlers.go`, `api/internal/api/auth_handlers_test.go`

- [ ] **Step 1: Expand `Deps` and route registration**

Modify `api/internal/api/server.go` — replace `Deps` and add a `register` step:
```go
type Deps struct {
	JWTSecret string
	Auth      *auth.Service
	JWT       *auth.JWT
	Store     *store.Queries
	Trades    *trades.Service
}
```
Add imports for `auth`, `store`, `trades`. After health route, call `s.routes()` (defined in handler files). Add:
```go
func (s *Server) routes() {
	v1 := s.Echo.Group("/api/v1")
	s.authRoutes(v1)
	protected := v1.Group("", auth.Middleware(s.deps.JWT))
	s.accountRoutes(protected)
	s.executionRoutes(protected)
	s.cashRoutes(protected)
	s.importRoutes(protected)
	s.tradeRoutes(protected)
	s.tagRoutes(protected)
	s.analyticsRoutes(protected)
}
```
Call `s.routes()` at the end of `New`.

- [ ] **Step 2: Write the failing handler test**

`api/internal/api/auth_handlers_test.go`:
```go
package api_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/api"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/db"
	"github.com/tradermemos/api/internal/store"
	"github.com/tradermemos/api/internal/trades"
)

func testServer(t *testing.T) *api.Server {
	conn, err := db.Open(t.TempDir() + "/t.db")
	require.NoError(t, err)
	require.NoError(t, db.Migrate(conn))
	q := store.New(conn)
	j := auth.NewJWT("test")
	return api.New(api.Deps{JWT: j, Auth: auth.NewService(q, j), Store: q, Trades: trades.NewService(q)})
}

func TestRegisterThenLogin(t *testing.T) {
	s := testServer(t)
	body := `{"email":"a@b.com","password":"hunter2"}`

	rec := httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/v1/auth/register", strings.NewReader(body)))
	require.Equal(t, http.StatusCreated, rec.Code)

	rec = httptest.NewRecorder()
	s.Echo.ServeHTTP(rec, jsonReq(http.MethodPost, "/api/v1/auth/login", body))
	require.Equal(t, http.StatusOK, rec.Code)
	require.Contains(t, rec.Body.String(), "access_token")
}

func jsonReq(method, path, body string) *http.Request {
	r := httptest.NewRequest(method, path, strings.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	return r
}
```

- [ ] **Step 3: Run to verify fail**

Run: `cd api && go test ./internal/api/... -run TestRegisterThenLogin`
Expected: FAIL — `authRoutes` undefined / 404.

- [ ] **Step 4: Implement auth handlers**

`api/internal/api/auth_handlers.go`:
```go
package api

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

type credentials struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (s *Server) authRoutes(g *echo.Group) {
	g.POST("/auth/register", s.handleRegister)
	g.POST("/auth/login", s.handleLogin)
	g.POST("/auth/refresh", s.handleRefresh)
}

func (s *Server) handleRegister(c echo.Context) error {
	var in credentials
	if err := c.Bind(&in); err != nil || in.Email == "" || in.Password == "" {
		return Fail(http.StatusBadRequest, "bad_request", "email and password required", nil)
	}
	u, err := s.deps.Auth.Register(c.Request().Context(), in.Email, in.Password)
	if err != nil {
		return Fail(http.StatusConflict, "conflict", "could not register", nil)
	}
	return c.JSON(http.StatusCreated, map[string]string{"id": u.ID, "email": u.Email})
}

func (s *Server) handleLogin(c echo.Context) error {
	var in credentials
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}
	toks, _, err := s.deps.Auth.Login(c.Request().Context(), in.Email, in.Password)
	if err != nil {
		return Fail(http.StatusUnauthorized, "unauthorized", "invalid credentials", nil)
	}
	return c.JSON(http.StatusOK, toks)
}

func (s *Server) handleRefresh(c echo.Context) error {
	var in struct {
		Refresh string `json:"refresh_token"`
	}
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid body", nil)
	}
	toks, err := s.deps.Auth.Refresh(in.Refresh)
	if err != nil {
		return Fail(http.StatusUnauthorized, "unauthorized", "invalid refresh token", nil)
	}
	return c.JSON(http.StatusOK, toks)
}
```

- [ ] **Step 5: Stub the other route groups so it compiles**

Create empty route methods now (filled in Task 16) in their files, each like:
```go
// api/internal/api/account_handlers.go
package api
import "github.com/labstack/echo/v4"
func (s *Server) accountRoutes(g *echo.Group) {}
```
Repeat for `executionRoutes`, `cashRoutes`, `importRoutes`, `tradeRoutes`, `tagRoutes`, `analyticsRoutes` in their respective files.

- [ ] **Step 6: Run to verify pass + commit**

Run: `cd api && go build ./... && go test ./internal/api/...`
Expected: PASS.
```bash
git add api/internal/api
git commit -m "feat: wire services, auth routes (register/login/refresh)"
```

---

### Task 16: Resource handlers (accounts, executions, cash, tags, trades, analytics, imports)

Implement each route group. Each follows the same pattern: parse `auth.UserID(c)`, bind/validate, call store/service, return JSON. Below are the required endpoints with exact handler behavior. Write a focused test per group asserting **happy path + user_id isolation**, then implement.

**Files:** `account_handlers.go`, `execution_handlers.go`, `cash_handlers.go`, `tag_handlers.go`, `trade_handlers.go`, `analytics_handlers.go`, `import_handlers.go`, `filters.go` (+ `*_test.go`).

- [ ] **Step 1: Shared filters helper**

`api/internal/api/filters.go`:
```go
package api

import (
	"database/sql"
	"time"

	"github.com/labstack/echo/v4"
)

type Filters struct {
	AccountID sql.NullString
	From      sql.NullTime
	To        sql.NullTime
	Symbol    string
}

func parseFilters(c echo.Context) Filters {
	var f Filters
	if v := c.QueryParam("account_id"); v != "" {
		f.AccountID = sql.NullString{String: v, Valid: true}
	}
	if v := c.QueryParam("from"); v != "" {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			f.From = sql.NullTime{Time: t, Valid: true}
		}
	}
	if v := c.QueryParam("to"); v != "" {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			f.To = sql.NullTime{Time: t, Valid: true}
		}
	}
	f.Symbol = c.QueryParam("symbol")
	return f
}
```

- [ ] **Step 2: Accounts — write test then implement**

Endpoints: `POST /accounts`, `GET /accounts`, `GET /accounts/:id`, `DELETE /accounts/:id`.
`account_handlers.go` `accountRoutes` registers them; handlers use `s.deps.Store` with `auth.UserID(c)`. `POST` body: `{name,broker,account_type,base_currency,starting_balance}` → `CreateAccount`. `GET` list → `ListAccounts(userID)`. `GET/:id` → `GetAccount{ID,UserID}` (404 on `sql.ErrNoRows`). `DELETE` → `DeleteAccount{ID,UserID}`.
Test `account_handlers_test.go`: register+login two users, create account as user A, assert user B's `GET /accounts` does **not** include it.

- [ ] **Step 3: Executions (manual fill) — test then implement**

Endpoints: `POST /executions` (single fill → insert with `DedupHash` computed via `importer.DedupHash`, `import_batch` source=manual), `GET /executions?account_id=...`. After a manual insert, call `s.deps.Trades.Regroup(ctx, userID, accountID)`. Test asserts inserting buy+sell then `GET /trades` returns a closed trade with correct P&L.

- [ ] **Step 4: Cash transactions — test then implement**

Endpoints: `POST /cash-transactions` `{account_id,type,amount,currency,occurred_at,note}`, `GET /cash-transactions?account_id=...`, `DELETE /cash-transactions/:id`. Validate `type ∈ {deposit,withdrawal,fee,dividend,interest,adjustment}`. Test: post a deposit, list it back scoped to the user.

- [ ] **Step 5: Tags — test then implement**

Endpoints: `POST /tags`, `GET /tags`, `DELETE /tags/:id`. Test: create + list scoped by user.

- [ ] **Step 6: Trades — test then implement**

Endpoints: `GET /trades` (filters → `ListClosedTrades`), `GET /trades/:id` (+ tags via `ListTagsForTrade`), `PATCH /trades/:id` `{notes,tag_ids[]}` (→ `UpdateTradeNotes`, `ClearTradeTags`+`SetTradeTags`), `POST /trades/regroup` `{account_id}`. Test: PATCH notes + tags, GET returns them.

- [ ] **Step 7: Analytics — test then implement**

Endpoints: `GET /analytics/summary`, `GET /analytics/equity-curve`, `GET /analytics/daily`. Each: load closed trades via `ListClosedTrades` (filters) → map to `analytics.ClosedTrade`; for equity-curve also load `cash_transactions` (→ `analytics.CashFlow`) and the account `starting_balance`. Return `analytics.Summarize(...)`, `analytics.EquityCurve(...)`, `analytics.DailyPnl(...)`. Test: seed two closed trades through the import path, assert `summary.net_pnl` and `summary.profit_factor`.

- [ ] **Step 8: Imports — test then implement**

Endpoints:
- `POST /imports` (multipart CSV upload + `account_id`, `instrument_type`) → parse headers, return `{import_batch_id, headers, sample_rows, suggested_mapping}` (status `pending`, store the batch).
- `POST /imports/:id/commit` `{column_mapping}` → re-read staged rows (store the raw CSV bytes on the batch row, or require re-upload; for Phase 1 require the client to resend the file with the mapping) → run `importer.NewGeneric(mapping, instrumentType).ParseRows`, dedup via `ExecutionExists`, insert executions tagged with `import_batch_id`, set batch `committed`, `Regroup`. Return `{inserted, skipped, errors}`.
- `GET /imports` → `ListImportBatches`.
- `DELETE /imports/:id` → `DeleteExecutionsForBatch`, set status `reversed`, `Regroup`.

Decision for Phase 1 (locked to avoid ambiguity): **commit re-sends the file** (multipart) together with the confirmed `column_mapping`; the server does not persist raw CSV between preview and commit. This keeps the batch row small and avoids blob storage.

Test `import_handlers_test.go`: POST the `testdata/generic_sample.csv` to `/imports` → assert suggested mapping; POST commit with the mapping + file → assert `inserted:2, errors:1`; `GET /trades` → one closed trade, net P&L 198 (with the $1+$1 commissions).

- [ ] **Step 9: Run the whole API suite**

Run: `cd api && go test ./internal/api/...`
Expected: ALL PASS.

- [ ] **Step 10: Commit**

```bash
git add api/internal/api
git commit -m "feat: account/execution/cash/tag/trade/analytics/import handlers with user-isolation tests"
```

---

## Milestone 6 — CLI & Seeds

### Task 17: cobra CLI (migrate, create-user, import, regroup) + futures spec seed

**Files:**
- Create: `api/cmd/cli/main.go`, `api/internal/store/seed.go`, `api/internal/store/seed_test.go`

- [ ] **Step 1: Write seed test**

`api/internal/store/seed_test.go`:
```go
package store_test

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/db"
	"github.com/tradermemos/api/internal/store"
)

func TestSeedInstrumentSpecs(t *testing.T) {
	conn, _ := db.Open(filepath.Join(t.TempDir(), "t.db"))
	require.NoError(t, db.Migrate(conn))
	q := store.New(conn)
	require.NoError(t, store.SeedInstrumentSpecs(context.Background(), q))
	es, err := q.GetInstrumentSpec(context.Background(), store.GetInstrumentSpecParams{SymbolRoot: "ES", InstrumentType: "future"})
	require.NoError(t, err)
	require.Equal(t, 50.0, es.Multiplier)
}
```

- [ ] **Step 2: Run to verify fail**

Run: `cd api && go test ./internal/store/... -run TestSeed`
Expected: FAIL — `SeedInstrumentSpecs` undefined.

- [ ] **Step 3: Implement seed**

`api/internal/store/seed.go`:
```go
package store

import (
	"context"

	"github.com/google/uuid"
)

type specSeed struct {
	root, itype       string
	tickSize, tickVal float64
	mult              float64
}

var futuresSeed = []specSeed{
	{"ES", "future", 0.25, 12.50, 50},
	{"NQ", "future", 0.25, 5.00, 20},
	{"CL", "future", 0.01, 10.00, 1000},
	{"GC", "future", 0.10, 10.00, 100},
}

func SeedInstrumentSpecs(ctx context.Context, q *Queries) error {
	for _, s := range futuresSeed {
		err := q.UpsertInstrumentSpec(ctx, UpsertInstrumentSpecParams{
			ID: uuid.NewString(), SymbolRoot: s.root, InstrumentType: s.itype,
			TickSize: s.tickSize, TickValue: s.tickVal, Multiplier: s.mult, Currency: "USD",
		})
		if err != nil {
			return err
		}
	}
	return nil
}
```

- [ ] **Step 4: Implement the CLI**

`api/cmd/cli/main.go`:
```go
package main

import (
	"context"
	"fmt"
	"log"

	"github.com/google/uuid"
	"github.com/spf13/cobra"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/config"
	"github.com/tradermemos/api/internal/db"
	"github.com/tradermemos/api/internal/store"
	"github.com/tradermemos/api/internal/trades"
)

func openStore() (*store.Queries, error) {
	cfg, _ := config.Load()
	conn, err := db.Open(cfg.DBPath)
	if err != nil {
		return nil, err
	}
	if err := db.Migrate(conn); err != nil {
		return nil, err
	}
	return store.New(conn), nil
}

func main() {
	root := &cobra.Command{Use: "tradermemos"}

	root.AddCommand(&cobra.Command{
		Use: "migrate", Short: "run migrations + seed",
		RunE: func(*cobra.Command, []string) error {
			q, err := openStore()
			if err != nil {
				return err
			}
			return store.SeedInstrumentSpecs(context.Background(), q)
		},
	})

	var email, password string
	cu := &cobra.Command{
		Use: "create-user", Short: "create a user",
		RunE: func(*cobra.Command, []string) error {
			q, err := openStore()
			if err != nil {
				return err
			}
			cfg, _ := config.Load()
			svc := auth.NewService(q, auth.NewJWT(cfg.JWTSecret))
			u, err := svc.Register(context.Background(), email, password)
			if err != nil {
				return err
			}
			fmt.Println("created", u.ID)
			return nil
		},
	}
	cu.Flags().StringVar(&email, "email", "", "email")
	cu.Flags().StringVar(&password, "password", "", "password")
	root.AddCommand(cu)

	var acct string
	rg := &cobra.Command{
		Use: "regroup", Short: "regroup an account's trades",
		RunE: func(*cobra.Command, []string) error {
			q, err := openStore()
			if err != nil {
				return err
			}
			acc, err := q.GetAccountByIDAny(context.Background(), acct) // add this query: SELECT * FROM accounts WHERE id = ?
			if err != nil {
				return err
			}
			return trades.NewService(q).Regroup(context.Background(), acc.UserID, acc.ID)
		},
	}
	rg.Flags().StringVar(&acct, "account", "", "account id")
	root.AddCommand(rg)

	_ = uuid.NewString
	if err := root.Execute(); err != nil {
		log.Fatal(err)
	}
}
```
Add the `GetAccountByIDAny` query to `accounts.sql` (`-- name: GetAccountByIDAny :one\nSELECT * FROM accounts WHERE id = ?;`) and re-run `sqlc generate`. The `import` subcommand wraps the same parse→insert→regroup flow as the HTTP commit; implement it by reading a file path flag and reusing `importer.NewGeneric` with a default mapping (or a `--mapping` JSON flag).

- [ ] **Step 5: Run tests + build + commit**

Run: `cd api && sqlc generate && go build ./... && go test ./...`
Expected: PASS.
```bash
git add api
git commit -m "feat: cobra CLI (migrate/create-user/regroup) + futures instrument seed"
```

---

## Milestone 7 — Thin Web Client

### Task 18: Vite React client (login → import → trades + summary)

**Files:**
- Create: `web/package.json`, `web/index.html`, `web/vite.config.ts`, `web/src/main.tsx`, `web/src/api.ts`, `web/src/App.tsx`

The thin client only proves the API. It has: a login form, an account picker, a CSV upload (preview → commit), a trades table, and a summary KPI strip. No design polish — that's Phase 2.

- [ ] **Step 1: Scaffold**

Run:
```bash
cd /Users/niskan516/Sync/Workspace/dev/TraderMemos/web
npm create vite@latest . -- --template react-ts
npm install
npm install @tanstack/react-query
```

- [ ] **Step 2: Implement a typed API client**

`web/src/api.ts`:
```ts
const BASE = import.meta.env.VITE_API ?? "http://localhost:8080/api/v1";
let token = localStorage.getItem("tm_token") ?? "";

export function setToken(t: string) { token = t; localStorage.setItem("tm_token", t); }

async function req(path: string, opts: RequestInit = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.headers ?? {}) },
  });
  if (!res.ok) throw new Error((await res.json()).error?.message ?? res.statusText);
  return res.json();
}

export const api = {
  login: (email: string, password: string) => req("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  accounts: () => req("/accounts"),
  trades: (accountId: string) => req(`/trades?account_id=${accountId}`),
  summary: (accountId: string) => req(`/analytics/summary?account_id=${accountId}`),
};
```

- [ ] **Step 3: Implement App (login + trades + summary)**

`web/src/App.tsx`:
```tsx
import { useState } from "react";
import { api, setToken } from "./api";

export default function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [trades, setTrades] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [err, setErr] = useState("");

  async function login() {
    try {
      const t = await api.login(email, password);
      setToken(t.access_token);
      setAuthed(true);
      const accs = await api.accounts();
      if (accs[0]) { setAccountId(accs[0].id); load(accs[0].id); }
    } catch (e: any) { setErr(e.message); }
  }
  async function load(id: string) {
    setTrades(await api.trades(id));
    setSummary(await api.summary(id));
  }

  if (!authed) return (
    <div style={{ padding: 40 }}>
      <h1>TraderMemos</h1>
      <input placeholder="email" value={email} onChange={e => setEmail(e.target.value)} />
      <input placeholder="password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
      <button onClick={login}>Login</button>
      {err && <p style={{ color: "red" }}>{err}</p>}
    </div>
  );

  return (
    <div style={{ padding: 40 }}>
      <h2>Summary</h2>
      {summary && <pre>{JSON.stringify(summary, null, 2)}</pre>}
      <h2>Trades</h2>
      <table border={1} cellPadding={6}>
        <thead><tr><th>Symbol</th><th>Dir</th><th>Net P&L</th><th>Closed</th></tr></thead>
        <tbody>
          {trades.map(t => (
            <tr key={t.id}><td>{t.symbol}</td><td>{t.direction}</td><td>{t.net_pnl}</td><td>{t.closed_at}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Verify it builds + runs against the API**

Run:
```bash
cd web && npm run build
```
Expected: build succeeds. Manual check: start the API (`cd api && go run ./cmd/server`), create a user via CLI, `npm run dev`, log in, see trades.

- [ ] **Step 5: Commit**

```bash
git add web
git commit -m "feat: thin web client (login, trades table, summary)"
```

---

## Milestone 8 — Packaging

### Task 19: Dockerfiles + compose

**Files:**
- Create: `api/Dockerfile`, `web/Dockerfile`, `docker-compose.yml`, `api/.dockerignore`, `web/.dockerignore`

- [ ] **Step 1: API Dockerfile (multi-stage, serves web)**

`api/Dockerfile`:
```dockerfile
FROM golang:1.26 AS build
WORKDIR /src
COPY api/go.mod api/go.sum ./
RUN go mod download
COPY api/ ./
RUN CGO_ENABLED=0 go build -o /out/server ./cmd/server && \
    CGO_ENABLED=0 go build -o /out/tradermemos ./cmd/cli

FROM gcr.io/distroless/static-debian12
COPY --from=build /out/server /server
COPY --from=build /out/tradermemos /tradermemos
EXPOSE 8080
VOLUME ["/data"]
ENV TM_DB_PATH=/data/tradermemos.db
ENTRYPOINT ["/server"]
```

- [ ] **Step 2: Web Dockerfile (static build)**

`web/Dockerfile`:
```dockerfile
FROM node:22 AS build
WORKDIR /web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM nginx:alpine
COPY --from=build /web/dist /usr/share/nginx/html
```

- [ ] **Step 3: docker-compose**

`docker-compose.yml`:
```yaml
services:
  api:
    build: { context: ., dockerfile: api/Dockerfile }
    ports: ["8080:8080"]
    environment:
      TM_JWT_SECRET: ${TM_JWT_SECRET:-change-me}
      TM_DB_PATH: /data/tradermemos.db
    volumes: ["tm_data:/data"]
  web:
    build: { context: ., dockerfile: web/Dockerfile }
    ports: ["3000:80"]
    depends_on: ["api"]
volumes:
  tm_data:
```

- [ ] **Step 4: dockerignore files**

`api/.dockerignore` and `web/.dockerignore`:
```
node_modules
dist
*.db
*.db-*
```

- [ ] **Step 5: Build the images**

Run:
```bash
cd /Users/niskan516/Sync/Workspace/dev/TraderMemos
docker compose build
```
Expected: both images build successfully.

- [ ] **Step 6: Smoke test the stack**

Run:
```bash
docker compose up -d
curl -s localhost:8080/healthz
```
Expected: `{"status":"ok"}`. Then `docker compose down`.

- [ ] **Step 7: Commit**

```bash
git add api/Dockerfile web/Dockerfile docker-compose.yml api/.dockerignore web/.dockerignore
git commit -m "feat: dockerize api + web with compose"
```

---

## Milestone 9 — Verification

### Task 20: Full end-to-end verification

- [ ] **Step 1: Run the entire Go test suite**

Run: `cd api && go test ./... -count=1`
Expected: ALL PASS.

- [ ] **Step 2: Manual end-to-end via CLI + curl**

```bash
cd api
go run ./cmd/cli migrate
go run ./cmd/cli create-user --email me@ex.com --password hunter2
go run ./cmd/server &   # start server
TOKEN=$(curl -s localhost:8080/api/v1/auth/login -d '{"email":"me@ex.com","password":"hunter2"}' -H 'Content-Type: application/json' | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
ACC=$(curl -s localhost:8080/api/v1/accounts -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"name":"Main","base_currency":"USD","starting_balance":10000}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
# upload + commit testdata/generic_sample.csv, then:
curl -s "localhost:8080/api/v1/analytics/summary?account_id=$ACC" -H "Authorization: Bearer $TOKEN"
```
Expected: summary JSON with `net_pnl` reflecting the imported trade(s).

- [ ] **Step 3: Confirm the spec's acceptance criteria**

Verify each is demonstrable: multi-user isolation (Task 16 tests), executions→trades grouping (Task 8/9), manual + CSV entry (Tasks 16.3/16.8), cash ledger + balance equity curve (Tasks 16.4/16.7), core KPIs (Task 10), Docker self-host (Task 19). Note any gaps as follow-up issues.

- [ ] **Step 4: Final commit / tag**

```bash
git add -A
git commit -m "chore: phase 1 backend foundation complete" || true
git tag phase-1-foundation
```

---

## Notes for the Implementer

- **sqlc nullable mapping:** after `sqlc generate`, `InsertTradeParams` will use `sql.NullFloat64`/`sql.NullTime` for nullable columns. The `toInsertParams` mapper (Task 9) must convert `*float64`/`*time.Time` from the engine into those. Write a tiny helper `nf(*float64) sql.NullFloat64` / `nt(*time.Time) sql.NullTime`.
- **Time storage:** SQLite stores timestamps as text; with the `go_type: time.Time` override sqlc handles scanning. If you hit scan errors, add `?_loc=UTC` to the DSN and ensure inserts pass `time.Time` (not strings).
- **Single-writer SQLite:** `SetMaxOpenConns(1)` plus WAL avoids "database is locked". Keep it.
- **Follow milmil** for any idiom not spelled out here (graceful shutdown, zerolog setup, request logging middleware) — mirror its `api/internal/api` and `cmd/server` wiring.
```
