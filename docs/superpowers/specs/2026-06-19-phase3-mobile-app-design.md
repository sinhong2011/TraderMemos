# TraderMemos — Phase 3: Mobile App (iOS, Expo) Design

**Date:** 2026-06-19
**Status:** Approved for planning
**Scope:** Phase 3 of TraderMemos — a native iOS companion app (Expo / React Native) on the existing Go API. Capture + review on the go; deep analysis stays on the web.

---

## 1. Context & Goals

Phases 1, 2A, and 2B shipped the backend and the web app. Phase 3 is the **mobile companion**: a native iOS app for the moments a phone is better than a laptop — glancing at today's P&L, reviewing a trade, journaling, and **snapping a chart screenshot** right after a trade. It runs on the **existing API** (`/api/v1`); no backend changes.

### Locked decisions
- **Scope:** **Companion** (not full parity). Dashboard, calendar, trades list + detail (view/journal), quick-add trade, screenshot capture. Reports, playbook, and import stay on the web.
- **Platforms:** **iOS first, Android-ready** — ship iOS via EAS/TestFlight; keep code cross-platform so Android is a later flip.
- **Offline:** **Online-only** for v1 (TanStack Query caches per session). Offline persistence deferred.
- **Aesthetic:** the **apogee house style** — deep near-black (`#070707` bg, `#0c0c0c` surface), subtle white-alpha borders, **lavender accent `#b9a0ff`**, white-alpha text tiers (93/60/40/20%), **Figtree** (sans) + **JetBrains Mono** (numbers) + **Noto Sans TC** (CJK). This is intentionally distinct from the web's blue "Pro Terminal" look.

### Design references
- **apogee** (`/Users/niskan516/Sync/Workspace/dev/apogee`) — the house design system (tokens, CVA-variant components, TanStack/Zustand/Zod/Biome stack). It is **Next.js (web/DOM)**, so it is a *style + pattern* reference, not portable code.
- **Reacticx** (`reacticx.com`) — free, open-source RN component library on **Expo + Reanimated + Gesture Handler + Skia**; **headless, copy-into-codebase** (~50 components land in the repo, fully editable). Scaffolds via `reacticx create`.
- **Expo UI** (`@expo/ui`) — native platform components (SwiftUI / Jetpack Compose).
- **TraderMemos web** (`web/`) — the API client shapes, query-hook pattern, formatters, and calendar math to mirror.

---

## 2. Architecture & Stack

A new `mobile/` Expo app.

- **Expo (React Native) + TypeScript**, managed workflow, scaffolded via **`reacticx create`**.
- **Navigation:** **Expo Router** (file-based), native **bottom tabs** + a detail/modal stack.
- **Components / styling (no NativeWind):**
  - **Expo UI (`@expo/ui`) first** for native platform controls (pickers, switches, lists, context menus, segmented controls) — themed dark + lavender tint.
  - **Reacticx** for richer custom/animated UI (cards, buttons, tiles, micro-interactions), copied into `mobile/components/` and **restyled to apogee tokens**.
  - A **typed theme module** (`mobile/theme/`) holding apogee tokens; copied Reacticx components and custom views reference it. Styling via `StyleSheet` + small typed variant helpers.
- **Charts via Skia** (Reacticx's foundation): the equity sparkline and calendar heatmap are drawn with `@shopify/react-native-skia`; the month calendar is themed Views/Skia.
- **Fonts** via `expo-font`: Figtree, JetBrains Mono, Noto Sans TC.
- **Server state:** TanStack Query (hook-per-resource, mirroring web). **Client state:** Zustand (auth, selected account, calendar month). **Validation:** Zod on responses.
- **Auth:** JWT access + refresh in **`expo-secure-store`**.
- **Media:** `expo-image-picker` + `expo-camera`; `expo-haptics` for action feedback.
- **Tooling:** Biome + `jest-expo` + Testing Library.
- **Distribution:** EAS Build → TestFlight; `app.config.ts` with bundle id, icon, splash.

### File structure
```
mobile/
├── app.config.ts, eas.json, package.json, biome.json, tsconfig.json
├── app/                         # Expo Router routes
│   ├── _layout.tsx              # root: providers + auth gate
│   ├── login.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx          # native bottom tabs
│   │   ├── index.tsx            # Dashboard
│   │   ├── calendar.tsx
│   │   ├── trades.tsx
│   │   └── settings.tsx
│   ├── trade/[id].tsx           # trade detail (stack)
│   └── add.tsx                  # quick-add (modal)
├── components/                  # Reacticx (copied) + custom (StatTile, EquitySparkline, CalendarGrid, TradeCard, JournalForm, ScreenshotGallery)
├── theme/                       # apogee tokens + typed helpers + cn()
├── lib/
│   ├── api/                     # client.ts (token + envelope), types.ts, resource modules
│   ├── hooks/                   # TanStack Query hooks
│   ├── auth.ts                  # zustand auth store + secure-store
│   ├── format.ts                # money/percent/date (Intl + locale)
│   └── calendar.ts              # month-grid math (port of web)
├── i18n/                        # catalogs + provider
└── __tests__/ or *.test.ts
```

---

## 3. Navigation & IA

- **Auth gate:** root `_layout.tsx` reads the Zustand auth store (seeded from secure-store). Unauthenticated → `login`; authenticated → tabs.
- **Bottom tabs:** Dashboard · Calendar · Trades · Settings.
- **Quick-add "+":** a nav-bar action on Dashboard/Trades opening `add.tsx` as a modal.
- **Stack/modal screens:** `trade/[id]` (detail), `add` (quick-add).
- Account context + month nav live in-screen (account switcher on Dashboard/Settings; month nav on Calendar). No global desktop-style filter bar.

---

## 4. Screens

| Screen | Contents | Data (API) |
|---|---|---|
| **Login** (`login.tsx`) | Email/password + register toggle; configurable server URL; stores JWT in secure-store | `POST /auth/login`, `/auth/register` |
| **Dashboard** (`(tabs)/index.tsx`) | KPI tiles (net P&L, win rate, profit factor, expectancy), **Skia equity sparkline**, this-month mini calendar, recent trades; pull-to-refresh | `/analytics/summary`, `/equity-curve`, `/daily`, `/trades` |
| **Calendar** (`(tabs)/calendar.tsx`) | Full-month **P&L heatmap**, month nav, tap day → that day's trades | `/analytics/daily`, `/trades?from&to` |
| **Trades** (`(tabs)/trades.tsx`) | Trade cards (symbol, dir, net P&L, R, date); tap → detail; pull-to-refresh | `/trades` |
| **Trade detail** (`trade/[id].tsx`) | Header stats; fills list; **journal** (notes, setup picker, tags/mistakes, initial-risk) via PATCH; **screenshots** (view + add from camera/library) | `/trades/:id`, `PATCH /trades/:id`, attachments |
| **Quick-add** (`add.tsx`) | Symbol, side, qty, entry/exit price, dates → creates executions; optional snap-a-chart on save | `POST /executions` (×2), attachments |
| **Settings** (`(tabs)/settings.tsx`) | Account switcher, server URL, language, sign out | `/accounts` |

All screens reuse the API contract from Phase 1/2A. Trade-detail journaling and attachments use the enriched detail + attachment endpoints from Phase 2A.

---

## 5. Data Flow, Auth & Error Handling

- **API client** (`lib/api/client.ts`): mirrors the web client — base URL (config + Settings override, in secure-store), attaches `Authorization: Bearer`, parses the `{error:{code,message}}` envelope into a typed `ApiError`. Reads the token from secure-store (hydrated into the auth store at launch).
- **Auth flow:** login → store access + refresh tokens → set auth store `authed=true`. On a 401, attempt `POST /auth/refresh`; on failure, sign out (clear secure-store, `authed=false`) → Login.
- **Query hooks** (`lib/hooks/`): one per resource, mirroring web (`useSummary`, `useEquityCurve`, `useDailyPnl`, `useTrades`, `useTradeDetail`, `usePatchTrade`, `useAccounts`, attachments upload/delete, `useCreateExecution`). Zod-validate payloads.
- **Errors:** per-query loading/empty/error states; mutation failures show a toast (Reacticx). Online-only: no connectivity surfaces as query errors with a retry.

---

## 6. Theme (apogee tokens)

`mobile/theme/tokens.ts` (typed):
- **Surfaces:** `bg #070707`, `surface #0c0c0c`, `surfaceHover #141414`, `border rgba(255,255,255,0.10)`, `borderSubtle rgba(255,255,255,0.05)`.
- **Accent:** `accent #b9a0ff` (lavender), `accentFg #070707`.
- **Text:** `primary rgba(255,255,255,0.93)`, `secondary 0.60`, `tertiary 0.40`, `muted 0.20`.
- **Semantic P&L:** `pos #34d399`, `neg #ef4444`, `flat` = text tertiary.
- **Radius:** 10px (apogee `--radius: 0.625rem`). **Fonts:** Figtree / JetBrains Mono / Noto Sans TC.

Copied Reacticx components are edited to reference these tokens; Expo UI components get a dark color scheme + lavender tint. P&L always shows sign + value (color is not the only signal).

---

## 7. Testing

- **Logic (jest-expo + Testing Library):** api client (token + envelope), `format.ts`, `calendar.ts` month grid (port the web tests), auth store (secure-store mocked), and key screen components (Dashboard tiles, TradeCard, CalendarGrid, JournalForm) rendered with mocked query data.
- **Lint:** Biome clean.
- **Manual / device:** on-device QA for native components, camera/photo flows, and the login→dashboard→detail→journal→screenshot path. A Maestro smoke flow is an optional later add (RN device e2e is heavy; not a v1 gate).

---

## 8. Internal Build Sequence (for the plan)

1. Scaffold (`reacticx create`) + Expo Router + theme module (apogee tokens) + fonts + Biome/jest-expo.
2. API client + types + Zod + auth store (secure-store) + TanStack Query provider.
3. Login screen + auth gate + configurable server URL.
4. Shared components (StatTile, TradeCard, CalendarGrid, EquitySparkline via Skia) + formatters + calendar math (tested).
5. Dashboard.
6. Calendar.
7. Trades list + Trade detail (journal via PATCH).
8. Screenshots (camera/library) on trade detail.
9. Quick-add trade.
10. Settings (account switch, server URL, language, sign out).
11. Polish (haptics, safe areas, empty/error states) + `app.config`/EAS config + TestFlight build.

---

## 9. Out of Scope (later phases)

Reports / playbook / import on mobile; offline persistence + write queue; Android store release; push notifications; broker API sync, options greeks, public sharing (Phase 4). Mobile is a **read + capture + journal** companion; deep analysis remains on the web.
