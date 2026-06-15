# TraderMemos — Phase 1: Backend Foundation Design

**Date:** 2026-06-15
**Status:** Approved for planning
**Scope:** Phase 1 of a self-hosted, multi-platform trading journal (TradeZella/TraderSync-class). This document covers the backend core, data model, core analytics, manual + CSV trade entry, and a thin web client to prove the API end-to-end.

---

## 1. Context & Goals

TraderMemos is a **self-hosted trading journal** with a web app and (later) an Expo React Native iOS app, backed by a single Go server. It mirrors the proven architecture of the `milmil` project (Go/Echo/sqlc/SQLite, Vite/React web, Dockerized).

The product is built in phases. This spec is **Phase 1: the foundation** — get the backend, data model, and core analytics right so that web (Phase 2), mobile (Phase 3), and hard integrations/social (Phase 4) drop cleanly onto a stable API contract.

### Phased roadmap (for context; only Phase 1 is specified here)
- **Phase 1 — Foundation:** backend core + executions→trades data model + manual/CSV entry + core analytics + thin web dashboard. *(this spec)*
- **Phase 2 — Journal experience (web):** P&L calendar heatmap, trade log with filters, per-trade detail (notes, screenshots, tags, mistakes), playbook/setups with per-setup performance, breakdown reports.
- **Phase 3 — iOS app (Expo React Native):** mobile client on the same API.
- **Phase 4 — Hard integrations & social:** broker API sync (SnapTrade/OAuth), options greeks & multi-leg modeling, futures tick/contract depth, prop-firm account rules/payouts, MAE/MFE via historical prices, public share pages.

### Design references
- **milmil** (`/Users/niskan516/Sync/Workspace/dev/milmil`) — architectural template (Go/Echo/sqlc/SQLite/golang-migrate/JWT+TOTP/koanf/zerolog/cobra; Vite+React 19/TanStack/shadcn/Tailwind v4; Docker).
- **Deltalytix** (`hugodemenez/deltalytix`) — confirms keeping raw `Order`s + computed `Trade`s; first-class `Account`; `TickDetails` for futures P&L; `Tag` as an entity; `TradeAnalytics` (MAE/MFE/R:R) as an advanced/later concern.
- **TradeNote** (`Eleven-Trading/TradeNote`) — confirms server-side import → group → daily aggregation; screenshots/notes per trade; calendar P&L as the centerpiece.

### Product decisions (locked)
- **Instruments:** stocks, options, futures, forex/crypto (data model is instrument-agnostic at the core; instrument specifics via typed columns + a `details` JSON).
- **Data entry:** manual + CSV import in Phase 1; broker API sync deferred to Phase 4. Importers are a pluggable interface.
- **Users:** multi-user from day 1; public sharing deferred to Phase 4.
- **Cost basis:** **average-cost** (FIFO offered as a per-account config in a later phase).
- **Analytics scope:** **closed trades only** in Phase 1 (no live mark-to-market; that needs a price feed).
- **Datastore:** **SQLite** (single file, zero-ops, self-host friendly); Postgres possible later via the same sqlc layer.

---

## 2. Architecture & Repo Layout

The Go binary serves the JSON API and (in production) the built web assets, so one container runs the whole stack.

```
TraderMemos/
├── api/                          # Go backend (Phase 1 focus)
│   ├── cmd/
│   │   ├── server/               # main entrypoint
│   │   └── cli/                  # admin CLI (cobra): migrate, create-user, import, regroup
│   ├── internal/
│   │   ├── api/                  # Echo handlers + router + middleware
│   │   ├── auth/                 # JWT (access+refresh) + bcrypt + optional TOTP (from milmil)
│   │   ├── config/               # koanf config
│   │   ├── db/                   # sqlite open + migrate
│   │   ├── store/                # sqlc-generated queries
│   │   │   └── queries/          # *.sql source
│   │   ├── trades/               # executions→trades grouping engine (core domain)
│   │   ├── importer/             # pluggable CSV importers + column mapping
│   │   └── analytics/            # P&L, win rate, profit factor, expectancy, equity curve
│   ├── migrations/               # golang-migrate *.up/down.sql
│   └── Dockerfile
├── web/                          # Vite + React thin dashboard (verifies the API)
│   └── Dockerfile
├── docker-compose.yml
└── docs/superpowers/specs/       # this spec
```

### Key architectural decisions
- **SQLite** datastore; one file on a mounted volume.
- **Multi-user from day 1**; every row is scoped by `user_id`, enforced by middleware-injected user + `user_id`-parameterized store queries.
- **Server-owned grouping**: the executions→trades logic lives in the backend (`internal/trades`); clients never reimplement it. Clients read computed trades + analytics and write executions.
- **Thin Phase-1 web**: enough to log in, import/enter trades, and view the trade list + summary KPIs. The real dashboard is Phase 2.

---

## 3. Data Model

All tables are user-scoped (`user_id`). Flow: **import/manual → `executions` → grouping engine → `trades` → analytics**.

```
users ──< accounts ──< executions ──< trade_executions >── trades ──< trade_tags >── tags
                          (raw fills)    (junction)       (round-trips)
instrument_specs   (symbol → tick_size, tick_value, multiplier, currency)
import_batches     (provenance + undo for each import/manual entry)
```

### Tables

**`users`** *(from milmil)* — `id, email, password_hash, totp_secret(nullable), created_at, …`.

**`accounts`** — `id, user_id, name, broker, account_type(cash|margin|prop), base_currency, starting_balance, created_at`.
*Prop-firm drawdown/payout fields deferred to Phase 4.*

**`executions`** (atomic unit; the import/manual-entry target) —
`id, user_id, account_id, external_id(nullable; broker order id, for dedup), symbol, instrument_type(stock|option|future|forex|crypto), side(buy|sell), quantity, price, fees, commission, executed_at, multiplier, details(JSON; e.g. strike/expiry/option_type/underlying for options, pair for fx), import_batch_id, created_at`.
Typed columns cover the common path; `details` JSON absorbs instrument-specific extras without schema bloat. Indexed on `(user_id, account_id, symbol, instrument_type, executed_at)`.

**`trades`** (computed round-trips) —
`id, user_id, account_id, symbol, instrument_type, direction(long|short), status(open|closed), opened_at, closed_at(nullable), qty_opened, avg_entry_price, avg_exit_price(nullable), gross_pnl(nullable for open), fees_total, net_pnl(nullable for open), pnl_currency, return_pct(nullable), r_multiple(nullable), time_in_trade_secs(nullable), notes(text), created_at, updated_at`.
Indexed on `(user_id, account_id, closed_at)` and `(user_id, symbol)`.

**`trade_executions`** — junction `(trade_id, execution_id)` so every trade is fully traceable to its fills and recomputable.

**`tags`** — `id, user_id, name, color(default "#CBD5E1"), description`. Unique `(user_id, name)`.

**`trade_tags`** — junction `(trade_id, tag_id)`.

**`instrument_specs`** — `id, symbol_root, instrument_type, tick_size, tick_value, multiplier, currency`. Seeded for common futures (ES, NQ, CL, …); default multiplier 1 (stocks), 100 (options). Used by the grouping engine for correct P&L.

**`import_batches`** — `id, user_id, account_id, source(csv|manual|api), filename(nullable), column_mapping(JSON, nullable), row_count, status(pending|committed|reversed), created_at`. Every import/manual entry is a reviewable, reversible unit.

### Deferred (schema leaves room, not built in Phase 1)
- Trade screenshots/attachments → Phase 2.
- Playbook/setup link on trades (`setup_id`) → added in Phase 2 to avoid a dead column now.
- MAE/MFE + historical price tables → Phase 4.
- Prop-firm account rules/payouts → Phase 4.

---

## 4. Grouping Engine (`internal/trades`)

Transforms raw executions into round-trip trades. This is the riskiest logic in Phase 1 and is built test-first.

**Algorithm** — per `(account_id, symbol, instrument_type)`, executions sorted by `executed_at`:
1. Track a running **signed position**. Position `0 → nonzero` **opens** a trade; back to `0` **closes** it.
2. A fill that **crosses zero** (e.g. long 100, then sell 150) is **split**: it closes the current trade and opens a new opposite trade with the remainder.
3. **Average-cost** basis for `avg_entry_price`, `avg_exit_price`, and realized P&L.
4. **P&L** = `(exit − entry) × qty × directionSign × multiplier − fees`, where `multiplier`/`tick_value` come from `instrument_specs` (futures), `100` (options), `1` (stocks). `return_pct` = net P&L ÷ (avg_entry × qty × multiplier).
5. **Open trades** (nonzero position at end of stream) are stored with `status=open`, realized fields populated, P&L fields null. Phase 1 analytics ignore open trades.
6. `time_in_trade_secs` = `closed_at − opened_at`. `r_multiple` left null in Phase 1 (needs a recorded risk/stop, a Phase 2 input).

**Anomalies** (e.g. a closing fill with no open position, malformed data) are **flagged on the import report**, never panic. Regrouping (`POST /trades/regroup` or `cli regroup`) is idempotent: it rebuilds `trades`/`trade_executions` for an account from its executions.

---

## 5. API Contract

REST/JSON under `/api/v1`, JWT-protected, every route scoped to the authenticated `user_id`. Uniform error envelope: `{error:{code,message,details}}`.

| Group | Endpoints |
|---|---|
| **Auth** (from milmil) | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, TOTP 2FA |
| **Accounts** | `GET/POST /accounts`, `GET/PATCH/DELETE /accounts/:id` |
| **Executions** | `GET /executions` (filters), `POST /executions` (manual fill) |
| **Manual trade** | `POST /trades/manual` — convenience: creates entry/exit executions + triggers grouping |
| **Imports** | `POST /imports` (upload CSV → preview + suggested mapping), `POST /imports/:id/commit` (confirm mapping), `GET /imports`, `DELETE /imports/:id` (undo whole batch) |
| **Trades** | `GET /trades` (filter: account, symbol, instrument, date range, status, tags), `GET /trades/:id`, `PATCH /trades/:id` (notes, tags), `POST /trades/regroup` |
| **Tags** | CRUD `/tags` |
| **Analytics** | `GET /analytics/summary`, `GET /analytics/equity-curve`, `GET /analytics/daily` |

All analytics + trade list endpoints accept a shared **filter set**: `account_id`, `date_from`, `date_to`, `symbol`, `instrument_type`, `tag` — so every client reuses one contract.

---

## 6. Analytics (`internal/analytics`, closed trades only)

Computed server-side (SQL aggregation where practical), filtered by the shared filter set.

- **Headline KPIs:** net P&L, gross P&L, total fees, total trades, win rate, **profit factor** (gross profit ÷ gross loss), **expectancy** (`winRate×avgWin − lossRate×avgLoss`), payoff ratio (avg win ÷ avg loss).
- **Distribution:** avg win, avg loss, avg trade, largest win, largest loss, win/loss/breakeven counts.
- **Equity curve:** cumulative net P&L over time (ordered by `closed_at`) + **max drawdown** derived from the curve.
- **Daily P&L** (`/analytics/daily`): net P&L per calendar day — foundation for the Phase-2 calendar heatmap.

*Breakdowns by symbol/setup/time-of-day → Phase 2.*

---

## 7. CSV Import (`internal/importer`)

Pluggable interface so brokers are added incrementally without touching the core:

```go
type Importer interface {
    Detect(headers []string) bool                       // header-signature match
    Parse(row map[string]string) (Execution, error)
    Name() string
}
```

- **Phase 1 ships** a **generic column-mapping importer**: upload → backend parses headers + sample rows and returns a heuristic suggested mapping → user confirms which column maps to symbol/side/qty/price/datetime/fees/commission → commit. The confirmed `column_mapping` is saved on the `import_batch` and reusable per account. Broker presets (Tradovate, IBKR Flex, etc.) are later `Importer` implementations detected by header signature.
- **Staged & atomic validation:** parse the whole file, return a per-row error report, commit only on confirmation; a batch imports fully or not at all; `DELETE /imports/:id` reverses it (removes its executions and regroups affected accounts).
- **Dedup:** by `external_id` when present, else a hash of `(account, symbol, executed_at, qty, price)`. Re-importing the same file is safe.
- **Parsing concerns:** datetime + timezone normalization to UTC; side/sign conventions (buy/sell vs signed qty); fees vs commission columns.

---

## 8. Auth & Multi-User

Reuse milmil's `auth` package: JWT access + refresh tokens, bcrypt password hashing, optional TOTP 2FA. Middleware validates the token and injects the user; **every store query is parameterized by `user_id`**, and handler tests assert cross-user isolation. Public sharing is Phase 4.

---

## 9. Error Handling

- **Echo central error handler** → uniform `{error:{code,message,details}}` JSON.
- **Grouping anomalies** surfaced on the import report, never panic.
- **Import validation** returns a structured per-row error report; partial commits are not allowed (atomic per batch).
- **zerolog** structured logging throughout (request IDs, user context).

---

## 10. Testing (TDD)

- **Grouping engine** (highest risk): exhaustive table-driven tests — average-cost, zero-cross splits, multi-fill scale-in/out, short trades, futures `tick_value`/multiplier, options ×100, open-trade handling, anomaly flagging.
- **Store**: sqlc query tests against a temp SQLite DB.
- **Importer**: tests against real broker CSV fixtures (good rows, bad rows, dedup, mapping).
- **Analytics**: fixed datasets → asserted KPI outputs (profit factor, expectancy, drawdown).
- **API handlers**: Echo handler tests including `user_id` isolation assertions.
- **Web**: minimal; optional Playwright smoke (login → import → see trades).

---

## 11. CLI, Config, Deploy

- **CLI (cobra):** `migrate`, `create-user`, `import <file>`, `regroup`.
- **Config (koanf):** env-prefixed — DB path, JWT secrets, HTTP port, default base currency, log level.
- **Deploy:** multi-stage `api/Dockerfile` (Go binary serves built web assets), `web/Dockerfile`, `docker-compose.yml` (single app service + SQLite volume; Redis optional). One container runs the whole app for self-hosting.

---

## 12. Out of Scope for Phase 1

Live mark-to-market / open-trade P&L; broker API sync; options greeks & multi-leg spread modeling; screenshots/attachments; playbook/setups; calendar heatmap UI; breakdown reports; prop-firm account rules/payouts; MAE/MFE; public sharing; the iOS app. Each is slotted into Phases 2–4.
