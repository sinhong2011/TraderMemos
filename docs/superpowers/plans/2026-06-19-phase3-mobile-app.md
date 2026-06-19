# TraderMemos Phase 3 — Mobile App (iOS, Expo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a native iOS companion app (Expo / React Native) on the existing TraderMemos API — login, dashboard, P&L calendar, trades list + detail (journal), quick-add trade, and screenshot capture — in the apogee house aesthetic.

**Architecture:** Expo + Expo Router app in `mobile/`. The logic layer (typed API client over `/api/v1`, auth store backed by `expo-secure-store`, formatters, calendar math, TanStack Query hooks) is built test-first with `jest-expo`. The UI uses **Expo UI (`@expo/ui`) native controls first**, **Reacticx** components (copied into the repo, Skia/Reanimated-powered) for custom/animated pieces, and a typed theme module carrying apogee's tokens. Screens are verified on an iOS dev build.

**Tech Stack:** Expo (managed), React Native, TypeScript, Expo Router, `@expo/ui`, Reacticx, `@shopify/react-native-skia`, `react-native-reanimated`, `react-native-gesture-handler`, TanStack Query, Zustand, Zod, `expo-secure-store`, `expo-image-picker`, `expo-camera`, `expo-font` (Figtree / JetBrains Mono / Noto Sans TC), `expo-haptics`, Biome, `jest-expo` + Testing Library. EAS Build → TestFlight.

**Spec:** `docs/superpowers/specs/2026-06-19-phase3-mobile-app-design.md`

**API (already built, on `main`):** base `/api/v1`, JWT bearer. Auth `POST /auth/{login,register,refresh}`; `GET /accounts`; `GET /trades`(filters)/`GET /trades/:id`(enriched)/`PATCH /trades/:id`; `POST /executions`; `GET /analytics/{summary,equity-curve,daily}`; attachments `POST/GET/DELETE /trades/:id/attachments`. The **web client** (`web/src/lib/api/*`, `web/src/lib/format.ts`, `web/src/lib/calendar.ts`) is the reference for client shapes, DTO field names (snake_case), formatters, and calendar math — port them.

**Newer/changing libraries — verify before use:** `@expo/ui`, Reacticx, and `@shopify/react-native-skia` APIs change across versions. Before using each, fetch current docs via the **Context7 MCP** (resolve-library-id then query-docs) rather than guessing. Expo UI and Skia require a **dev build** (not Expo Go).

**Conventions:** run from `/Users/niskan516/Sync/Workspace/dev/TraderMemos/mobile`. Commit trailer on every commit: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. If git identity errors: `git -c user.name='TraderMemos' -c user.email='sinhong2011@gmail.com' commit ...`.

---

## File Structure

```
mobile/
├── app.config.ts, eas.json, package.json, biome.json, tsconfig.json, jest.config / jest setup
├── app/
│   ├── _layout.tsx              # providers (Query, theme, fonts) + auth gate
│   ├── login.tsx
│   ├── (tabs)/_layout.tsx       # native bottom tabs
│   ├── (tabs)/index.tsx         # Dashboard
│   ├── (tabs)/calendar.tsx
│   ├── (tabs)/trades.tsx
│   ├── (tabs)/settings.tsx
│   ├── trade/[id].tsx           # detail
│   └── add.tsx                  # quick-add (modal)
├── components/                  # Reacticx (copied) + custom: StatTile, TradeCard, CalendarGrid, EquitySparkline, JournalForm, ScreenshotGallery
├── theme/tokens.ts, theme/index.ts
├── lib/api/{client,types,auth,accounts,trades,analytics,attachments,executions}.ts
├── lib/hooks/*.ts
├── lib/format.ts, lib/calendar.ts
├── lib/store.ts                 # zustand: auth + selected account + calendar month
└── i18n/
```

---

## Milestone 0 — Scaffold

### Task 1: Create the Expo app + tooling

**Files:** the `mobile/` project.

- [ ] **Step 1: Scaffold**

From `/Users/niskan516/Sync/Workspace/dev/TraderMemos`:
```bash
npx create-expo-app@latest mobile --template default
cd mobile
```
(Note: the spec mentions `reacticx create`; that scaffolds its own app shape. To keep a predictable Expo Router layout, scaffold with `create-expo-app` here and add Reacticx components in Task 12 via its add command/copy. If you prefer `reacticx create`, verify its output matches the `app/` structure above and adapt.)

- [ ] **Step 2: Add core deps**

```bash
cd mobile
npx expo install expo-router react-native-safe-area-context react-native-screens expo-secure-store expo-font expo-haptics expo-image-picker expo-camera react-native-reanimated react-native-gesture-handler @shopify/react-native-skia
npm i @tanstack/react-query zustand zod
npm i -D @biomejs/biome jest-expo jest @testing-library/react-native @types/jest
```
For `@expo/ui`: `npx expo install @expo/ui` (verify the package name/availability against current Expo docs via Context7; it requires a dev build).

- [ ] **Step 3: Configure**

- `package.json` scripts: `"test": "jest"`, `"lint": "biome check ."`, `"start": "expo start"`.
- `jest` config: `{ "preset": "jest-expo" }` (in package.json or jest.config.js); add `jest.setup.ts` if needed.
- `biome.json`: minimal (`{"$schema":"https://biomejs.dev/schemas/1.9.4/schema.json","files":{"ignore":["node_modules",".expo","android","ios"]}}`).
- `app.config.ts`: app name "TraderMemos", slug, ios bundle id `app.tradermemos.mobile`, scheme `tradermemos`, plugins for `expo-router`, `expo-secure-store`, `expo-camera`, `expo-image-picker`, reanimated; enable the new architecture as required by Skia/Expo UI.
- Add the Reanimated Babel plugin to `babel.config.js` (`'react-native-reanimated/plugin'` last).

- [ ] **Step 4: Verify it boots + a trivial test passes**

Create `mobile/lib/__smoke__.test.ts`:
```ts
test("sanity", () => { expect(1 + 1).toBe(2); });
```
Run: `cd mobile && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile
git commit -m "chore: scaffold expo mobile app + tooling"
```

---

### Task 2: Theme module (apogee tokens)

**Files:** Create `mobile/theme/tokens.ts`, `mobile/theme/index.ts`, `mobile/theme/tokens.test.ts`.

- [ ] **Step 1: Write the failing test**

`mobile/theme/tokens.test.ts`:
```ts
import { pnlColor, tokens } from "./tokens";

test("apogee tokens present", () => {
  expect(tokens.bg).toBe("#070707");
  expect(tokens.accent).toBe("#b9a0ff");
});

test("pnlColor maps sign to semantic colors", () => {
  expect(pnlColor(120)).toBe(tokens.pos);
  expect(pnlColor(-5)).toBe(tokens.neg);
  expect(pnlColor(0)).toBe(tokens.textTertiary);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `cd mobile && npm test -- tokens`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

`mobile/theme/tokens.ts`:
```ts
export const tokens = {
  bg: "#070707",
  surface: "#0c0c0c",
  surfaceHover: "#141414",
  border: "rgba(255,255,255,0.10)",
  borderSubtle: "rgba(255,255,255,0.05)",
  accent: "#b9a0ff",
  accentFg: "#070707",
  textPrimary: "rgba(255,255,255,0.93)",
  textSecondary: "rgba(255,255,255,0.60)",
  textTertiary: "rgba(255,255,255,0.40)",
  textMuted: "rgba(255,255,255,0.20)",
  pos: "#34d399",
  neg: "#ef4444",
  radius: 10,
  fontSans: "Figtree",
  fontMono: "JetBrainsMono",
} as const;

export function pnlColor(v: number | null | undefined): string {
  if (v == null || v === 0) return tokens.textTertiary;
  return v > 0 ? tokens.pos : tokens.neg;
}
```
`mobile/theme/index.ts`: `export * from "./tokens";`

- [ ] **Step 4: Run + commit**

Run: `cd mobile && npm test -- tokens` → PASS.
```bash
git add mobile/theme && git commit -m "feat: apogee theme tokens + pnl color"
```

---

## Milestone 1 — Logic Layer (test-first)

### Task 3: Formatters (port from web)

**Files:** `mobile/lib/format.ts`, `mobile/lib/format.test.ts`.

- [ ] **Step 1: Failing test**

`mobile/lib/format.test.ts`:
```ts
import { fmtMoney, fmtPct, fmtSignedMoney } from "./format";
test("money", () => { expect(fmtMoney(4182, "USD", "en-US")).toBe("$4,182.00"); });
test("signed", () => {
  expect(fmtSignedMoney(198, "USD", "en-US")).toBe("+$198.00");
  expect(fmtSignedMoney(-102, "USD", "en-US")).toBe("-$102.00");
});
test("pct", () => { expect(fmtPct(0.58, "en-US")).toBe("58%"); });
```

- [ ] **Step 2: Run → fail.** `cd mobile && npm test -- format`

- [ ] **Step 3: Implement** `mobile/lib/format.ts`:
```ts
export function fmtMoney(v: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(v);
}
export function fmtSignedMoney(v: number, currency: string, locale: string): string {
  const s = fmtMoney(Math.abs(v), currency, locale);
  return v < 0 ? `-${s}` : `+${s}`;
}
export function fmtPct(ratio: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(ratio);
}
```
Note: RN includes `Intl` on modern Hermes; if `Intl.NumberFormat` currency is unavailable in the test/runtime, add `npx expo install @formatjs/intl-numberformat` polyfill and import it in `jest.setup.ts` + app entry. Verify the test passes; add the polyfill only if it fails.

- [ ] **Step 4: Run + commit.** PASS → `git add mobile/lib/format.* && git commit -m "feat: locale formatters (ported from web)"`

---

### Task 4: Calendar month grid (port from web)

**Files:** `mobile/lib/calendar.ts`, `mobile/lib/calendar.test.ts`.

- [ ] **Step 1: Failing test**

```ts
import { monthGrid } from "./calendar";
test("6x7 grid with pnl mapped", () => {
  const g = monthGrid(2026, 6, { "2026-06-01": 200, "2026-06-15": -50 });
  expect(g.weeks.length).toBe(6);
  expect(g.weeks[0].length).toBe(7);
  expect(g.weeks.flat().find((c) => c?.date === "2026-06-01")?.pnl).toBe(200);
  expect(g.monthTotal).toBe(150);
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement** (identical logic to `web/src/lib/calendar.ts`):
```ts
export interface DayCell { date: string; pnl: number | null }
export interface MonthGrid { weeks: (DayCell | null)[][]; monthTotal: number }

export function monthGrid(year: number, month: number, pnl: Record<string, number>): MonthGrid {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const startDow = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (DayCell | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  let monthTotal = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const v = pnl[date] ?? null;
    if (v != null) monthTotal += v;
    cells.push({ date, pnl: v });
  }
  while (cells.length < 42) cells.push(null);
  const weeks: (DayCell | null)[][] = [];
  for (let i = 0; i < 42; i += 7) weeks.push(cells.slice(i, i + 7));
  return { weeks, monthTotal: Math.round(monthTotal * 100) / 100 };
}
```

- [ ] **Step 4: Run + commit.** PASS → `git add mobile/lib/calendar.* && git commit -m "feat: calendar month-grid math (ported)"`

---

### Task 5: API client + types + auth store

**Files:** `mobile/lib/api/client.ts`, `mobile/lib/api/types.ts`, `mobile/lib/store.ts`, `mobile/lib/api/client.test.ts`.

- [ ] **Step 1: Failing test**

`mobile/lib/api/client.test.ts`:
```ts
import { ApiError, apiFetch, setToken, setBaseUrl } from "./client";

afterEach(() => jest.restoreAllMocks());

test("attaches bearer + parses json", async () => {
  setBaseUrl("http://x/api/v1");
  setToken("tok123");
  const spy = jest.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ ok: true }), { status: 200 }) as any,
  );
  const out = await apiFetch("/trades");
  expect(out).toEqual({ ok: true });
  const init = spy.mock.calls[0][1] as RequestInit;
  expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok123");
});

test("throws ApiError on non-2xx", async () => {
  jest.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ error: { code: "bad", message: "nope" } }), { status: 400 }) as any,
  );
  await expect(apiFetch("/x")).rejects.toMatchObject({ message: "nope", code: "bad" });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement `client.ts`**

```ts
let baseUrl = "http://localhost:8080/api/v1";
let token = "";

export function setBaseUrl(u: string) { baseUrl = u; }
export function getBaseUrl() { return baseUrl; }
export function setToken(t: string) { token = t; }
export function getToken() { return token; }

export class ApiError extends Error {
  code: string; status: number;
  constructor(status: number, code: string, message: string) { super(message); this.code = code; this.status = status; }
}

export async function apiFetch<T = unknown>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(baseUrl + path, {
    ...opts,
    headers: {
      ...(opts.body && !(opts.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers ?? {}),
    },
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = (body as any)?.error ?? {};
    throw new ApiError(res.status, e.code ?? "error", e.message ?? "Request failed");
  }
  return body as T;
}

export function qs(params: Record<string, string | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) u.set(k, v);
  const s = u.toString();
  return s ? `?${s}` : "";
}
```
The in-memory `token`/`baseUrl` are hydrated from secure-store at launch and on login (Task 7). This keeps `apiFetch` synchronous re: the token.

- [ ] **Step 4: `types.ts`** — port the DTO interfaces from `web/src/lib/api/types.ts` verbatim (snake_case): `Account, Trade, TradeDetail, Execution, TradeAttachment, Setup, Tag, Summary, EquityCurve, Tokens, Filters`. (Read the web file for exact fields.)

- [ ] **Step 5: `lib/store.ts`** — Zustand store:
```ts
import { create } from "zustand";

interface AppState {
  authed: boolean;
  accountId?: string;
  setAuthed: (v: boolean) => void;
  setAccount: (id?: string) => void;
}
export const useApp = create<AppState>((set) => ({
  authed: false,
  setAuthed: (authed) => set({ authed }),
  setAccount: (accountId) => set({ accountId }),
}));
```

- [ ] **Step 6: Run + commit.** `cd mobile && npm test -- client` → PASS.
```bash
git add mobile/lib && git commit -m "feat: api client, dto types, app store"
```

---

### Task 6: Resource modules + query hooks

**Files:** `mobile/lib/api/{accounts,trades,analytics,attachments,executions}.ts`, `mobile/lib/hooks/*.ts`, `mobile/lib/hooks/useTrades.test.tsx`.

- [ ] **Step 1: Failing hook test**

`mobile/lib/hooks/useTrades.test.tsx`:
```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import { useTrades } from "./useTrades";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

test("useTrades fetches list", async () => {
  jest.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify([{ id: "t1", symbol: "AAPL", net_pnl: 198 }]), { status: 200 }) as any,
  );
  const { result } = renderHook(() => useTrades({}), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.[0].symbol).toBe("AAPL");
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement resource modules** wrapping `apiFetch` per the API table (mirror `web/src/lib/api/*`). E.g. `trades.ts`:
```ts
import { apiFetch, qs } from "./client";
import type { Filters, Trade, TradeDetail } from "./types";
export const tradesApi = {
  list: (f: Filters) => apiFetch<Trade[]>(`/trades${qs(f as Record<string, string | undefined>)}`),
  get: (id: string) => apiFetch<TradeDetail>(`/trades/${id}`),
  patch: (id: string, body: { notes?: string; setup_id?: string; initial_risk?: number; tag_ids?: string[] }) =>
    apiFetch<TradeDetail>(`/trades/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
};
```
Implement `accountsApi.list`, `analyticsApi.{summary,equityCurve,daily}`, `attachmentsApi.{list,upload(FormData),delete}`, `executionsApi.create`.

- [ ] **Step 4: Implement hooks** in `lib/hooks/`: `useTrades(f)`, `useTradeDetail(id)`, `usePatchTrade()`, `useSummary(f)`, `useEquityCurve(f)`, `useDailyPnl(f)`, `useAccounts()`, `useAttachments(id)`+upload/delete, `useCreateExecution()`. Mutations invalidate the right keys (mirror web's `lib/hooks`).

- [ ] **Step 5: Run + commit.** `cd mobile && npm test -- useTrades` → PASS.
```bash
git add mobile/lib && git commit -m "feat: resource modules + query hooks"
```

---

## Milestone 2 — Providers, Auth, Login

### Task 7: Secure-store auth + providers + auth gate

**Files:** `mobile/lib/auth.ts`, `mobile/app/_layout.tsx`, `mobile/lib/auth.test.ts`.

- [ ] **Step 1: Failing test**

`mobile/lib/auth.test.ts` (mock secure-store):
```ts
jest.mock("expo-secure-store", () => {
  const store: Record<string, string> = {};
  return {
    getItemAsync: jest.fn(async (k: string) => store[k] ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => { store[k] = v; }),
    deleteItemAsync: jest.fn(async (k: string) => { delete store[k]; }),
  };
});
import { hydrateAuth, signIn, signOut } from "./auth";
import { getToken } from "./api/client";
import { useApp } from "./store";

test("signIn persists token + sets authed; signOut clears", async () => {
  await signIn("acc-token", "ref-token");
  expect(getToken()).toBe("acc-token");
  expect(useApp.getState().authed).toBe(true);
  await signOut();
  expect(getToken()).toBe("");
  expect(useApp.getState().authed).toBe(false);
});

test("hydrateAuth restores a saved token", async () => {
  await signIn("saved", "ref");
  setTokenForTest("");
  await hydrateAuth();
  expect(getToken()).toBe("saved");
});
```
(Add a tiny `setTokenForTest` export from client, or assert via `useApp.authed` after hydrate; keep the test consistent with what you implement.)

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement `auth.ts`**

```ts
import * as SecureStore from "expo-secure-store";
import { setToken } from "./api/client";
import { useApp } from "./store";

const ACCESS = "tm_access";
const REFRESH = "tm_refresh";

export async function signIn(access: string, refresh: string) {
  await SecureStore.setItemAsync(ACCESS, access);
  await SecureStore.setItemAsync(REFRESH, refresh);
  setToken(access);
  useApp.getState().setAuthed(true);
}

export async function signOut() {
  await SecureStore.deleteItemAsync(ACCESS);
  await SecureStore.deleteItemAsync(REFRESH);
  setToken("");
  useApp.getState().setAuthed(false);
}

export async function hydrateAuth() {
  const access = await SecureStore.getItemAsync(ACCESS);
  if (access) { setToken(access); useApp.getState().setAuthed(true); }
}
```

- [ ] **Step 4: Root layout** `app/_layout.tsx`: a `QueryClientProvider`, font loading (`expo-font` with Figtree/JetBrainsMono/NotoSansTC), call `hydrateAuth()` once on mount, and gate: while not hydrated show a splash/null; if `!authed` render the login stack, else the tabs. Use Expo Router's `<Stack>`/`<Redirect>` with the auth store. Verify the Expo Router auth-gate pattern against current docs via Context7.

- [ ] **Step 5: Run + commit.** auth test PASS.
```bash
git add mobile/lib/auth.* mobile/app/_layout.tsx && git commit -m "feat: secure-store auth + providers + auth gate"
```

---

### Task 8: Login screen

**Files:** `mobile/app/login.tsx`, `mobile/lib/api/auth.ts`, `mobile/components/LoginForm.tsx` + `LoginForm.test.tsx`.

- [ ] **Step 1: Failing component test**

`mobile/components/LoginForm.test.tsx`: render `<LoginForm onSubmit={fn} />`, type into email/password fields (Testing Library `fireEvent.changeText`), press Sign in, assert `onSubmit` called with the values. (Keep `LoginForm` a pure presentational component taking `onSubmit(email,password)`, `error`, `busy`, `mode`, `onToggleMode` — testable without network.)

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement** `LoginForm.tsx` (themed: dark card, lavender Sign-in button, Email/Password labeled inputs, register toggle) using RN `TextInput` + Reacticx/Expo UI button. Implement `authApi` (`login`, `register`, `refresh` over `apiFetch`). `app/login.tsx` wires the form: on submit → `authApi.login` (register first if mode=register) → `signIn(access, refresh)`; show `ApiError.message` on failure. Include a "Server URL" field/section that calls `setBaseUrl` + persists it to secure-store.

- [ ] **Step 4: Run + commit.** `cd mobile && npm test -- LoginForm` → PASS.
```bash
git add mobile/app/login.tsx mobile/lib/api/auth.ts mobile/components/LoginForm* && git commit -m "feat: login/register screen + server url"
```

---

## Milestone 3 — Shared Components

### Task 9: StatTile, TradeCard, CalendarGrid (themed) + EquitySparkline (Skia)

**Files:** `mobile/components/{StatTile,TradeCard,CalendarGrid,EquitySparkline}.tsx` + a test each.

- [ ] **Step 1: Failing tests** — for `StatTile` (renders label + value), `TradeCard` (renders symbol + colored net P&L), `CalendarGrid` (given a dailyPnl map + year/month renders the day cell with its value). Use `@testing-library/react-native` `render` + `getByText`. For `EquitySparkline` (Skia), a render-without-crash smoke test (mock Skia if jsdom-like issues arise; Skia in jest-expo may need the `@shopify/react-native-skia/jestSetup` — add it to jest setup).

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement** the four components using the theme tokens (`theme/tokens.ts`), `pnlColor`, and formatters. `CalendarGrid` consumes `monthGrid(...)` and renders 6×7 themed `View` cells (lavender/red tint by sign, intensity by magnitude). `EquitySparkline` draws a line+area with `@shopify/react-native-skia` (`Canvas`, `Path`) from `points[]`. `TradeCard` is a pressable row/card. Verify Skia drawing API via Context7 if unsure.

- [ ] **Step 4: Run + commit.** tests PASS.
```bash
git add mobile/components && git commit -m "feat: shared themed components + skia equity sparkline"
```

---

## Milestone 4 — Screens

Each screen task: write a component smoke test (mock the hooks or pass data into a pure view), implement the screen wiring the hooks + components, then commit. On-device verification noted per screen (run `expo start` on an iOS dev build).

### Task 10: Dashboard (`app/(tabs)/index.tsx`)
Build a native bottom-tabs layout (`app/(tabs)/_layout.tsx`) — Dashboard/Calendar/Trades/Settings, themed, with a nav-bar "+" opening `/add`. Dashboard: `useSummary`, `useEquityCurve`, `useDailyPnl`, `useTrades`, `useAccounts` (account currency); render KPI `StatTile`s, `EquitySparkline`, a mini `CalendarGrid` (current month), recent `TradeCard`s; `RefreshControl` pull-to-refresh (refetch). Loading skeletons / empty / error states. **Test:** a `DashboardView` pure component fed mocked data asserts a KPI value + a recent-trade symbol. Commit `feat: dashboard screen`.

### Task 11: Calendar (`app/(tabs)/calendar.tsx`)
`useDailyPnl` → full-month `CalendarGrid` with month nav (prev/next, `expo-haptics` on tap); tap a day → `useTrades({from,to})` for that day shown in a sheet/list. **Test:** `CalendarView` with a dailyPnl map asserts the day cell value. Commit `feat: calendar screen`.

### Task 12: Trades list + Trade detail
- **Trades** (`app/(tabs)/trades.tsx`): `useTrades` → `FlatList` of `TradeCard`s, pull-to-refresh, tap → `/trade/[id]`. **Test:** list renders two trades.
- **Trade detail** (`app/trade/[id].tsx`): `useTradeDetail(id)` → header stats, fills list, and a `JournalForm` (notes `TextInput`, setup picker via **Expo UI** `Picker`, tags/mistakes multiselect, initial-risk input) that calls `usePatchTrade`. **Test:** `JournalForm` renders existing notes + fires `onSave` with edits. Commit `feat: trades list + trade detail (journal)`.
(Add Reacticx components here if used — copy them into `mobile/components/` and restyle to tokens; verify the Reacticx add/copy command via its docs.)

### Task 13: Screenshots on trade detail
`ScreenshotGallery` component: shows `attachments` as images (fetch the authed blob via the api client → object URL, mirroring web's AuthedImage, OR pass the token in the image request), an "Add" action using `expo-image-picker` (library) and `expo-camera` (snap), uploading via `useUploadAttachment` (FormData), and delete. Permissions configured in `app.config`. **Test:** gallery renders N attachments + an add button (mock the picker). Commit `feat: trade screenshot capture + gallery`.

### Task 14: Quick-add trade (`app/add.tsx`)
Modal form: symbol, side (buy/sell — but a "trade" is entry+exit; v1 quick-add captures entry side + qty + entry price + exit price + dates and creates **two executions** via `useCreateExecution` so the server groups a closed trade). Optional "snap a chart" after save (reuse `ScreenshotGallery` upload against the new trade). Validate inputs; show toast on success/failure; `expo-haptics` on save. **Test:** the pure form fires `onSubmit` with parsed values. Commit `feat: quick-add trade`.

### Task 15: Settings (`app/(tabs)/settings.tsx`)
Account switcher (Expo UI `Picker` from `useAccounts`, sets `useApp.setAccount`), server URL field (updates `setBaseUrl` + secure-store), language selector, **Sign out** (calls `signOut`). **Test:** renders accounts + a sign-out control that calls the handler. Commit `feat: settings screen`.

---

## Milestone 5 — Ship

### Task 16: Polish + EAS + TestFlight

- [ ] **Step 1:** Safe-area insets on all screens; consistent empty/loading/error states; haptics on primary actions; verify the dark theme + fonts load (Figtree/JetBrainsMono/NotoSansTC) on device.
- [ ] **Step 2:** `eas.json` (development + preview + production profiles); `app.config` icon + splash (dark + lavender); bundle id; required permission strings (camera, photo library) with usage descriptions.
- [ ] **Step 3:** `npx expo run:ios` (or EAS dev build) and walk the full path on a simulator/device: login → dashboard → calendar → open a trade → journal a note → add a screenshot → quick-add a trade → settings sign out. Fix issues.
- [ ] **Step 4:** `eas build -p ios --profile preview` (or production) → TestFlight. Document the build/submit steps in `mobile/README.md`.
- [ ] **Step 5:** Full check: `cd mobile && npm test && npm run lint`. Commit `chore: mobile polish + eas/testflight config` and tag `phase-3-mobile-complete`.

---

## Self-Review Notes

- **Spec coverage:** §2 stack → T1–T2, T9 (Skia), T7 (secure-store); §3 nav/IA → T7/T10 (tabs + gate + "+"); §4 screens → T8/T10/T11/T12/T13/T14/T15; §5 data/auth/errors → T5/T6/T7; §6 theme → T2; §7 testing → each task's jest-expo test; §8 sequence → milestones; distribution → T16. All covered.
- **Type consistency:** DTO field names are snake_case (ported from web `types.ts`); `apiFetch`/`setToken`/`setBaseUrl`/`ApiError`/`qs` used consistently; hooks (`useTrades/useTradeDetail/usePatchTrade/useSummary/useEquityCurve/useDailyPnl/useAccounts/useCreateExecution/useUploadAttachment`) named consistently; theme `tokens` + `pnlColor` referenced everywhere.
- **Verify-don't-guess:** Expo UI, Reacticx, Skia, and the Expo Router auth-gate pattern are version-sensitive — fetch current docs via Context7 before using their APIs. Expo UI + Skia need a dev build (not Expo Go); the simulator walk-through in T16 is the real verification for native UI.
- **Watch-out:** RN `Intl` currency formatting may need the `@formatjs/intl-numberformat` polyfill (Task 3 note). Authed `<Image>` needs the token (Task 13).
```
