# Web UI Stabilization Wave 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the redesigned web app trustworthy for daily use: `/reports` no longer crashes the shell, sessions silently refresh instead of hard-logging the trader out, journal edits survive interruptions, dates use one locale everywhere, and the equity chart axes render legibly.

**Architecture:** All changes are in `web/` (React 19 + TanStack Router/Query + Vitest + Playwright). No API changes — the Go API already mints 15-min access / 30-day refresh tokens and exposes `POST /auth/refresh`. Fixes are: a missing import + router-level error boundary; a refresh-and-retry layer inside `apiFetch`; a localStorage draft layer in `JournalPanel`; a shared `LOCALE` module; and chart tick formatters.

**Tech Stack:** TypeScript, React 19, TanStack Router v1 (`defaultErrorComponent`), Recharts, Vitest + Testing Library (jsdom), Playwright.

**Spec:** `docs/superpowers/specs/2026-07-10-web-stabilization-wave1-design.md`

## Global Constraints

- Working dir for all commands: `web/` (run as `cd web && …`).
- Test runner: `pnpm test <path>` (script is `vitest run`); full suite `pnpm test`; lint `pnpm lint` (biome).
- Styling: Tailwind v4 utilities backed by Signal tokens (`bg-bg-panel`, `text-text-muted`, `rounded-control`, `border-border`, `text-signal`, `text-loss`, `font-mono`). Never introduce raw hex values or `12px` uniform radius (see `DESIGN.md`).
- localStorage keys in use: `tm_token` (access). This plan adds `tm_refresh` and `tm_draft_trade_<id>`.
- jsdom's `navigator.language` is `en-US` — existing formatted-string assertions stay deterministic.
- The repo has ~50 uncommitted redesign files. Commit **only** the files each task names (`git add <exact paths>`), never `git add -A`.
- Commit trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Fix `/reports` crash (missing `StatCard` import) with regression test

**Files:**
- Modify: `web/src/app/screens/ReportsView.tsx` (imports block, lines 12–20)
- Test: `web/src/app/screens/ReportsView.test.tsx`

**Interfaces:**
- Consumes: `StatCard` from `web/src/components/StatCard.tsx` — `export function StatCard({ label, value, accent, hint }: { label: string; value: string; accent?: "pos" | "neg" | "none"; hint?: string })`.
- Produces: nothing new — restores the existing `ReportsView` render path.

Background: `ReportsView.tsx` uses `<StatCard>` (lines 110–158 in `SummaryMetricsGrid`) but the import was dropped during the redesign sweep, so `/reports` throws `ReferenceError: StatCard is not defined`. The existing tests never pass a `summary` prop, so the metrics grid never rendered in tests — that's the coverage gap to close.

- [ ] **Step 1: Write the failing test**

Add to the `describe("ReportsView", …)` block in `web/src/app/screens/ReportsView.test.tsx` (reuse the existing `grp()` helper and `base` props object already defined in that file):

```tsx
it("renders the summary metrics grid", () => {
	render(
		<ReportsView
			{...base}
			dim="symbol"
			breakdown={[grp("AAPL", 200)]}
			summary={grp("all", 60).summary}
		/>,
	);
	expect(screen.getByText("Profit Factor")).toBeInTheDocument();
	expect(screen.getByText("Expectancy")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test src/app/screens/ReportsView.test.tsx`
Expected: FAIL — `ReferenceError: StatCard is not defined` (thrown from `SummaryMetricsGrid`).

- [ ] **Step 3: Add the missing import**

In `web/src/app/screens/ReportsView.tsx`, the imports block currently reads (lines 12–17):

```ts
import { ChartFrame, chartTheme } from "../../components/ChartFrame";
import { DataTable } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { Panel } from "../../components/Panel";
import { Skeleton } from "../../components/Skeleton";
import { pnlColor } from "../../components/theme-tokens";
```

Add alongside them (keep alphabetical order to satisfy biome's import sort):

```ts
import { StatCard } from "../../components/StatCard";
```

(after the `Skeleton` import, before `theme-tokens`).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && pnpm test src/app/screens/ReportsView.test.tsx`
Expected: PASS (all tests in file, including the two pre-existing ones).

- [ ] **Step 5: Commit**

```bash
cd web && git add src/app/screens/ReportsView.tsx src/app/screens/ReportsView.test.tsx
git commit -m "fix(web): restore StatCard import lost in redesign sweep; cover metrics grid in tests

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Shell-preserving route error boundary

**Files:**
- Create: `web/src/components/RouteErrorPanel.tsx`
- Test: `web/src/components/RouteErrorPanel.test.tsx`
- Modify: `web/src/main.tsx:18`

**Interfaces:**
- Produces: `export function RouteErrorPanel({ error }: { error: Error })` — rendered by TanStack Router's `defaultErrorComponent` (router passes `{ error, reset, info }`; extra props are ignored).

Background: the router is created with `createRouter({ routeTree })` and no error component, so any screen crash unmounts the entire app into TanStack's raw fallback. `defaultErrorComponent` applies per-route, so a crash in a child route renders the panel at the `<Outlet />` position while nav/header stay alive.

- [ ] **Step 1: Write the failing test**

Create `web/src/components/RouteErrorPanel.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RouteErrorPanel } from "./RouteErrorPanel";

describe("RouteErrorPanel", () => {
	it("shows the error message and a reload action", () => {
		render(<RouteErrorPanel error={new Error("StatCard is not defined")} />);
		expect(screen.getByText("Screen error")).toBeInTheDocument();
		expect(screen.getByText("StatCard is not defined")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test src/components/RouteErrorPanel.test.tsx`
Expected: FAIL — cannot resolve `./RouteErrorPanel`.

- [ ] **Step 3: Create the component**

Create `web/src/components/RouteErrorPanel.tsx`:

```tsx
export function RouteErrorPanel({ error }: { error: Error }) {
	return (
		<div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 p-8">
			<p className="font-mono text-[11px] tracking-[0.1em] text-signal uppercase">
				Screen error
			</p>
			<p className="max-w-[480px] text-center text-[13px] text-text">
				This screen crashed. The rest of the app is unaffected.
			</p>
			<pre className="max-w-full overflow-x-auto rounded-control border border-border bg-bg-inset px-3 py-2 font-mono text-[11px] text-loss">
				{error.message}
			</pre>
			<button
				type="button"
				onClick={() => window.location.reload()}
				className="cursor-pointer rounded-control border border-border bg-bg-panel px-3 py-1.5 text-xs text-text transition-colors duration-150 hover:bg-bg-hover"
			>
				Reload
			</button>
		</div>
	);
}
```

- [ ] **Step 4: Wire it into the router**

In `web/src/main.tsx`, replace line 18:

```ts
const router = createRouter({ routeTree });
```

with:

```ts
const router = createRouter({
	routeTree,
	defaultErrorComponent: ({ error }) => <RouteErrorPanel error={error} />,
});
```

and add the import (with the other local imports):

```ts
import { RouteErrorPanel } from "./components/RouteErrorPanel";
```

Note: `main.tsx` already contains JSX, so no file rename is needed.

- [ ] **Step 5: Run tests and typecheck**

Run: `cd web && pnpm test src/components/RouteErrorPanel.test.tsx && pnpm exec tsc -b --noEmit`
Expected: test PASS; tsc exits 0.

- [ ] **Step 6: Commit**

```bash
cd web && git add src/components/RouteErrorPanel.tsx src/components/RouteErrorPanel.test.tsx src/main.tsx
git commit -m "feat(web): shell-preserving defaultErrorComponent for route crashes

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Silent token refresh on 401

**Files:**
- Modify: `web/src/lib/api/client.ts`
- Modify: `web/src/lib/auth.ts`
- Modify: `web/src/app/screens/LoginScreen.tsx:124` (and the register path directly above it)
- Test: `web/src/lib/api/client.test.ts`

**Interfaces:**
- Consumes: `POST /auth/refresh` with JSON `{ refresh_token }` → `{ access_token, refresh_token }` (Go API, already live).
- Produces:
  - `client.ts`: `export function setTokens(access: string, refresh: string): void` and `export function getRefreshToken(): string`. Existing `setToken/getToken/apiFetch/setUnauthorizedHandler/ApiError/qs` keep their signatures; `apiFetch` gains an internal third parameter `retried = false` (callers unaffected).
  - `auth.ts`: `signIn` signature changes to `signIn(access: string, refresh: string): void`. Task 4+ and `LoginScreen` rely on this.

Behavior: on a 401 for a non-`/auth/*` path, `apiFetch` performs a single-flight refresh (concurrent 401s share one refresh request), then retries the original request exactly once. If there is no refresh token, the refresh fails, or the retry 401s again → fall back to today's behavior (`onUnauthorized` → logout).

- [ ] **Step 1: Write the failing tests**

Append to the `describe("apiFetch", …)` block in `web/src/lib/api/client.test.ts`. Also update the file's imports to include the new functions:

```ts
import {
	ApiError,
	apiFetch,
	getRefreshToken,
	setToken,
	setTokens,
	setUnauthorizedHandler,
} from "./client";
```

and extend the existing `afterEach` to reset token state:

```ts
afterEach(() => {
	vi.restoreAllMocks();
	setTokens("", "");
	setUnauthorizedHandler(null);
});
```

New tests:

```ts
function protected401() {
	return new Response(
		JSON.stringify({ error: { code: "error", message: "Unauthorized" } }),
		{ status: 401 },
	);
}

describe("token refresh", () => {
	it("persists and clears the refresh token", () => {
		setTokens("acc", "ref");
		expect(getRefreshToken()).toBe("ref");
		expect(localStorage.getItem("tm_refresh")).toBe("ref");
		setTokens("", "");
		expect(getRefreshToken()).toBe("");
		expect(localStorage.getItem("tm_refresh")).toBeNull();
	});

	it("silently refreshes and retries once on 401", async () => {
		setTokens("stale", "ref-1");
		const spy = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async (url, init) => {
				if (String(url).endsWith("/auth/refresh")) {
					return new Response(
						JSON.stringify({ access_token: "fresh", refresh_token: "ref-2" }),
						{ status: 200 },
					);
				}
				const auth = (init?.headers as Record<string, string>).Authorization;
				if (auth === "Bearer fresh") {
					return new Response(JSON.stringify({ ok: true }), { status: 200 });
				}
				return protected401();
			});
		const out = await apiFetch("/trades");
		expect(out).toEqual({ ok: true });
		expect(getRefreshToken()).toBe("ref-2");
		const refreshCalls = spy.mock.calls.filter((c) =>
			String(c[0]).endsWith("/auth/refresh"),
		);
		expect(refreshCalls).toHaveLength(1);
	});

	it("shares one refresh across concurrent 401s (single-flight)", async () => {
		setTokens("stale", "ref-1");
		const spy = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async (url, init) => {
				if (String(url).endsWith("/auth/refresh")) {
					await new Promise((r) => setTimeout(r, 10));
					return new Response(
						JSON.stringify({ access_token: "fresh", refresh_token: "ref-2" }),
						{ status: 200 },
					);
				}
				const auth = (init?.headers as Record<string, string>).Authorization;
				if (auth === "Bearer fresh") {
					return new Response(JSON.stringify({ ok: true }), { status: 200 });
				}
				return protected401();
			});
		const [a, b] = await Promise.all([
			apiFetch("/trades"),
			apiFetch("/setups"),
		]);
		expect(a).toEqual({ ok: true });
		expect(b).toEqual({ ok: true });
		const refreshCalls = spy.mock.calls.filter((c) =>
			String(c[0]).endsWith("/auth/refresh"),
		);
		expect(refreshCalls).toHaveLength(1);
	});

	it("falls back to unauthorized handler when refresh fails", async () => {
		setTokens("stale", "bad-ref");
		const onUnauthorized = vi.fn();
		setUnauthorizedHandler(onUnauthorized);
		vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
			if (String(url).endsWith("/auth/refresh")) return protected401();
			return protected401();
		});
		await expect(apiFetch("/trades")).rejects.toBeInstanceOf(ApiError);
		expect(onUnauthorized).toHaveBeenCalledOnce();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && pnpm test src/lib/api/client.test.ts`
Expected: FAIL — `client.ts` does not export `setTokens`/`getRefreshToken` (import error), so the whole file fails.

- [ ] **Step 3: Implement in `client.ts`**

Replace the token block (lines 2–45) and `apiFetch` (lines 57–86) so the file reads:

```ts
const BASE = (import.meta.env.VITE_API as string) ?? "/api/v1";
let token = "";
let refreshToken = "";
let refreshInFlight: Promise<boolean> | null = null;
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
	onUnauthorized = handler;
}

function tryStorage(): Storage | null {
	try {
		if (
			typeof localStorage !== "undefined" &&
			typeof localStorage.getItem === "function"
		) {
			return localStorage;
		}
	} catch {
		/* ignore */
	}
	return null;
}

function persist(key: string, value: string) {
	try {
		const s = tryStorage();
		if (s) {
			if (value) s.setItem(key, value);
			else s.removeItem(key);
		}
	} catch {
		/* ignore */
	}
}

export function setToken(t: string) {
	token = t;
	persist("tm_token", t);
}

export function setTokens(access: string, refresh: string) {
	setToken(access);
	refreshToken = refresh;
	persist("tm_refresh", refresh);
}

export function getToken() {
	if (!token) {
		try {
			const saved = tryStorage()?.getItem("tm_token");
			if (saved) token = saved;
		} catch {
			/* ignore */
		}
	}
	return token;
}

export function getRefreshToken() {
	if (!refreshToken) {
		try {
			const saved = tryStorage()?.getItem("tm_refresh");
			if (saved) refreshToken = saved;
		} catch {
			/* ignore */
		}
	}
	return refreshToken;
}

export class ApiError extends Error {
	code: string;
	status: number;
	constructor(status: number, code: string, message: string) {
		super(message);
		this.code = code;
		this.status = status;
	}
}

// Exchange the refresh token for fresh tokens. Single-flight: concurrent 401s
// await the same refresh request. Uses fetch directly (not apiFetch) so a
// failing refresh can never recurse.
function tryRefresh(): Promise<boolean> {
	if (!refreshInFlight) {
		refreshInFlight = (async () => {
			const rt = getRefreshToken();
			if (!rt) return false;
			try {
				const res = await fetch(`${BASE}/auth/refresh`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ refresh_token: rt }),
				});
				if (!res.ok) return false;
				const body = await res.json().catch(() => ({}));
				if (!body?.access_token) return false;
				setTokens(body.access_token, body.refresh_token ?? rt);
				return true;
			} catch {
				return false;
			}
		})().finally(() => {
			refreshInFlight = null;
		});
	}
	return refreshInFlight;
}

export async function apiFetch<T = unknown>(
	path: string,
	opts: RequestInit = {},
	retried = false,
): Promise<T> {
	const auth = getToken(); // lazily hydrates the token from storage on first use
	const res = await fetch(BASE + path, {
		...opts,
		headers: {
			...(opts.body && !(opts.body instanceof FormData)
				? { "Content-Type": "application/json" }
				: {}),
			...(auth ? { Authorization: `Bearer ${auth}` } : {}),
			...(opts.headers ?? {}),
		},
	});
	if (res.status === 204) return undefined as T;
	const body = await res.json().catch(() => ({}));
	if (!res.ok) {
		if (res.status === 401 && !path.startsWith("/auth/")) {
			if (!retried && (await tryRefresh())) {
				return apiFetch<T>(path, opts, true);
			}
			onUnauthorized?.();
		}
		const e = body?.error ?? {};
		throw new ApiError(
			res.status,
			e.code ?? "error",
			e.message ?? res.statusText,
		);
	}
	return body as T;
}
```

Keep the existing `qs()` helper unchanged at the bottom of the file.

- [ ] **Step 4: Update `auth.ts` and `LoginScreen.tsx`**

`web/src/lib/auth.ts` — switch to the two-token API:

```ts
import { create } from "zustand";
import { getToken, setTokens, setUnauthorizedHandler } from "./api/client";

interface AuthState {
	authed: boolean;
	signIn: (access: string, refresh: string) => void;
	signOut: () => void;
}

function signOut() {
	setTokens("", "");
	useAuth.setState({ authed: false });
}

setUnauthorizedHandler(signOut);

// Reactive auth presence, mirrored from the api client's token storage so the
// shell can gate on it. The api client remains the source of truth for the
// token value; this store only tracks whether we are signed in.
export const useAuth = create<AuthState>((set) => ({
	authed: !!getToken(),
	signIn: (access, refresh) => {
		setTokens(access, refresh);
		set({ authed: true });
	},
	signOut,
}));
```

`web/src/app/screens/LoginScreen.tsx` line 124 — pass both tokens:

```ts
const tokens = await authApi.login(loginEmail, loginPassword);
signIn(tokens.access_token, tokens.refresh_token);
```

(The dev sign-in path funnels through the same `completeSignIn` → `authApi.login` flow, so no other call site changes.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd web && pnpm test src/lib/api/client.test.ts && pnpm exec tsc -b --noEmit`
Expected: all client tests PASS (including the three pre-existing ones); tsc exits 0. If any other test stubs `signIn`, update it to the two-argument signature.

- [ ] **Step 6: Run the full web suite**

Run: `cd web && pnpm test`
Expected: PASS. (`LoginScreen` tests, if they assert `signIn` calls, need the second argument added.)

- [ ] **Step 7: Commit**

```bash
cd web && git add src/lib/api/client.ts src/lib/api/client.test.ts src/lib/auth.ts src/app/screens/LoginScreen.tsx
git commit -m "feat(web): silent single-flight token refresh on 401

The API has always minted refresh tokens; the client now stores them
(tm_refresh) and exchanges them on 401 instead of hard-logging out.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Journal draft autosave (Trade Detail)

**Files:**
- Modify: `web/src/app/screens/TradeDetailView.tsx` (JournalPanel, lines 535–636, and the `<JournalPanel>` call site at line 1066)
- Modify: `web/src/routes/trades.$id.tsx` (`handleSave`, lines 37–58)
- Test: `web/src/app/screens/TradeDetailView.test.tsx`

**Interfaces:**
- Consumes: `JournalFormState` and `JournalPanel` (both already exported from `TradeDetailView.tsx`).
- Produces: `export function journalDraftKey(tradeId: string): string` (from `TradeDetailView.tsx`); `JournalPanelProps` gains required `tradeId: string`.

Behavior: while editing, the form debounce-writes (500 ms) a draft to `localStorage` under `tm_draft_trade_<id>`. On mount, a draft that differs from the server state is restored with a visible "Unsaved draft restored" notice and a Discard action. The route clears the draft when the PATCH succeeds.

- [ ] **Step 1: Write the failing tests**

Append to `web/src/app/screens/TradeDetailView.test.tsx` (it already imports `render`, `screen`, `vi`; add `fireEvent` to the testing-library import and `JournalPanel`, `journalDraftKey`, and type `JournalFormState` to the view import):

```tsx
const emptyJournal: JournalFormState = {
	notes: "",
	setup_id: "",
	initial_risk: "",
	emotional_state: "",
	confidence: "",
	trade_quality: "",
	mae: "",
	mfe: "",
	tag_ids: [],
};

function renderJournal(tradeId: string, initial: JournalFormState = emptyJournal) {
	return render(
		<JournalPanel
			tradeId={tradeId}
			initialState={initial}
			setups={[]}
			customTags={[]}
			mistakeTags={[]}
			saving={false}
			onSave={vi.fn()}
		/>,
	);
}

describe("JournalPanel drafts", () => {
	afterEach(() => localStorage.clear());

	it("restores a differing draft on mount and discards it on request", () => {
		localStorage.setItem(
			journalDraftKey("t1"),
			JSON.stringify({ at: Date.now(), form: { ...emptyJournal, notes: "draft note" } }),
		);
		renderJournal("t1");
		expect(screen.getByLabelText("Notes")).toHaveValue("draft note");
		expect(screen.getByText("Unsaved draft restored.")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Discard draft" }));
		expect(screen.getByLabelText("Notes")).toHaveValue("");
		expect(localStorage.getItem(journalDraftKey("t1"))).toBeNull();
	});

	it("drops a stale draft identical to the server state", () => {
		localStorage.setItem(
			journalDraftKey("t2"),
			JSON.stringify({ at: Date.now(), form: emptyJournal }),
		);
		renderJournal("t2");
		expect(screen.queryByText("Unsaved draft restored.")).not.toBeInTheDocument();
		expect(localStorage.getItem(journalDraftKey("t2"))).toBeNull();
	});

	it("persists edits to a draft after the debounce window", () => {
		vi.useFakeTimers();
		renderJournal("t3");
		fireEvent.change(screen.getByLabelText("Notes"), {
			target: { value: "half-written thought" },
		});
		vi.advanceTimersByTime(600);
		const raw = localStorage.getItem(journalDraftKey("t3"));
		expect(raw).not.toBeNull();
		expect(JSON.parse(raw!).form.notes).toBe("half-written thought");
		vi.useRealTimers();
	});
});
```

Also add `afterEach` to the vitest import in that file if not present.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && pnpm test src/app/screens/TradeDetailView.test.tsx`
Expected: FAIL — `journalDraftKey` is not exported; `tradeId` prop does not exist.

- [ ] **Step 3: Implement in `TradeDetailView.tsx`**

Above `JournalFormState` (line 535) add:

```ts
export function journalDraftKey(tradeId: string): string {
	return `tm_draft_trade_${tradeId}`;
}
```

Extend the props (lines 547–554):

```ts
export interface JournalPanelProps {
	tradeId: string;
	initialState: JournalFormState;
	setups: Setup[];
	customTags: Tag[];
	mistakeTags: Tag[];
	saving: boolean;
	onSave: (state: JournalFormState) => void;
}
```

Destructure `tradeId` in the component signature, then add draft state + effects directly after the existing `initialState` sync effect (after line 584):

```ts
const [draftRestored, setDraftRestored] = useState(false);

// Restore an unsaved draft once per trade. Drafts identical to the server
// state are stale (already saved) and get dropped instead of restored.
useEffect(() => {
	try {
		const raw = localStorage.getItem(journalDraftKey(tradeId));
		if (!raw) return;
		const draft = JSON.parse(raw) as { at: number; form: JournalFormState };
		if (JSON.stringify(draft.form) !== JSON.stringify(initialState)) {
			setForm(draft.form);
			setDraftRestored(true);
		} else {
			localStorage.removeItem(journalDraftKey(tradeId));
		}
	} catch {
		/* corrupt draft — ignore */
	}
	// mount-only per trade; the panel is keyed by trade id at the call site
	// biome-ignore lint/correctness/useExhaustiveDependencies: run once per trade
}, [tradeId]);

// Debounce-persist edits so a session drop can't eat journal text.
useEffect(() => {
	if (form === initialState) return; // untouched (same reference)
	const t = setTimeout(() => {
		try {
			localStorage.setItem(
				journalDraftKey(tradeId),
				JSON.stringify({ at: Date.now(), form }),
			);
		} catch {
			/* storage full/unavailable — ignore */
		}
	}, 500);
	return () => clearTimeout(t);
}, [form, initialState, tradeId]);

function discardDraft() {
	setForm(initialState);
	setDraftRestored(false);
	try {
		localStorage.removeItem(journalDraftKey(tradeId));
	} catch {
		/* ignore */
	}
}
```

Render the notice as the first child inside the panel's root `<div className="flex flex-col gap-4 p-4">` (before the Notes block):

```tsx
{draftRestored && (
	<div className="flex items-center justify-between gap-3 rounded-control border border-border bg-bg-inset px-3 py-2">
		<span className="text-[11px] text-text-muted">
			Unsaved draft restored.
		</span>
		<button
			type="button"
			onClick={discardDraft}
			className="cursor-pointer text-[11px] text-accent hover:underline"
		>
			Discard draft
		</button>
	</div>
)}
```

At the call site (line 1066) pass the id:

```tsx
<JournalPanel
	key={trade.id} // re-mount if trade changes
	tradeId={trade.id}
	initialState={journalInitial}
	...
/>
```

- [ ] **Step 4: Clear the draft on successful save**

In `web/src/routes/trades.$id.tsx`, import the key helper (extend the existing `TradeDetailView` import):

```ts
import {
	type AddFillInput,
	type JournalFormState,
	TradeDetailView,
	journalDraftKey,
} from "../app/screens/TradeDetailView";
```

and pass per-call `onSuccess` in `handleSave`:

```ts
function handleSave(form: JournalFormState) {
	patchMutation.mutate(
		{
			id,
			body: {
				notes: form.notes,
				setup_id: form.setup_id || undefined,
				initial_risk: form.initial_risk
					? Number.parseFloat(form.initial_risk)
					: undefined,
				emotional_state: form.emotional_state,
				confidence: form.confidence
					? Number.parseInt(form.confidence, 10)
					: undefined,
				trade_quality: form.trade_quality
					? Number.parseInt(form.trade_quality, 10)
					: undefined,
				mae: form.mae ? Number.parseFloat(form.mae) : undefined,
				mfe: form.mfe ? Number.parseFloat(form.mfe) : undefined,
				tag_ids: form.tag_ids,
			},
		},
		{
			onSuccess: () => {
				try {
					localStorage.removeItem(journalDraftKey(id));
				} catch {
					/* ignore */
				}
			},
		},
	);
}
```

(The `body` object is byte-for-byte the existing construction — only the second `mutate` argument is new.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd web && pnpm test src/app/screens/TradeDetailView.test.tsx && pnpm exec tsc -b --noEmit`
Expected: PASS; tsc exits 0.

- [ ] **Step 6: Commit**

```bash
cd web && git add src/app/screens/TradeDetailView.tsx src/app/screens/TradeDetailView.test.tsx src/routes/trades.\$id.tsx
git commit -m "feat(web): journal draft autosave with restore + discard on trade detail

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: One shared locale for all formatting

**Files:**
- Create: `web/src/lib/locale.ts`
- Modify: `web/src/lib/format.ts:28-32` (`fmtDateShort`)
- Modify (drop local `const LOCALE = "en-US"`, import shared one): `web/src/app/screens/DashboardView.tsx:46`, `web/src/app/screens/ReportsView.tsx:77`, `web/src/app/screens/TradeDetailView.tsx:23`, `web/src/app/screens/CalendarView.tsx:12`, `web/src/app/screens/PlaybookView.tsx:32`, `web/src/components/tradeColumns.tsx:13`, `web/src/components/HeaderBar.tsx:14`
- Modify (inline `"en-US"` → `LOCALE`): `web/src/app/screens/SettingsView.tsx:369,614`
- Test: `web/src/lib/format.test.ts` (create if absent)

**Interfaces:**
- Produces: `export const LOCALE: string` from `web/src/lib/locale.ts` — the single locale constant every formatter and screen uses. Task 6 imports it too.

Background: seven files each pin `en-US` while native `datetime-local` inputs follow the OS locale, so one app shows `7/10/2026` and `10/07/2026` simultaneously. `fmtDateShort` also hand-rolls M/D/YYYY. Everything moves to the browser locale with an `en-US` fallback; jsdom reports `en-US`, so existing test assertions hold.

- [ ] **Step 1: Write the failing test**

Create (or extend) `web/src/lib/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fmtDateShort } from "./format";
import { LOCALE } from "./locale";

describe("locale", () => {
	it("resolves the browser locale with en-US fallback", () => {
		expect(LOCALE).toBe(navigator.language || "en-US");
	});
});

describe("fmtDateShort", () => {
	it("formats using the shared locale (en-US in jsdom)", () => {
		// Noon local time avoids UTC/local day-boundary flakiness.
		expect(fmtDateShort("2026-07-09T12:00:00")).toBe("7/9/2026");
	});
	it("returns a dash for null", () => {
		expect(fmtDateShort(null)).toBe("-");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test src/lib/format.test.ts`
Expected: FAIL — cannot resolve `./locale`.

- [ ] **Step 3: Create the locale module and rewire `fmtDateShort`**

Create `web/src/lib/locale.ts`:

```ts
// Single source of truth for display locale. Native date/time inputs always
// follow the browser locale; everything we format must agree with them.
export const LOCALE: string =
	typeof navigator !== "undefined" && navigator.language
		? navigator.language
		: "en-US";
```

In `web/src/lib/format.ts`, add `import { LOCALE } from "./locale";` at the top and replace `fmtDateShort` (lines 28–32):

```ts
export function fmtDateShort(iso: string | null): string {
	if (!iso) return "-";
	return new Date(iso).toLocaleDateString(LOCALE);
}
```

- [ ] **Step 4: Sweep the seven local constants and two inline literals**

In each of these files, delete the local `const LOCALE = "en-US";` line and add the import instead:

- `web/src/app/screens/DashboardView.tsx:46` → `import { LOCALE } from "../../lib/locale";`
- `web/src/app/screens/ReportsView.tsx:77` → same import path
- `web/src/app/screens/TradeDetailView.tsx:23` → same import path
- `web/src/app/screens/CalendarView.tsx:12` → same import path
- `web/src/app/screens/PlaybookView.tsx:32` → same import path
- `web/src/components/tradeColumns.tsx:13` → `import { LOCALE } from "../lib/locale";`
- `web/src/components/HeaderBar.tsx:14` → `import { LOCALE } from "../lib/locale";`

In `web/src/app/screens/SettingsView.tsx` add the same import and change lines 369 and 614 from `.toLocaleString("en-US", {` to `.toLocaleString(LOCALE, {`.

- [ ] **Step 5: Run the full web suite**

Run: `cd web && pnpm test && pnpm exec tsc -b --noEmit && pnpm lint`
Expected: all PASS (jsdom locale is `en-US`, so date-string assertions are unchanged). Fix any biome import-order complaints.

- [ ] **Step 6: Commit**

```bash
cd web && git add src/lib/locale.ts src/lib/format.ts src/lib/format.test.ts \
  src/app/screens/DashboardView.tsx src/app/screens/ReportsView.tsx \
  src/app/screens/TradeDetailView.tsx src/app/screens/CalendarView.tsx \
  src/app/screens/PlaybookView.tsx src/app/screens/SettingsView.tsx \
  src/components/tradeColumns.tsx src/components/HeaderBar.tsx
git commit -m "fix(web): single shared LOCALE so tables agree with native date inputs

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Legible equity chart axes

**Files:**
- Create: `web/src/lib/chartTicks.ts`
- Modify: `web/src/lib/format.ts` (add two helpers)
- Modify: `web/src/app/screens/DashboardView.tsx:280-296` (equity `XAxis`/`YAxis`)
- Modify: `web/src/app/screens/ReportsView.tsx:479-494` (equity `XAxis`/`YAxis`)
- Test: `web/src/lib/chartTicks.test.ts`, `web/src/lib/format.test.ts`

**Interfaces:**
- Consumes: `LOCALE` from Task 5.
- Produces:
  - `format.ts`: `export function fmtMoneyCompact(v: number, currency: string, locale: string): string` (e.g. `$10.1K`) and `export function fmtDayShort(iso: string, locale: string): string` (e.g. `Jul 9`).
  - `chartTicks.ts`: `export function uniqueDayTicks(points: ReadonlyArray<{ at: string }>): string[]` — first timestamp of each distinct day, for Recharts `ticks`.

Background: the dashboard y-axis prints full-precision currency (`$10,110.00`) into a 64px gutter (clipped), and the x-axis repeats `2026-07-09` because ticks are raw ISO slices with multiple points per day.

- [ ] **Step 1: Write the failing tests**

Create `web/src/lib/chartTicks.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { uniqueDayTicks } from "./chartTicks";

describe("uniqueDayTicks", () => {
	it("keeps the first point of each day", () => {
		expect(
			uniqueDayTicks([
				{ at: "2026-07-09T09:30:00Z" },
				{ at: "2026-07-09T15:45:00Z" },
				{ at: "2026-07-10T09:31:00Z" },
			]),
		).toEqual(["2026-07-09T09:30:00Z", "2026-07-10T09:31:00Z"]);
	});
	it("handles empty input", () => {
		expect(uniqueDayTicks([])).toEqual([]);
	});
});
```

Append to `web/src/lib/format.test.ts`:

```ts
import { fmtDayShort, fmtMoneyCompact } from "./format";

describe("chart axis formatters", () => {
	it("compacts currency for axis gutters", () => {
		expect(fmtMoneyCompact(10060, "USD", "en-US")).toBe("$10.1K");
		expect(fmtMoneyCompact(-450, "USD", "en-US")).toBe("-$450");
	});
	it("renders short day labels", () => {
		expect(fmtDayShort("2026-07-09T12:00:00", "en-US")).toBe("Jul 9");
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && pnpm test src/lib/chartTicks.test.ts src/lib/format.test.ts`
Expected: FAIL — module `./chartTicks` missing; `fmtMoneyCompact`/`fmtDayShort` not exported.

- [ ] **Step 3: Implement the helpers**

Create `web/src/lib/chartTicks.ts`:

```ts
// Recharts renders one tick per data point by default; equity series can have
// several points per day. Feed XAxis `ticks` with the first point of each day.
export function uniqueDayTicks(
	points: ReadonlyArray<{ at: string }>,
): string[] {
	const seen = new Set<string>();
	const ticks: string[] = [];
	for (const p of points) {
		const day = p.at.slice(0, 10);
		if (!seen.has(day)) {
			seen.add(day);
			ticks.push(p.at);
		}
	}
	return ticks;
}
```

Append to `web/src/lib/format.ts`:

```ts
export function fmtMoneyCompact(
	v: number,
	currency: string,
	locale: string,
): string {
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency,
		notation: "compact",
		maximumFractionDigits: 1,
	}).format(v);
}

export function fmtDayShort(iso: string, locale: string): string {
	return new Date(iso).toLocaleDateString(locale, {
		month: "short",
		day: "numeric",
	});
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && pnpm test src/lib/chartTicks.test.ts src/lib/format.test.ts`
Expected: PASS. If the compact assertion fails on `K` casing or spacing, adjust the expected string to the actual `Intl` output for `en-US` (do not loosen to a regex).

- [ ] **Step 5: Wire into DashboardView**

In `web/src/app/screens/DashboardView.tsx`, in the equity-curve component (the function containing `visible` and the `AreaChart`, lines ~240–300):

Add imports at the top of the file: `fmtMoneyCompact`, `fmtDayShort` from `../../lib/format`; `uniqueDayTicks` from `../../lib/chartTicks`; `useMemo` from `react` (extend existing react import if present).

Above the `return`, compute ticks:

```ts
const dayTicks = useMemo(() => uniqueDayTicks(visible), [visible]);
```

Replace the `XAxis` (lines 280–287):

```tsx
<XAxis
	dataKey="at"
	ticks={dayTicks}
	tick={{ fontSize: 10, fill: chartTheme.axisColor }}
	tickFormatter={(v: string) => fmtDayShort(v, LOCALE)}
	axisLine={false}
	tickLine={false}
	minTickGap={60}
/>
```

Replace the `YAxis` (lines 288–296):

```tsx
<YAxis
	tick={{ fontSize: 10, fill: chartTheme.axisColor }}
	tickFormatter={(v: number) => fmtMoneyCompact(v, currency, LOCALE)}
	axisLine={false}
	tickLine={false}
	width={52}
	domain={["auto", "auto"]}
/>
```

- [ ] **Step 6: Wire into ReportsView**

In `web/src/app/screens/ReportsView.tsx` equity chart (lines 479–494): import `fmtMoneyCompact`, `fmtDayShort` (extend the existing `../../lib/format` import), change the `XAxis` `tickFormatter={(v: string) => v.slice(5, 10)}` to `tickFormatter={(v: string) => fmtDayShort(v, LOCALE)}`, and the `YAxis` `tickFormatter` to `(v: number) => fmtMoneyCompact(v, currency, LOCALE)` with `width={52}`. (Reports equity points are one-per-day, so no `ticks` prop is needed there.)

- [ ] **Step 7: Run the full suite and typecheck**

Run: `cd web && pnpm test && pnpm exec tsc -b --noEmit && pnpm lint`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
cd web && git add src/lib/chartTicks.ts src/lib/chartTicks.test.ts src/lib/format.ts src/lib/format.test.ts src/app/screens/DashboardView.tsx src/app/screens/ReportsView.tsx
git commit -m "fix(web): compact currency + deduped day ticks on equity chart axes

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: E2E hardening + end-to-end verification

**Files:**
- Modify: `web/e2e/smoke.spec.ts`

**Interfaces:**
- Consumes: everything above; the running dev stack (`make dev-api` on :8080, `make dev-web` on :5173 — playwright config manages the web server via `webServer`).

- [ ] **Step 1: Strengthen the smoke test**

In `web/e2e/smoke.spec.ts`:

1. The forced-logout setup (line 10) must clear both tokens, otherwise the new refresh logic will silently sign the test back in:

```ts
await page.evaluate(() => {
	localStorage.removeItem("tm_token");
	localStorage.removeItem("tm_refresh");
});
```

2. After the Stats navigation (line 36), add an assertion that renders the metrics grid — this is the check that would have caught the `StatCard` crash:

```ts
await page.getByRole("link", { name: "Stats" }).click();
await expect(page.getByText("REPORTS")).toBeVisible();
await expect(page.getByText("Profit Factor")).toBeVisible();
```

- [ ] **Step 2: Run the e2e suite**

Run: `cd web && pnpm e2e` (Go API must be running: `make dev-api` in another shell if not already).
Expected: PASS, including the strengthened Stats assertions and the drawer test.

- [ ] **Step 3: Manual verification drive (per superpowers:verification-before-completion)**

With both dev servers running, drive the real app in a browser:

1. Visit `/reports` — metrics grid renders, no crash.
2. Simulate an expired access token: in devtools run `localStorage.setItem("tm_token", "garbage")`, then navigate between screens — the app must recover silently (refresh) without bouncing to Login.
3. Open a trade, type into Notes, reload the page mid-edit — the draft notice appears with the typed text; Save then clears it (reload again: no notice).
4. Dashboard equity chart — no clipped y-labels, each day appears once on the x-axis.
5. Compare a table date with the New Trade date input — same day/month order.

Expected: all five behaviors confirmed by observation, not inference.

- [ ] **Step 4: Commit**

```bash
cd web && git add e2e/smoke.spec.ts
git commit -m "test(web): e2e covers reports metrics grid; logout clears refresh token

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
