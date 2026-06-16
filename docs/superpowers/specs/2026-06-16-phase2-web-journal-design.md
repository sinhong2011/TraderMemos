# TraderMemos — Phase 2: Web Journal Experience Design

**Date:** 2026-06-16
**Status:** Approved for planning
**Scope:** Phase 2 of the self-hosted trading journal — the full web application (dashboard, P&L calendar, trade log + detail, playbook/setups, reports), plus the backend additions those screens require. Builds on the Phase 1 backend (`docs/superpowers/specs/2026-06-15-phase1-backend-foundation-design.md`).

---

## 1. Context & Goals

Phase 1 shipped the backend foundation (executions→trades grouping, analytics, importer, cash ledger, multi-user auth) and a deliberately thin web client. Phase 2 replaces that thin client with the **real journaling experience** — the features that make TradeZella/TraderSync/TickerScribe valuable — and adds the backend pieces those features need.

The whole Phase 2 feature set is in this single spec but is **sequenced internally** so each slice lands working (backend additions → app shell → dashboard → calendar → trades/detail → playbook/reports → settings/import → polish).

### Locked decisions
- **Aesthetic:** Direction **A — Pro Terminal (dark)**: dense, data-first, tabular numerics, green/red semantic P&L, calm dark surface.
- **Stack:** Vite + React 19 + TypeScript; **shadcn components on Base UI primitives** (not Radix; matches milmil); **Tailwind v4** (dark-first); **TanStack Router / Query / Table / Virtual**; a charting lib (Recharts or visx) for equity/breakdown charts; `motion` for restrained transitions.
- **i18n:** **Lingui** (same as milmil). English default; all UI strings via Lingui macros; locale-aware number/currency/date via `Intl`; language selector in Settings; new locales drop-in.
- **Design method:** the UI is built with the **`design-taste-frontend` (tasteskill v2)** skill, invoked at implementation time, targeting the brief in §6. The skill emits its Step-1 design declaration + dial values for user approval before writing components.

---

## 2. Backend Additions

### 2.1 Stable trade identity + metadata preservation across regroup (critical refactor)

**Problem:** Phase 1 `Regroup` does `DeleteTradesForAccount` + re-insert, assigning new trade IDs each run. Once users journal, a re-import would **wipe notes/tags/screenshots**. Fix:

- **Deterministic trade id:** a trade's `id` is its **opening execution's id** (the first fill that opened the position). Stable across regroups for the same fills; unique per round-trip.
- **Authored vs computed split:** user-authored fields move into a new **`trade_journal`** table; the `trades` row holds only computed fields.
- **Regroup upserts:** compute trades with deterministic ids; `INSERT … ON CONFLICT(id) DO UPDATE` the computed columns; then delete only trades for the account whose id is **not** in the recomputed set. Because upsert keeps the row (same id), `trade_journal` / `trade_tags` / `trade_attachments` (all keyed by `trade_id`) **survive**. Genuinely-removed trades cascade-delete their metadata, which is correct.

New/changed store queries: `UpsertTrade`, `DeleteTradesNotIn(account_id, user_id, ids…)` (or delete-stale equivalent), replacing `DeleteTradesForAccount` in the regroup path.

### 2.2 New tables (migrations 000012–000015, in `api/internal/db/migrations/`)

**`setups`** (playbook) — `id, user_id, name, description, created_at`; `UNIQUE(user_id, name)`.

**`trade_journal`** — `trade_id TEXT PRIMARY KEY REFERENCES trades(id) ON DELETE CASCADE, user_id, notes TEXT NOT NULL DEFAULT '', setup_id TEXT REFERENCES setups(id) ON DELETE SET NULL, initial_risk REAL, updated_at`. This is the source of truth for authored fields; the Phase-1 `trades.notes` column is migrated into it on first write and otherwise unused going forward.

**`tags`** gains `kind TEXT NOT NULL DEFAULT 'custom'` (`custom | mistake`). Mistakes are tags with `kind='mistake'`, surfaced as their own dimension in the UI and reports.

**`trade_attachments`** — `id, user_id, trade_id REFERENCES trades(id) ON DELETE CASCADE, filename, content_type, size_bytes, storage_key, created_at`.

### 2.3 Attachment storage

A small **pluggable storage interface** (`internal/storage`): `Put(key, reader) `, `Get(key)`, `Delete(key)`. Phase 2 ships a **local-disk** implementation writing under `${dataDir}/attachments/<user_id>/<attachment_id>` (S3 later). Config adds an attachments directory (defaults next to the SQLite file). Uploads validated: images only (`image/png|jpeg|webp`), size cap from config (default 10 MB).

### 2.4 R-multiple

`trade_journal.initial_risk` (user-entered planned risk in account currency). `r_multiple = net_pnl / initial_risk` computed on read when both present; null otherwise. Surfaced in trade detail, log, playbook, reports.

### 2.5 New / extended endpoints (all user-scoped, uniform error envelope)

| Group | Endpoints |
|---|---|
| **Setups** | `GET/POST /setups`, `PATCH/DELETE /setups/:id` |
| **Trade journal** | `PATCH /trades/:id` extended to write `notes, setup_id, initial_risk, tag_ids` (→ `trade_journal` + `trade_tags`, with ownership checks on `setup_id`/`tag_ids`) |
| **Attachments** | `POST /trades/:id/attachments` (multipart), `GET /trades/:id/attachments`, `GET /attachments/:id/file`, `DELETE /attachments/:id` |
| **Breakdown** | `GET /analytics/breakdown?by=symbol\|setup\|day_of_week\|hour_of_day\|tag` → per-group KPIs (net P&L, trades, win rate, profit factor, avg R) |
| **Tags** | `POST/PATCH /tags` gain `kind` |
| **Trade detail** | `GET /trades/:id` enriched: trade + **executions (fills)** + journal (notes/setup/initial_risk/r_multiple) + tags + mistakes + attachments |

Breakdown + per-setup stats implemented as grouping passes in `internal/analytics` over closed trades (dimension extracted per trade: symbol, setup_id, `closed_at` weekday, `closed_at` hour, or tag).

### 2.6 Carried-forward Phase-1 review follow-ups (fix during this phase)
Delete handlers should return 404 (not 204) for missing/foreign ids (`:execrows`); validate malformed `from`/`to` filter params; cap CSV upload size; drop the dead `ListClosedTrades` date nargs (date filtering stays in Go or is pushed properly to SQL).

---

## 3. Frontend Architecture & IA

Replaces the thin `web/` client. The Go binary continues to serve built web assets in production.

- **Stack** as in §1. **Typed API client** layer over the Phase-1+2 endpoints (hand-written typed functions + TanStack Query hooks; one module per resource).
- **App shell:** persistent left sidebar nav; top bar with **account switcher** + **global date-range filter** (feeds every screen via the shared filter contract from Phase 1). Auth-gated; login/register are standalone styled routes.
- **Routes:** Dashboard, Calendar, Trades, Trade detail, Playbook, Reports, Import, Settings (+ auth).
- **Per-route layout discipline** (from the brief): each route uses a distinct layout family — dashboard ≠ table ≠ calendar ≠ detail ≠ report.
- **State:** server state via TanStack Query (caching, optimistic journal edits); minimal client state (filters, theme) via a small store or context.
- **i18n:** Lingui catalogs; `Trans`/`t` macros throughout; `Intl` for money/percent/date by locale.

---

## 4. The Screens

| Route | Contents | Data | Layout family |
|---|---|---|---|
| **Dashboard** | KPI cards (net P&L, win rate, profit factor, expectancy, avg R), equity curve, mini P&L calendar, recent trades, best/worst | `/analytics/summary`, `/equity-curve`, `/daily`, `/trades` | Overview grid |
| **Calendar** | Full-month P&L heatmap; day cell = net P&L + trade count, colored by magnitude; weekly totals; month nav; click day → that day's trades | `/analytics/daily`, `/trades?from&to` | Calendar grid |
| **Trades** | Virtualized, filterable, sortable log (symbol, dir, instrument, open/close, qty, net P&L, R, setup, tags); filters: account/date/symbol/instrument/status/setup/tag | `/trades` (+filters) | Dense data table |
| **Trade detail** | Header (symbol/dir/P&L/R/dates); fills table; journal panel (notes, setup picker, tags, mistakes, initial-risk); screenshots gallery (upload/view/delete) | `/trades/:id`, `PATCH /trades/:id`, attachments, `/setups`, `/tags` | Detail / record |
| **Playbook** | Setup list with aggregate stats (trades, win rate, net P&L, profit factor, avg R); create/edit/delete; drill into a setup's trades | `/setups`, `/analytics/breakdown?by=setup` | Stat cards / list |
| **Reports** | Breakdown explorer: dimension picker (symbol/day-of-week/hour-of-day/setup/tag) → chart + per-group KPI table | `/analytics/breakdown?by=…` | Report (chart + table) |
| **Import** | Wizard: upload CSV → preview + confirm mapping → commit → result | `/imports/*` | Wizard / stepper |
| **Settings** | Accounts CRUD, cash transactions, tags & setups management, language selector | `/accounts`, `/cash-transactions`, `/tags`, `/setups` | Settings / forms |

---

## 5. Error Handling & Non-Functionals

- **Errors:** reuse the uniform `{error:{code,message,details}}` envelope. Frontend: route-level error boundaries + toast notifications (`sonner`); TanStack Query ret/error states; optimistic journal edits with rollback on failure.
- **Uploads:** image-type + size validation server-side; client shows progress + rejects oversize before upload.
- **Accessibility:** Base UI primitives give keyboard/ARIA behavior; color is never the only signal (P&L shows sign + value, not just hue).
- **Responsive:** desktop-primary, tablet supported; phones are Phase 3 (native app), so mobile web is best-effort, not a goal.
- **Performance:** virtualized trade table; query caching; charts lazy-loaded.

---

## 6. Taste-Skill Brief (verbatim — what `design-taste-frontend` builds to)

```
Loaded: tasteskill v2 (design-taste-frontend) as the source of frontend design rules.

BRIEF — adapted from the "new site" template for an APPLICATION, not a landing page:
- Surface kind   : Multi-route data dashboard (trading journal). Not a marketing page.
- Product        : TraderMemos — self-hosted trading journal (TradeZella/TraderSync-class):
                   executions->trades, P&L analytics, calendar heatmap, playbook, reports.
- Audience       : active retail & prop traders; numerate, detail-obsessed, review trades
                   daily; value signal density + precision over hand-holding.
- Vibe words     : pro-terminal, dense, precise, calm-dark.
- Design system  : shadcn + Base UI primitives on Tailwind v4, dark-first; tabular numerics;
                   green/red semantic P&L; 8px spacing grid.
- References      : TradeZella pro dark mode, Linear (craft/restraint), Bloomberg-lite density.
- Avoid          : generic SaaS gradients, glassmorphism, decorative status dots / version
                   chips / scroll cues, em/en-dashes, cards-nested-in-cards, rainbow chart
                   palettes, hero/marketing patterns.

METHODOLOGY ADAPTATION (vs the skill's landing-page defaults):
- Replace "8 marketing sections + hero discipline" with PER-ROUTE LAYOUT DISCIPLINE:
  each route (Dashboard, Calendar, Trades, Trade-detail, Playbook, Reports) uses a distinct
  layout family - dashboard != table != calendar != detail; no two screens feel same-y.
- Keep: one theme throughout (dark), brief inference, anti-slop + pre-flight + no-em-dash
  audits, real/seeded data (never lorem).
- Density: comfortable-dense (Linear-like); tabular-nums for all money/percent.
- The skill runs its Step-1 "design declaration + 3 dial values" at build time; we approve
  that before it writes components.
```

---

## 7. Testing

- **Backend (Go, TDD):**
  - **Metadata preservation** — the critical test: import → journal a trade (notes/tags/setup/initial_risk/attachment) → re-import the same file → assert the journal/tags/attachment survive (same deterministic trade id).
  - Breakdown analytics: fixed dataset → asserted per-group KPIs for each `by` dimension.
  - Setups CRUD + ownership; attachments storage round-trip + image/size validation; R-multiple computation; extended trade-detail payload; user-isolation on all new write paths.
- **Frontend:** Vitest + Testing Library component tests for key components (KPI cards, calendar cell, trade table, journal panel, breakdown chart); Lingui catalog extraction passes; a Playwright e2e smoke: login → dashboard → calendar → open trade → add note + screenshot → reports.
- **Design audits:** `design-taste-frontend` pre-flight + no-em-dash + per-route layout-repetition audits must pass.

---

## 8. Internal Build Sequence (for the plan)

1. Backend: stable-id + `trade_journal` refactor (migrations, store upsert/prune, Regroup change, preservation test).
2. Backend: setups, attachments + storage, `tags.kind`, breakdown analytics, enriched trade detail, R-multiple; Phase-1 review follow-ups (§2.6).
3. Frontend foundation: stack setup (shadcn + Base UI + Tailwind v4 + Router + Query + Lingui), app shell, auth screens, typed API client, taste design-declaration approval.
4. Dashboard.
5. Calendar.
6. Trades log + Trade detail (journal, screenshots).
7. Playbook + Reports.
8. Settings + Import wizard.
9. Polish, design audits, Docker/web build update.

---

## 9. Out of Scope (Phase 4)

Broker API sync; options greeks & multi-leg modeling; live mark-to-market / open-trade P&L; MAE/MFE & historical prices; public share pages; prop-firm account rules/payouts; the native iOS app (Phase 3). Mobile *web* is best-effort only.
