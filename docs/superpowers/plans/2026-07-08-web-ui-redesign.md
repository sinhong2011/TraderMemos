# Web UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the entire TraderMemos web app to the Stonk Journal visual language per `docs/superpowers/specs/2026-07-08-web-ui-redesign-design.md`: layered-slate tokens, new primitives (Pill/StatBar/Drawer/SegmentedControl), sidebar + header shell with account P&L, dashboard with equity band + stats strip + dense trades table, calendar with WEEK summary column, and New Trade / New Setup right-side drawers.

**Architecture:** Restyle in place. Keep TanStack Router routes, `lib/api` layer, hooks, zustand stores, and test suites. Add pure helpers + presentational primitives first (TDD), then drawers, then rework shell and screens on top of them. No backend changes; the New Trade drawer posts to the existing `POST /executions` endpoint and the New Setup drawer to `POST /setups`.

**Tech Stack:** React 19, Vite, Tailwind v4 (utility classes + CSS-variable tokens), TanStack Router/Query/Table/Virtual, Base UI (`@base-ui-components/react` Dialog/Toast), zustand, zod, Recharts, lucide-react, vitest + Testing Library, Playwright.

## Global Constraints

- All work is inside `web/`. **No Go/API changes.** No new npm dependencies.
- Run all commands from `/Volumes/Pie/Sync/Workspace/dev/TraderMemos/web` unless stated otherwise.
- Code style: tabs for indentation, double quotes (biome enforces; run `pnpm lint` before each commit; `pnpm lint --write .` to autofix).
- Styling pattern: CSS-variable tokens in `src/styles.css` consumed via inline `style` props + Tailwind utility classes for layout — match existing files exactly.
- Locale is hardcoded `"en-US"` everywhere (existing convention).
- Dark-only. No theme toggle.
- Dropped from the reference screenshots on purpose (do NOT build): AI Coach, PRO badges, Migrate from V1, Support this platform, New Note, secondary icon "toolbox" rail, trade templates, "Save copies to", Journal/Dividends drawer tabs, "Check compliance", Help nav item (no docs URL exists).
- `components/theme-tokens.ts` (`pnlColor`) and `lib/theme.test.ts` stay unchanged.
- Test commands: `pnpm test` (all), `pnpm test <path>` (single file). Build check: `pnpm build`.

---

### Task 1: Design tokens — layered slate palette

**Files:**
- Modify: `src/styles.css` (the `:root` block, lines 6–39)

**Interfaces:**
- Produces CSS variables consumed by every later task: `--color-surface-base`, `--color-surface-panel`, `--color-surface-raised`, `--color-surface-hover`, `--color-border`, `--color-text`, `--color-text-muted`, `--color-accent`, `--color-accent-subtle`, `--color-pos`, `--color-neg`, `--color-flat`, `--color-amber`, `--tint-pos`, `--tint-neg`, `--tint-accent`, `--tint-amber`, `--radius-control`, `--radius-panel`, `--duration-fast`, `--ease-out`, `--font-ui`, `--font-mono`.

- [ ] **Step 1: Replace the `:root` token block in `src/styles.css`**

Replace the existing `:root { ... }` block (keep everything after it — base reset, reduced motion, skeleton shimmer — untouched):

```css
:root {
	color-scheme: dark;

	/* Surfaces — layered navy slate (dark → light: panel, base, raised, hover) */
	--color-surface-base: #161b26;
	--color-surface-panel: #10141d;
	--color-surface-raised: #1e2430;
	--color-surface-hover: #27303f;
	--color-border: #262e3d;

	/* Text */
	--color-text: #e8ebf1;
	--color-text-muted: #8b93a7;

	/* Accent */
	--color-accent: #6ea8fe;
	--color-accent-subtle: rgba(110, 168, 254, 0.12);

	/* P&L semantic */
	--color-pos: #34d399;
	--color-neg: #f87171;
	--color-flat: #8b93a7;
	--color-amber: #fbbf24;

	/* Tinted fills (pills, banners, calendar cells) */
	--tint-pos: rgba(52, 211, 153, 0.14);
	--tint-neg: rgba(248, 113, 113, 0.14);
	--tint-accent: rgba(110, 168, 254, 0.14);
	--tint-amber: rgba(251, 191, 36, 0.14);

	/* Radius */
	--radius-control: 8px;
	--radius-panel: 12px;

	/* Motion */
	--duration-fast: 150ms;
	--ease-out: cubic-bezier(0.16, 1, 0.3, 1);

	/* Fonts */
	--font-ui: "Geist Variable", system-ui, sans-serif;
	--font-mono: "Geist Mono Variable", "Geist Mono", ui-monospace, monospace;
}
```

- [ ] **Step 2: Run the full unit suite to confirm nothing asserts on token values**

Run: `pnpm test`
Expected: all suites PASS (tests assert on classes/text, not CSS variables).

- [ ] **Step 3: Commit**

```bash
git add src/styles.css
git commit -m "feat(web): layered-slate design tokens for UI redesign"
```

---

### Task 2: Format helpers — fmtDuration, fmtDateShort, fmtRecord

**Files:**
- Modify: `src/lib/format.ts`
- Test: `src/lib/format.test.ts` (append to existing file)

**Interfaces:**
- Produces:
  - `fmtDuration(secs: number | null | undefined): string` → `"39m"`, `"1h"`, `"2d"`, `"-"`
  - `fmtDateShort(iso: string | null): string` → `"7/2/2026"`, `"-"`
  - `fmtRecord(wins: number, losses: number): string` → `"2W1L"`, `"1L"`, `"-"`
- Consumes: nothing new.

- [ ] **Step 1: Append failing tests to `src/lib/format.test.ts`**

```ts
import { fmtDateShort, fmtDuration, fmtRecord } from "./format";

describe("fmtDuration", () => {
	it("formats minutes, hours, days", () => {
		expect(fmtDuration(2340)).toBe("39m");
		expect(fmtDuration(3600)).toBe("1h");
		expect(fmtDuration(7200)).toBe("2h");
		expect(fmtDuration(172800)).toBe("2d");
	});
	it("handles null/zero", () => {
		expect(fmtDuration(null)).toBe("-");
		expect(fmtDuration(0)).toBe("-");
		expect(fmtDuration(30)).toBe("1m");
	});
});

describe("fmtDateShort", () => {
	it("formats M/D/YYYY", () => {
		expect(fmtDateShort("2026-07-02T14:30:00Z")).toMatch(/^7\/[12]\/2026$/);
		expect(fmtDateShort(null)).toBe("-");
	});
});

describe("fmtRecord", () => {
	it("formats win/loss record", () => {
		expect(fmtRecord(2, 1)).toBe("2W1L");
		expect(fmtRecord(0, 1)).toBe("1L");
		expect(fmtRecord(2, 0)).toBe("2W");
		expect(fmtRecord(0, 0)).toBe("-");
	});
});
```

Note: the file already imports `describe/expect/it` from vitest at the top — merge the new import of the three functions into the existing import from `./format`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/lib/format.test.ts`
Expected: FAIL — `fmtDuration is not a function` (or import error).

- [ ] **Step 3: Append implementations to `src/lib/format.ts`**

```ts
export function fmtDuration(secs: number | null | undefined): string {
	if (secs == null || secs <= 0) return "-";
	if (secs < 3600) return `${Math.max(1, Math.round(secs / 60))}m`;
	if (secs < 86400) return `${Math.round(secs / 3600)}h`;
	return `${Math.round(secs / 86400)}d`;
}

export function fmtDateShort(iso: string | null): string {
	if (!iso) return "-";
	const d = new Date(iso);
	return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

export function fmtRecord(wins: number, losses: number): string {
	const parts: string[] = [];
	if (wins > 0) parts.push(`${wins}W`);
	if (losses > 0) parts.push(`${losses}L`);
	return parts.length > 0 ? parts.join("") : "-";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/lib/format.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts src/lib/format.test.ts
git commit -m "feat(web): fmtDuration, fmtDateShort, fmtRecord helpers"
```

---

### Task 3: Primitives — Pill, StatBar, SegmentedControl

**Files:**
- Create: `src/components/Pill.tsx`, `src/components/StatBar.tsx`, `src/components/SegmentedControl.tsx`
- Test: `src/components/Pill.test.tsx`, `src/components/StatBar.test.tsx`, `src/components/SegmentedControl.test.tsx`

**Interfaces:**
- Produces:
  - `type PillTone = "pos" | "neg" | "accent" | "amber" | "muted"` (exported from `Pill.tsx`)
  - `Pill({ tone?: PillTone, children, title? })`
  - `StatBar({ label: string, value: string, right?: string, pct: number, tone: PillTone })` — `pct` is 0..1, clamped
  - `SegmentedControl({ options: { value: string; label: string }[], value: string, onChange: (v: string) => void, ariaLabel?: string })`
- Consumes: Task 1 tokens.

- [ ] **Step 1: Write failing tests**

`src/components/Pill.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Pill } from "./Pill";

describe("Pill", () => {
	it("renders children", () => {
		render(<Pill tone="pos">WIN</Pill>);
		expect(screen.getByText("WIN")).toBeInTheDocument();
	});
	it("defaults to muted tone without crashing", () => {
		render(<Pill>BE</Pill>);
		expect(screen.getByText("BE")).toBeInTheDocument();
	});
});
```

`src/components/StatBar.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatBar } from "./StatBar";

describe("StatBar", () => {
	it("renders label, value and right text", () => {
		render(<StatBar label="WINS" value="2" right="50%" pct={0.5} tone="pos" />);
		expect(screen.getByText(/WINS/)).toBeInTheDocument();
		expect(screen.getByText("2")).toBeInTheDocument();
		expect(screen.getByText("50%")).toBeInTheDocument();
	});
	it("clamps pct into 0..1", () => {
		render(<StatBar label="X" value="1" pct={4} tone="neg" />);
		const fill = screen.getByTestId("statbar-fill");
		expect(fill.style.width).toBe("100%");
	});
});
```

`src/components/SegmentedControl.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SegmentedControl } from "./SegmentedControl";

const OPTIONS = [
	{ value: "30D", label: "30D" },
	{ value: "90D", label: "90D" },
	{ value: "ALL", label: "ALL" },
];

describe("SegmentedControl", () => {
	it("marks the active option and fires onChange", async () => {
		const onChange = vi.fn();
		render(
			<SegmentedControl options={OPTIONS} value="30D" onChange={onChange} />,
		);
		expect(screen.getByRole("button", { name: "30D" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		await userEvent.click(screen.getByRole("button", { name: "ALL" }));
		expect(onChange).toHaveBeenCalledWith("ALL");
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/components/Pill.test.tsx src/components/StatBar.test.tsx src/components/SegmentedControl.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the three components**

`src/components/Pill.tsx`:

```tsx
import type { ReactNode } from "react";

export type PillTone = "pos" | "neg" | "accent" | "amber" | "muted";

const TONES: Record<PillTone, { color: string; bg: string }> = {
	pos: { color: "var(--color-pos)", bg: "var(--tint-pos)" },
	neg: { color: "var(--color-neg)", bg: "var(--tint-neg)" },
	accent: { color: "var(--color-accent)", bg: "var(--tint-accent)" },
	amber: { color: "var(--color-amber)", bg: "var(--tint-amber)" },
	muted: {
		color: "var(--color-text-muted)",
		bg: "var(--color-surface-raised)",
	},
};

export function Pill({
	tone = "muted",
	children,
	title,
}: {
	tone?: PillTone;
	children: ReactNode;
	title?: string;
}) {
	const t = TONES[tone];
	return (
		<span
			title={title}
			style={{
				display: "inline-flex",
				alignItems: "center",
				gap: 4,
				padding: "2px 8px",
				borderRadius: 999,
				fontSize: 11,
				fontWeight: 600,
				letterSpacing: "0.02em",
				color: t.color,
				background: t.bg,
				whiteSpace: "nowrap",
			}}
		>
			{children}
		</span>
	);
}

export const PILL_TONES = TONES;
```

`src/components/StatBar.tsx`:

```tsx
import { PILL_TONES, type PillTone } from "./Pill";

export function StatBar({
	label,
	value,
	right,
	pct,
	tone,
}: {
	label: string;
	value: string;
	right?: string;
	pct: number;
	tone: PillTone;
}) {
	const color = PILL_TONES[tone].color;
	const clamped = Math.max(0, Math.min(1, pct));
	return (
		<div className="flex flex-col gap-1" style={{ minWidth: 110 }}>
			<div className="flex items-baseline justify-between gap-3">
				<span
					className="text-[11px] font-semibold uppercase tracking-wide"
					style={{ color }}
				>
					{label}: <span style={{ color: "var(--color-text)" }}>{value}</span>
				</span>
				{right && (
					<span
						className="text-[11px] tabular-nums"
						style={{ color: "var(--color-text-muted)" }}
					>
						{right}
					</span>
				)}
			</div>
			<div
				style={{
					height: 3,
					borderRadius: 2,
					background: "var(--color-surface-raised)",
				}}
			>
				<div
					data-testid="statbar-fill"
					style={{
						width: `${clamped * 100}%`,
						height: "100%",
						borderRadius: 2,
						background: color,
					}}
				/>
			</div>
		</div>
	);
}
```

`src/components/SegmentedControl.tsx`:

```tsx
export interface SegmentOption {
	value: string;
	label: string;
}

export function SegmentedControl({
	options,
	value,
	onChange,
	ariaLabel,
}: {
	options: SegmentOption[];
	value: string;
	onChange: (v: string) => void;
	ariaLabel?: string;
}) {
	return (
		<div
			role="group"
			aria-label={ariaLabel}
			style={{
				display: "inline-flex",
				gap: 2,
				padding: 2,
				background: "var(--color-surface-raised)",
				borderRadius: "var(--radius-control)",
			}}
		>
			{options.map((o) => {
				const active = o.value === value;
				return (
					<button
						key={o.value}
						type="button"
						aria-pressed={active}
						onClick={() => onChange(o.value)}
						style={{
							padding: "3px 10px",
							fontSize: 11,
							fontWeight: 600,
							border: "none",
							borderRadius: 6,
							cursor: "pointer",
							color: active
								? "var(--color-accent)"
								: "var(--color-text-muted)",
							background: active ? "var(--tint-accent)" : "transparent",
							transition: "color var(--duration-fast)",
						}}
					>
						{o.label}
					</button>
				);
			})}
		</div>
	);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/components/Pill.test.tsx src/components/StatBar.test.tsx src/components/SegmentedControl.test.tsx`
Expected: PASS (3 files).

- [ ] **Step 5: Lint and commit**

```bash
pnpm lint --write .
git add src/components/Pill.tsx src/components/StatBar.tsx src/components/SegmentedControl.tsx src/components/Pill.test.tsx src/components/StatBar.test.tsx src/components/SegmentedControl.test.tsx
git commit -m "feat(web): Pill, StatBar, SegmentedControl primitives"
```

---

### Task 4: UI store + Drawer shell

**Files:**
- Create: `src/lib/ui.ts`, `src/components/Drawer.tsx`
- Test: `src/lib/ui.test.ts`, `src/components/Drawer.test.tsx`

**Interfaces:**
- Produces:
  - `type DrawerKind = "new-trade" | "new-setup"` and zustand store `useUI` with `{ drawer: DrawerKind | null, sidebarCollapsed: boolean, openDrawer(d), closeDrawer(), toggleSidebar() }` (from `src/lib/ui.ts`)
  - `Drawer({ open: boolean, onOpenChange: (open: boolean) => void, title: string, footer?: ReactNode, children })` — right-side slide-over
  - `DrawerBanner({ children })` — blue info banner used at the top of both drawers
- Consumes: Base UI `Dialog` from `@base-ui-components/react`.

- [ ] **Step 1: Write failing tests**

`src/lib/ui.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { useUI } from "./ui";

describe("useUI store", () => {
	it("opens and closes drawers", () => {
		useUI.getState().openDrawer("new-trade");
		expect(useUI.getState().drawer).toBe("new-trade");
		useUI.getState().closeDrawer();
		expect(useUI.getState().drawer).toBeNull();
	});
	it("toggles sidebar", () => {
		const before = useUI.getState().sidebarCollapsed;
		useUI.getState().toggleSidebar();
		expect(useUI.getState().sidebarCollapsed).toBe(!before);
	});
});
```

`src/components/Drawer.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Drawer, DrawerBanner } from "./Drawer";

describe("Drawer", () => {
	it("renders title, children and footer when open", () => {
		render(
			<Drawer
				open
				onOpenChange={vi.fn()}
				title="New Trade"
				footer={<button type="button">Save</button>}
			>
				<DrawerBanner>Log any trade.</DrawerBanner>
				<p>Body</p>
			</Drawer>,
		);
		expect(screen.getByText("New Trade")).toBeInTheDocument();
		expect(screen.getByText("Log any trade.")).toBeInTheDocument();
		expect(screen.getByText("Body")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
	});
	it("renders nothing when closed", () => {
		render(
			<Drawer open={false} onOpenChange={vi.fn()} title="Hidden">
				<p>Body</p>
			</Drawer>,
		);
		expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/lib/ui.test.ts src/components/Drawer.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement store and Drawer**

`src/lib/ui.ts`:

```ts
import { create } from "zustand";

export type DrawerKind = "new-trade" | "new-setup";

interface UIState {
	drawer: DrawerKind | null;
	sidebarCollapsed: boolean;
	openDrawer: (d: DrawerKind) => void;
	closeDrawer: () => void;
	toggleSidebar: () => void;
}

export const useUI = create<UIState>((set) => ({
	drawer: null,
	sidebarCollapsed: false,
	openDrawer: (drawer) => set({ drawer }),
	closeDrawer: () => set({ drawer: null }),
	toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}));
```

`src/components/Drawer.tsx`:

```tsx
import { Dialog } from "@base-ui-components/react";
import { Info, X } from "lucide-react";
import type { ReactNode } from "react";

export function Drawer({
	open,
	onOpenChange,
	title,
	footer,
	children,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	footer?: ReactNode;
	children: ReactNode;
}) {
	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Backdrop
					style={{
						position: "fixed",
						inset: 0,
						background: "rgba(5, 8, 14, 0.6)",
						zIndex: 40,
					}}
				/>
				<Dialog.Popup
					style={{
						position: "fixed",
						top: 0,
						right: 0,
						bottom: 0,
						width: "min(680px, 94vw)",
						background: "var(--color-surface-panel)",
						borderLeft: "1px solid var(--color-border)",
						zIndex: 41,
						display: "flex",
						flexDirection: "column",
						outline: "none",
					}}
				>
					<div
						className="flex items-center justify-between px-5 py-4 shrink-0"
						style={{ borderBottom: "1px solid var(--color-border)" }}
					>
						<Dialog.Title
							style={{
								fontSize: 15,
								fontWeight: 600,
								color: "var(--color-text)",
								margin: 0,
							}}
						>
							{title}
						</Dialog.Title>
						<Dialog.Close
							aria-label="Close"
							style={{
								background: "none",
								border: "none",
								cursor: "pointer",
								color: "var(--color-text-muted)",
								padding: 4,
								display: "flex",
							}}
						>
							<X size={18} strokeWidth={1.5} />
						</Dialog.Close>
					</div>
					<div className="flex-1 overflow-auto p-5 flex flex-col gap-4">
						{children}
					</div>
					{footer && (
						<div
							className="flex items-center justify-end gap-2 px-5 py-3 shrink-0"
							style={{ borderTop: "1px solid var(--color-border)" }}
						>
							{footer}
						</div>
					)}
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	);
}

export function DrawerBanner({ children }: { children: ReactNode }) {
	return (
		<div
			style={{
				display: "flex",
				gap: 10,
				padding: "12px 14px",
				background: "var(--tint-accent)",
				border: "1px solid var(--color-border)",
				borderRadius: "var(--radius-panel)",
				color: "var(--color-text)",
				fontSize: 12,
				lineHeight: 1.5,
			}}
		>
			<Info
				size={16}
				strokeWidth={1.5}
				style={{ color: "var(--color-accent)", flexShrink: 0, marginTop: 2 }}
			/>
			<div>{children}</div>
		</div>
	);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/lib/ui.test.ts src/components/Drawer.test.tsx`
Expected: PASS. If `Dialog.Popup` complains about a missing `Dialog.Description`, add `aria-describedby={undefined}` is NOT needed — Base UI RC does not require a description; if the test fails on portal rendering, check that `src/test/setup.ts` already configures jsdom (it does for Toast tests).

- [ ] **Step 5: Lint and commit**

```bash
pnpm lint --write .
git add src/lib/ui.ts src/lib/ui.test.ts src/components/Drawer.tsx src/components/Drawer.test.tsx
git commit -m "feat(web): UI store and right-side Drawer shell"
```

---

### Task 5: Calendar math — buildDayRecords + weekSummaries

**Files:**
- Modify: `src/lib/calendar.ts`
- Test: `src/lib/calendar.test.ts` (append)

**Interfaces:**
- Consumes: existing `monthGrid(year, month, pnl)` → `MonthGrid { weeks: (DayCell | null)[][], monthTotal }`.
- Produces:
  - `interface DayRecord { wins: number; losses: number }`
  - `buildDayRecords(trades: { closed_at: string | null; net_pnl: number | null }[]): Record<string, DayRecord>` — keyed `"YYYY-MM-DD"` from `closed_at`
  - `interface WeekSummary { pnl: number; wins: number; losses: number; hasData: boolean }`
  - `weekSummaries(weeks: (DayCell | null)[][], pnlRecords: Record<string, DayRecord>): WeekSummary[]` — one entry per grid row

- [ ] **Step 1: Append failing tests to `src/lib/calendar.test.ts`**

```ts
import { buildDayRecords, monthGrid, weekSummaries } from "./calendar";

describe("buildDayRecords", () => {
	it("counts wins and losses per close date", () => {
		const records = buildDayRecords([
			{ closed_at: "2026-07-02T14:00:00Z", net_pnl: 11.39 },
			{ closed_at: "2026-07-02T15:00:00Z", net_pnl: 58.09 },
			{ closed_at: "2026-07-02T16:00:00Z", net_pnl: -111.24 },
			{ closed_at: "2026-07-01T16:00:00Z", net_pnl: -20.03 },
			{ closed_at: null, net_pnl: null },
			{ closed_at: "2026-07-03T16:00:00Z", net_pnl: 0 },
		]);
		expect(records["2026-07-02"]).toEqual({ wins: 2, losses: 1 });
		expect(records["2026-07-01"]).toEqual({ wins: 0, losses: 1 });
		expect(records["2026-07-03"]).toBeUndefined();
	});
});

describe("weekSummaries", () => {
	it("sums pnl and records per grid row", () => {
		const pnl = { "2026-07-01": -20.03, "2026-07-02": -41.76 };
		const grid = monthGrid(2026, 7, pnl);
		const records = buildDayRecords([
			{ closed_at: "2026-07-01T16:00:00Z", net_pnl: -20.03 },
			{ closed_at: "2026-07-02T14:00:00Z", net_pnl: 11.39 },
			{ closed_at: "2026-07-02T15:00:00Z", net_pnl: 58.09 },
			{ closed_at: "2026-07-02T16:00:00Z", net_pnl: -111.24 },
		]);
		const weeks = weekSummaries(grid.weeks, records);
		expect(weeks).toHaveLength(6);
		// July 2026: the 1st and 2nd fall in the first grid row (Wed/Thu).
		expect(weeks[0]).toEqual({
			pnl: -61.79,
			wins: 2,
			losses: 2,
			hasData: true,
		});
		expect(weeks[1]).toEqual({ pnl: 0, wins: 0, losses: 0, hasData: false });
	});
});
```

Note: `monthGrid` is already imported at the top of the test file — merge imports.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/lib/calendar.test.ts`
Expected: FAIL — `buildDayRecords is not a function`.

- [ ] **Step 3: Append implementations to `src/lib/calendar.ts`**

```ts
export interface DayRecord {
	wins: number;
	losses: number;
}

// Derives per-day win/loss counts from closed trades, keyed "YYYY-MM-DD".
export function buildDayRecords(
	trades: { closed_at: string | null; net_pnl: number | null }[],
): Record<string, DayRecord> {
	const out: Record<string, DayRecord> = {};
	for (const t of trades) {
		if (!t.closed_at || t.net_pnl == null || t.net_pnl === 0) continue;
		const date = t.closed_at.slice(0, 10);
		const rec = (out[date] ??= { wins: 0, losses: 0 });
		if (t.net_pnl > 0) rec.wins++;
		else rec.losses++;
	}
	return out;
}

export interface WeekSummary {
	pnl: number;
	wins: number;
	losses: number;
	hasData: boolean;
}

// One summary per grid row: summed P&L and win/loss record for the week.
export function weekSummaries(
	weeks: (DayCell | null)[][],
	records: Record<string, DayRecord>,
): WeekSummary[] {
	return weeks.map((week) => {
		let pnl = 0;
		let wins = 0;
		let losses = 0;
		let hasData = false;
		for (const cell of week) {
			if (!cell) continue;
			if (cell.pnl != null) {
				pnl += cell.pnl;
				hasData = true;
			}
			const rec = records[cell.date];
			if (rec) {
				wins += rec.wins;
				losses += rec.losses;
			}
		}
		return { pnl: Math.round(pnl * 100) / 100, wins, losses, hasData };
	});
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/lib/calendar.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calendar.ts src/lib/calendar.test.ts
git commit -m "feat(web): day records and week summaries for calendar"
```

---

### Task 6: Executions API client + useCreateExecutions

**Files:**
- Create: `src/lib/api/executions.ts`, `src/lib/hooks/useExecutions.ts`
- Test: `src/lib/hooks/useExecutions.test.tsx`

**Interfaces:**
- Consumes: `apiFetch` from `src/lib/api/client.ts`. Backend contract (`POST /executions`, from `api/internal/api/execution_handlers.go`): JSON body `{ account_id, symbol, instrument_type, side: "buy"|"sell", quantity, price, fees, executed_at (RFC3339) }`; server regroups trades after insert; returns 201 with no body.
- Produces:
  - `interface ExecutionBody { account_id: string; symbol: string; instrument_type: string; side: "buy" | "sell"; quantity: number; price: number; fees: number; executed_at: string }`
  - `executionsApi.create(body: ExecutionBody): Promise<void>`
  - `interface ExecutionFailure { index: number; message: string }`
  - `class ExecutionBatchError extends Error { failures: ExecutionFailure[]; total: number }`
  - `useCreateExecutions()` — react-query mutation taking `ExecutionBody[]`, posting sequentially; throws `ExecutionBatchError` if any row fails; invalidates `["trades"]` and `["analytics"]` on settle.

- [ ] **Step 1: Write failing test `src/lib/hooks/useExecutions.test.tsx`**

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { executionsApi } from "../api/executions";
import { ExecutionBatchError, useCreateExecutions } from "./useExecutions";

vi.mock("../api/executions", () => ({
	executionsApi: { create: vi.fn() },
}));

const mockedCreate = vi.mocked(executionsApi.create);

function wrapper({ children }: { children: ReactNode }) {
	const qc = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const ROW = {
	account_id: "a1",
	symbol: "AAPL",
	instrument_type: "stock",
	side: "buy" as const,
	quantity: 10,
	price: 100,
	fees: 1,
	executed_at: "2026-07-08T13:30:00.000Z",
};

describe("useCreateExecutions", () => {
	beforeEach(() => mockedCreate.mockReset());

	it("posts all rows sequentially and resolves with the count", async () => {
		mockedCreate.mockResolvedValue(undefined);
		const { result } = renderHook(() => useCreateExecutions(), { wrapper });
		const count = await result.current.mutateAsync([ROW, ROW]);
		expect(count).toBe(2);
		expect(mockedCreate).toHaveBeenCalledTimes(2);
	});

	it("throws ExecutionBatchError listing failed row indexes", async () => {
		mockedCreate
			.mockResolvedValueOnce(undefined)
			.mockRejectedValueOnce(new Error("boom"));
		const { result } = renderHook(() => useCreateExecutions(), { wrapper });
		await expect(result.current.mutateAsync([ROW, ROW])).rejects.toThrow(
			ExecutionBatchError,
		);
		await waitFor(() => expect(result.current.isError).toBe(true));
		const err = result.current.error as ExecutionBatchError;
		expect(err.failures).toEqual([{ index: 1, message: "boom" }]);
		expect(err.total).toBe(2);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/hooks/useExecutions.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement API client and hook**

`src/lib/api/executions.ts`:

```ts
import { apiFetch } from "./client";

export interface ExecutionBody {
	account_id: string;
	symbol: string;
	instrument_type: string;
	side: "buy" | "sell";
	quantity: number;
	price: number;
	fees: number;
	executed_at: string;
}

export const executionsApi = {
	create: (body: ExecutionBody) =>
		apiFetch<void>("/executions", {
			method: "POST",
			body: JSON.stringify(body),
		}),
};
```

`src/lib/hooks/useExecutions.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type ExecutionBody, executionsApi } from "../api/executions";

export interface ExecutionFailure {
	index: number;
	message: string;
}

export class ExecutionBatchError extends Error {
	failures: ExecutionFailure[];
	total: number;
	constructor(failures: ExecutionFailure[], total: number) {
		super(`${failures.length} of ${total} executions failed`);
		this.name = "ExecutionBatchError";
		this.failures = failures;
		this.total = total;
	}
}

// Posts executions one-by-one so a single bad row doesn't sink the batch;
// the server regroups trades after each insert.
export function useCreateExecutions() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (rows: ExecutionBody[]) => {
			const failures: ExecutionFailure[] = [];
			for (let i = 0; i < rows.length; i++) {
				try {
					await executionsApi.create(rows[i]);
				} catch (e) {
					failures.push({
						index: i,
						message: e instanceof Error ? e.message : "request failed",
					});
				}
			}
			if (failures.length > 0) {
				throw new ExecutionBatchError(failures, rows.length);
			}
			return rows.length;
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ["trades"] });
			queryClient.invalidateQueries({ queryKey: ["analytics"] });
		},
	});
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/hooks/useExecutions.test.tsx`
Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
pnpm lint --write .
git add src/lib/api/executions.ts src/lib/hooks/useExecutions.ts src/lib/hooks/useExecutions.test.tsx
git commit -m "feat(web): executions API client and batch-create hook"
```

---

### Task 7: Header stats helper

**Files:**
- Create: `src/lib/headerStats.ts`
- Test: `src/lib/headerStats.test.ts`

**Interfaces:**
- Consumes: `Account`, `CashTransaction`, `Summary`, `Trade` types from `src/lib/api/types.ts`.
- Produces:
  - `interface HeaderStats { netPnl: number; cash: number; active: number }`
  - `computeHeaderStats(opts: { accounts: Account[]; accountId?: string; cashTx: CashTransaction[]; summary?: Summary; trades: Trade[] }): HeaderStats`
  - Semantics: `netPnl` = `summary.net_pnl` (0 if absent). `cash` = sum of `starting_balance` over selected account (or all accounts when none selected) + sum of cash-transaction `amount`s + `netPnl`. `active` = Σ `qty_opened * avg_entry_price` over trades with `status === "open"`.

- [ ] **Step 1: Write failing test `src/lib/headerStats.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import type { Account, Summary, Trade } from "./api/types";
import { computeHeaderStats } from "./headerStats";

const acct = (id: string, starting: number) =>
	({ id, starting_balance: starting, base_currency: "USD" }) as Account;
const summary = (netPnl: number) => ({ net_pnl: netPnl }) as Summary;
const openTrade = (qty: number, entry: number) =>
	({ status: "open", qty_opened: qty, avg_entry_price: entry }) as Trade;
const closedTrade = () =>
	({ status: "closed", qty_opened: 5, avg_entry_price: 10 }) as Trade;

describe("computeHeaderStats", () => {
	it("computes cash from starting balance, cash flow and pnl", () => {
		const s = computeHeaderStats({
			accounts: [acct("a1", 1000)],
			accountId: "a1",
			cashTx: [{ amount: 500 }, { amount: -200 }] as never,
			summary: summary(-61.79),
			trades: [],
		});
		expect(s.netPnl).toBeCloseTo(-61.79);
		expect(s.cash).toBeCloseTo(1238.21);
		expect(s.active).toBe(0);
	});

	it("sums all accounts when none selected and open trade value", () => {
		const s = computeHeaderStats({
			accounts: [acct("a1", 1000), acct("a2", 2000)],
			cashTx: [],
			summary: undefined,
			trades: [openTrade(10, 5), closedTrade()],
		});
		expect(s.cash).toBe(3000);
		expect(s.active).toBe(50);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/headerStats.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/headerStats.ts`**

```ts
import type { Account, CashTransaction, Summary, Trade } from "./api/types";

export interface HeaderStats {
	netPnl: number;
	cash: number;
	active: number;
}

// Header account block: net P&L for the current filter scope, an estimated
// cash balance (starting balances + cash flow + realized P&L), and the entry
// value of open positions ("Active").
export function computeHeaderStats(opts: {
	accounts: Account[];
	accountId?: string;
	cashTx: CashTransaction[];
	summary?: Summary;
	trades: Trade[];
}): HeaderStats {
	const accounts = opts.accountId
		? opts.accounts.filter((a) => a.id === opts.accountId)
		: opts.accounts;
	const starting = accounts.reduce((s, a) => s + a.starting_balance, 0);
	const cashFlow = opts.cashTx.reduce((s, c) => s + c.amount, 0);
	const netPnl = opts.summary?.net_pnl ?? 0;
	const active = opts.trades
		.filter((t) => t.status === "open")
		.reduce((s, t) => s + t.qty_opened * t.avg_entry_price, 0);
	return { netPnl, cash: starting + cashFlow + netPnl, active };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/headerStats.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/headerStats.ts src/lib/headerStats.test.ts
git commit -m "feat(web): header account stats helper"
```

---

### Task 8: Shared trade table columns

**Files:**
- Create: `src/components/tradeColumns.tsx`
- Test: `src/components/tradeColumns.test.tsx`

**Interfaces:**
- Consumes: `Pill`/`PillTone` (Task 3), `fmtDateShort`/`fmtDuration`/`fmtMoney`/`fmtSignedMoney` (Task 2), `pnlColor` from `theme-tokens`, `Trade` type.
- Produces:
  - `marketLabel(instrumentType: string): string` — `stock→"STK"`, `option→"OPT"`, `crypto→"CRY"`, `futures→"FUT"`, `forex→"FX"`, else first 3 chars uppercased
  - `tradeStatus(t: Trade): { label: "WIN" | "LOSS" | "OPEN" | "BE"; tone: PillTone }`
  - `tradeColumns(currency: string, onView: (t: Trade) => void): ColumnDef<Trade>[]` — columns: DATE, SYMBOL, STATUS, DIR, MARKET, QTY, ENTRY, EXIT, ENT TOT, EXT TOT, HOLD, RETURN, RETURN %, actions.

- [ ] **Step 1: Write failing test `src/components/tradeColumns.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Trade } from "../lib/api/types";
import { DataTable } from "./DataTable";
import { marketLabel, tradeColumns, tradeStatus } from "./tradeColumns";

const TRADE: Trade = {
	id: "t1",
	account_id: "a1",
	symbol: "TSLQ",
	instrument_type: "stock",
	direction: "long",
	status: "closed",
	opened_at: "2026-07-02T13:00:00Z",
	closed_at: "2026-07-02T13:39:00Z",
	qty_opened: 80,
	avg_entry_price: 18.02,
	avg_exit_price: 18.23,
	gross_pnl: 16.8,
	fees_total: 5.41,
	net_pnl: 11.39,
	pnl_currency: "USD",
	return_pct: 0.79,
	time_in_trade_secs: 2340,
	notes: "",
	tags: [],
};

describe("tradeStatus", () => {
	it("maps trades to status pills", () => {
		expect(tradeStatus(TRADE)).toEqual({ label: "WIN", tone: "pos" });
		expect(tradeStatus({ ...TRADE, net_pnl: -5 })).toEqual({
			label: "LOSS",
			tone: "neg",
		});
		expect(tradeStatus({ ...TRADE, status: "open", net_pnl: null })).toEqual({
			label: "OPEN",
			tone: "accent",
		});
		expect(tradeStatus({ ...TRADE, net_pnl: 0 })).toEqual({
			label: "BE",
			tone: "muted",
		});
	});
});

describe("marketLabel", () => {
	it("maps instrument types", () => {
		expect(marketLabel("stock")).toBe("STK");
		expect(marketLabel("option")).toBe("OPT");
		expect(marketLabel("warrant")).toBe("WAR");
	});
});

describe("tradeColumns", () => {
	it("renders a full trade row", () => {
		render(
			<DataTable columns={tradeColumns("USD", vi.fn())} data={[TRADE]} />,
		);
		expect(screen.getByText("TSLQ")).toBeInTheDocument();
		expect(screen.getByText("WIN")).toBeInTheDocument();
		expect(screen.getByText("STK")).toBeInTheDocument();
		expect(screen.getByText("39m")).toBeInTheDocument();
		expect(screen.getByText("+$11.39")).toBeInTheDocument();
		expect(screen.getByText("0.79%")).toBeInTheDocument();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/components/tradeColumns.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/components/tradeColumns.tsx`**

```tsx
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowDownRight, ArrowUpRight, MoreHorizontal } from "lucide-react";
import type { Trade } from "../lib/api/types";
import {
	fmtDateShort,
	fmtDuration,
	fmtMoney,
	fmtSignedMoney,
} from "../lib/format";
import { Pill, type PillTone } from "./Pill";
import { pnlColor } from "./theme-tokens";

const LOCALE = "en-US";

const MARKET_LABELS: Record<string, string> = {
	stock: "STK",
	option: "OPT",
	crypto: "CRY",
	futures: "FUT",
	forex: "FX",
};

export function marketLabel(instrumentType: string): string {
	return (
		MARKET_LABELS[instrumentType] ?? instrumentType.slice(0, 3).toUpperCase()
	);
}

export function tradeStatus(t: Trade): {
	label: "WIN" | "LOSS" | "OPEN" | "BE";
	tone: PillTone;
} {
	if (t.status === "open") return { label: "OPEN", tone: "accent" };
	if (t.net_pnl != null && t.net_pnl > 0) return { label: "WIN", tone: "pos" };
	if (t.net_pnl != null && t.net_pnl < 0)
		return { label: "LOSS", tone: "neg" };
	return { label: "BE", tone: "muted" };
}

function muted(v: string) {
	return <span style={{ color: "var(--color-text-muted)" }}>{v}</span>;
}

function money(v: number | null, currency: string) {
	if (v == null) return muted("-");
	return <span className="tabular-nums">{fmtMoney(v, currency, LOCALE)}</span>;
}

export function tradeColumns(
	currency: string,
	onView: (t: Trade) => void,
): ColumnDef<Trade>[] {
	return [
		{
			accessorKey: "opened_at",
			header: "DATE",
			cell: (i) => muted(fmtDateShort(i.getValue<string>())),
		},
		{
			accessorKey: "symbol",
			header: "SYMBOL",
			cell: (i) => (
				<span style={{ color: "var(--color-accent)", fontWeight: 600 }}>
					{i.getValue<string>()}
				</span>
			),
		},
		{
			id: "status",
			header: "STATUS",
			cell: (i) => {
				const s = tradeStatus(i.row.original);
				return <Pill tone={s.tone}>{s.label}</Pill>;
			},
		},
		{
			accessorKey: "direction",
			header: "DIR",
			cell: (i) =>
				i.getValue<string>() === "long" ? (
					<ArrowUpRight
						size={14}
						strokeWidth={2}
						style={{ color: "var(--color-pos)" }}
						aria-label="long"
					/>
				) : (
					<ArrowDownRight
						size={14}
						strokeWidth={2}
						style={{ color: "var(--color-neg)" }}
						aria-label="short"
					/>
				),
		},
		{
			accessorKey: "instrument_type",
			header: "MARKET",
			cell: (i) => (
				<Pill tone="muted">{marketLabel(i.getValue<string>())}</Pill>
			),
		},
		{
			accessorKey: "qty_opened",
			header: "QTY",
			cell: (i) => (
				<span className="tabular-nums">
					{i.getValue<number>().toFixed(2)}
				</span>
			),
		},
		{
			accessorKey: "avg_entry_price",
			header: "ENTRY",
			cell: (i) => money(i.getValue<number>(), currency),
		},
		{
			accessorKey: "avg_exit_price",
			header: "EXIT",
			cell: (i) => money(i.getValue<number | null>(), currency),
		},
		{
			id: "ent_tot",
			header: "ENT TOT",
			cell: (i) => {
				const t = i.row.original;
				return money(t.qty_opened * t.avg_entry_price, currency);
			},
		},
		{
			id: "ext_tot",
			header: "EXT TOT",
			cell: (i) => {
				const t = i.row.original;
				return t.avg_exit_price == null
					? muted("-")
					: money(t.qty_opened * t.avg_exit_price, currency);
			},
		},
		{
			accessorKey: "time_in_trade_secs",
			header: "HOLD",
			cell: (i) => {
				const v = i.getValue<number | null>();
				return v == null || v <= 0 ? (
					muted("-")
				) : (
					<Pill tone="accent">{fmtDuration(v)}</Pill>
				);
			},
		},
		{
			accessorKey: "net_pnl",
			header: "RETURN",
			cell: (i) => {
				const v = i.getValue<number | null>();
				if (v == null) return muted("-");
				return (
					<span className={`tabular-nums font-semibold ${pnlColor(v)}`}>
						{fmtSignedMoney(v, currency, LOCALE)}
					</span>
				);
			},
		},
		{
			accessorKey: "return_pct",
			header: "RETURN %",
			cell: (i) => {
				const v = i.getValue<number | null>();
				if (v == null) return muted("-");
				return (
					<span className={`tabular-nums ${pnlColor(v)}`}>
						{v.toFixed(2)}%
					</span>
				);
			},
		},
		{
			id: "actions",
			header: "",
			enableSorting: false,
			cell: (i) => (
				<button
					type="button"
					aria-label={`View ${i.row.original.symbol}`}
					onClick={(e) => {
						e.stopPropagation();
						onView(i.row.original);
					}}
					style={{
						background: "none",
						border: "none",
						cursor: "pointer",
						color: "var(--color-text-muted)",
						padding: 2,
						display: "flex",
					}}
				>
					<MoreHorizontal size={14} strokeWidth={1.5} />
				</button>
			),
		},
	];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/components/tradeColumns.test.tsx`
Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
pnpm lint --write .
git add src/components/tradeColumns.tsx src/components/tradeColumns.test.tsx
git commit -m "feat(web): shared reference-style trade table columns"
```

---

### Task 9: New Trade drawer

**Files:**
- Create: `src/app/drawers/NewTradeDrawer.tsx`
- Test: `src/app/drawers/NewTradeDrawer.test.tsx`

**Interfaces:**
- Consumes: `Drawer`/`DrawerBanner` (Task 4), `SegmentedControl` (Task 3), `useUI` (Task 4), `useCreateExecutions`/`ExecutionBatchError` (Task 6), `useAccounts` from `src/lib/hooks/useAccounts.ts`, `useFilters` from `src/lib/filters.ts`, `useToastManager` from `src/components/Toast.tsx`, zod.
- Produces: `NewTradeDrawer()` — self-contained component reading `useUI(s => s.drawer === "new-trade")`; mounted once in `AppShell` (Task 11).

- [ ] **Step 1: Write failing test `src/app/drawers/NewTradeDrawer.test.tsx`**

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { executionsApi } from "../../lib/api/executions";
import { useUI } from "../../lib/ui";
import { NewTradeDrawer } from "./NewTradeDrawer";

vi.mock("../../lib/api/executions", () => ({
	executionsApi: { create: vi.fn() },
}));
vi.mock("../../lib/hooks/useAccounts", () => ({
	useAccounts: () => ({
		data: [
			{ id: "a1", name: "Default", base_currency: "USD" },
			{ id: "a2", name: "Swing", base_currency: "USD" },
		],
	}),
}));
vi.mock("../../components/Toast", () => ({
	useToastManager: () => ({ add: vi.fn() }),
}));

const mockedCreate = vi.mocked(executionsApi.create);

function wrap(ui: ReactNode) {
	const qc = new QueryClient({
		defaultOptions: { mutations: { retry: false } },
	});
	return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("NewTradeDrawer", () => {
	beforeEach(() => {
		mockedCreate.mockReset();
		useUI.getState().openDrawer("new-trade");
	});

	it("renders form fields when open", () => {
		wrap(<NewTradeDrawer />);
		expect(screen.getByText("New Trade")).toBeInTheDocument();
		expect(screen.getByLabelText("Symbol")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
	});

	it("shows a validation error instead of submitting an empty symbol", async () => {
		wrap(<NewTradeDrawer />);
		await userEvent.click(screen.getByRole("button", { name: "Save" }));
		expect(await screen.findByText(/symbol is required/i)).toBeVisible();
		expect(mockedCreate).not.toHaveBeenCalled();
	});

	it("submits a valid row and closes", async () => {
		mockedCreate.mockResolvedValue(undefined);
		wrap(<NewTradeDrawer />);
		await userEvent.type(screen.getByLabelText("Symbol"), "AAPL");
		await userEvent.type(screen.getByLabelText("Qty row 1"), "10");
		await userEvent.type(screen.getByLabelText("Price row 1"), "185.5");
		await userEvent.click(screen.getByRole("button", { name: "Save" }));
		await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
		expect(mockedCreate.mock.calls[0][0]).toMatchObject({
			account_id: "a1",
			symbol: "AAPL",
			side: "buy",
			quantity: 10,
			price: 185.5,
		});
		await waitFor(() => expect(useUI.getState().drawer).toBeNull());
	});

	it("keeps the form open and reports failed rows on partial failure", async () => {
		mockedCreate.mockRejectedValueOnce(new Error("boom"));
		wrap(<NewTradeDrawer />);
		await userEvent.type(screen.getByLabelText("Symbol"), "AAPL");
		await userEvent.type(screen.getByLabelText("Qty row 1"), "10");
		await userEvent.type(screen.getByLabelText("Price row 1"), "185.5");
		await userEvent.click(screen.getByRole("button", { name: "Save" }));
		expect(await screen.findByText(/execution 1 failed/i)).toBeVisible();
		expect(useUI.getState().drawer).toBe("new-trade");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/app/drawers/NewTradeDrawer.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/app/drawers/NewTradeDrawer.tsx`**

```tsx
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { Drawer, DrawerBanner } from "../../components/Drawer";
import { SegmentedControl } from "../../components/SegmentedControl";
import { useToastManager } from "../../components/Toast";
import { useFilters } from "../../lib/filters";
import { useAccounts } from "../../lib/hooks/useAccounts";
import {
	ExecutionBatchError,
	useCreateExecutions,
} from "../../lib/hooks/useExecutions";
import { useUI } from "../../lib/ui";

const MARKETS = [
	{ value: "stock", label: "Stock" },
	{ value: "option", label: "Option" },
	{ value: "crypto", label: "Crypto" },
	{ value: "futures", label: "Futures" },
	{ value: "forex", label: "Forex" },
];

interface Row {
	side: "buy" | "sell";
	executed_at: string; // datetime-local value
	quantity: string;
	price: string;
	fees: string;
}

const rowSchema = z.object({
	side: z.enum(["buy", "sell"]),
	executed_at: z.string().min(1, "date/time is required"),
	quantity: z.coerce.number().positive("qty must be > 0"),
	price: z.coerce.number().positive("price must be > 0"),
	fees: z.coerce.number().min(0, "fee must be >= 0"),
});

const formSchema = z.object({
	account_id: z.string().min(1, "account is required"),
	symbol: z.string().trim().min(1, "symbol is required"),
	instrument_type: z.string().min(1),
	rows: z.array(rowSchema).min(1),
});

function nowLocal(): string {
	const d = new Date();
	d.setSeconds(0, 0);
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function emptyRow(side: "buy" | "sell"): Row {
	return { side, executed_at: nowLocal(), quantity: "", price: "", fees: "" };
}

const inputStyle: React.CSSProperties = {
	background: "var(--color-surface-raised)",
	color: "var(--color-text)",
	border: "1px solid var(--color-border)",
	borderRadius: "var(--radius-control)",
	padding: "7px 10px",
	fontSize: 13,
	fontFamily: "var(--font-ui)",
	outline: "none",
	width: "100%",
};

const labelStyle: React.CSSProperties = {
	fontSize: 11,
	fontWeight: 600,
	textTransform: "uppercase",
	letterSpacing: "0.04em",
	color: "var(--color-text-muted)",
};

export function NewTradeDrawer() {
	const open = useUI((s) => s.drawer === "new-trade");
	const closeDrawer = useUI((s) => s.closeDrawer);
	const filterAccountId = useFilters((s) => s.accountId);
	const accounts = useAccounts().data ?? [];
	const toast = useToastManager();
	const createExecutions = useCreateExecutions();

	const [accountId, setAccountId] = useState("");
	const [market, setMarket] = useState("stock");
	const [symbol, setSymbol] = useState("");
	const [side, setSide] = useState<"long" | "short">("long");
	const [rows, setRows] = useState<Row[]>([emptyRow("buy")]);
	const [error, setError] = useState("");

	const effectiveAccountId =
		accountId || filterAccountId || accounts[0]?.id || "";

	function reset() {
		setAccountId("");
		setMarket("stock");
		setSymbol("");
		setSide("long");
		setRows([emptyRow("buy")]);
		setError("");
	}

	function close() {
		reset();
		closeDrawer();
	}

	function updateRow(i: number, patch: Partial<Row>) {
		setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
	}

	async function save() {
		setError("");
		const parsed = formSchema.safeParse({
			account_id: effectiveAccountId,
			symbol,
			instrument_type: market,
			rows,
		});
		if (!parsed.success) {
			setError(parsed.error.issues[0].message);
			return;
		}
		const bodies = parsed.data.rows.map((r) => ({
			account_id: parsed.data.account_id,
			symbol: parsed.data.symbol.toUpperCase(),
			instrument_type: parsed.data.instrument_type,
			side: r.side,
			quantity: r.quantity,
			price: r.price,
			fees: r.fees,
			executed_at: new Date(r.executed_at).toISOString(),
		}));
		try {
			await createExecutions.mutateAsync(bodies);
			toast.add({
				title: "Trade logged",
				description: `${bodies.length} execution(s) saved for ${bodies[0].symbol}.`,
			});
			close();
		} catch (e) {
			if (e instanceof ExecutionBatchError) {
				// Keep only the failed rows in the form so a retry is targeted.
				const failedIdx = new Set(e.failures.map((f) => f.index));
				setRows((rs) => rs.filter((_, i) => failedIdx.has(i)));
				setError(
					e.failures
						.map((f) => `Execution ${f.index + 1} failed: ${f.message}`)
						.join("; "),
				);
			} else {
				setError(e instanceof Error ? e.message : "Save failed");
			}
		}
	}

	const footer = (
		<>
			<button
				type="button"
				onClick={close}
				style={{
					background: "var(--color-surface-raised)",
					color: "var(--color-text)",
					border: "1px solid var(--color-border)",
					borderRadius: "var(--radius-control)",
					padding: "7px 14px",
					fontSize: 13,
					cursor: "pointer",
				}}
			>
				Cancel
			</button>
			<button
				type="button"
				onClick={save}
				disabled={createExecutions.isPending}
				style={{
					background: "var(--color-accent)",
					color: "#0e1218",
					border: "none",
					borderRadius: "var(--radius-control)",
					padding: "7px 16px",
					fontSize: 13,
					fontWeight: 600,
					cursor: createExecutions.isPending ? "default" : "pointer",
					opacity: createExecutions.isPending ? 0.6 : 1,
				}}
			>
				Save
			</button>
		</>
	);

	return (
		<Drawer
			open={open}
			onOpenChange={(o) => {
				if (!o) close();
			}}
			title="New Trade"
			footer={footer}
		>
			<DrawerBanner>
				Log any trade you've entered — still open, partially exited, or fully
				closed. Add buy/sell executions; the journal groups them into a trade
				automatically.
			</DrawerBanner>

			<div className="grid grid-cols-2 gap-3">
				<div className="flex flex-col gap-1">
					<label htmlFor="nt-account" style={labelStyle}>
						Account
					</label>
					<select
						id="nt-account"
						value={effectiveAccountId}
						onChange={(e) => setAccountId(e.target.value)}
						style={inputStyle}
					>
						{accounts.map((a) => (
							<option key={a.id} value={a.id}>
								{a.name}
							</option>
						))}
					</select>
				</div>
				<div className="flex flex-col gap-1">
					<label htmlFor="nt-market" style={labelStyle}>
						Market
					</label>
					<select
						id="nt-market"
						value={market}
						onChange={(e) => setMarket(e.target.value)}
						style={inputStyle}
					>
						{MARKETS.map((m) => (
							<option key={m.value} value={m.value}>
								{m.label}
							</option>
						))}
					</select>
				</div>
			</div>

			<div className="grid grid-cols-2 gap-3">
				<div className="flex flex-col gap-1">
					<label htmlFor="nt-symbol" style={labelStyle}>
						Symbol
					</label>
					<input
						id="nt-symbol"
						aria-label="Symbol"
						value={symbol}
						onChange={(e) => setSymbol(e.target.value.toUpperCase())}
						placeholder="e.g. AAPL"
						style={inputStyle}
					/>
				</div>
				<div className="flex flex-col gap-1">
					<span style={labelStyle}>Side</span>
					<SegmentedControl
						ariaLabel="Side"
						options={[
							{ value: "long", label: "↗ LONG" },
							{ value: "short", label: "↘ SHORT" },
						]}
						value={side}
						onChange={(v) => setSide(v as "long" | "short")}
					/>
				</div>
			</div>

			<div className="flex flex-col gap-2">
				<div
					className="grid gap-2"
					style={{
						gridTemplateColumns: "72px 1fr 90px 100px 90px 28px",
						...labelStyle,
					}}
				>
					<span>Action</span>
					<span>Date / Time</span>
					<span>Qty</span>
					<span>Price</span>
					<span>Fee</span>
					<span />
				</div>
				{rows.map((row, i) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
						key={i}
						className="grid gap-2 items-center"
						style={{ gridTemplateColumns: "72px 1fr 90px 100px 90px 28px" }}
					>
						<button
							type="button"
							aria-label={`Toggle action row ${i + 1}`}
							onClick={() =>
								updateRow(i, { side: row.side === "buy" ? "sell" : "buy" })
							}
							style={{
								padding: "5px 0",
								fontSize: 11,
								fontWeight: 700,
								border: "none",
								borderRadius: 999,
								cursor: "pointer",
								color:
									row.side === "buy"
										? "var(--color-pos)"
										: "var(--color-neg)",
								background:
									row.side === "buy" ? "var(--tint-pos)" : "var(--tint-neg)",
							}}
						>
							{row.side.toUpperCase()}
						</button>
						<input
							type="datetime-local"
							aria-label={`Date/time row ${i + 1}`}
							value={row.executed_at}
							onChange={(e) => updateRow(i, { executed_at: e.target.value })}
							style={inputStyle}
						/>
						<input
							inputMode="decimal"
							aria-label={`Qty row ${i + 1}`}
							placeholder="Qty"
							value={row.quantity}
							onChange={(e) => updateRow(i, { quantity: e.target.value })}
							style={inputStyle}
						/>
						<input
							inputMode="decimal"
							aria-label={`Price row ${i + 1}`}
							placeholder="Price"
							value={row.price}
							onChange={(e) => updateRow(i, { price: e.target.value })}
							style={inputStyle}
						/>
						<input
							inputMode="decimal"
							aria-label={`Fee row ${i + 1}`}
							placeholder="Fee"
							value={row.fees}
							onChange={(e) => updateRow(i, { fees: e.target.value })}
							style={inputStyle}
						/>
						<button
							type="button"
							aria-label={`Remove row ${i + 1}`}
							disabled={rows.length === 1}
							onClick={() =>
								setRows((rs) => rs.filter((_, j) => j !== i))
							}
							style={{
								background: "none",
								border: "none",
								cursor: rows.length === 1 ? "default" : "pointer",
								color: "var(--color-text-muted)",
								opacity: rows.length === 1 ? 0.4 : 1,
								display: "flex",
							}}
						>
							<X size={14} strokeWidth={1.5} />
						</button>
					</div>
				))}
				<button
					type="button"
					aria-label="Add execution row"
					onClick={() =>
						setRows((rs) => [
							...rs,
							emptyRow(side === "long" ? "buy" : "sell"),
						])
					}
					style={{
						alignSelf: "center",
						width: 32,
						height: 32,
						borderRadius: 999,
						border: "none",
						background: "var(--color-accent)",
						color: "#0e1218",
						cursor: "pointer",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						marginTop: 4,
					}}
				>
					<Plus size={16} strokeWidth={2} />
				</button>
			</div>

			{error && (
				<p className="text-xs" style={{ color: "var(--color-neg)" }}>
					{error}
				</p>
			)}
		</Drawer>
	);
}
```

Note: the fees field defaults to empty string; `z.coerce.number()` turns `""` into `0`, which is the desired default.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/app/drawers/NewTradeDrawer.test.tsx`
Expected: PASS (4 tests). If the empty-fees coercion fails validation, change the `fees` schema line to `fees: z.coerce.number().min(0).catch(0),`.

- [ ] **Step 5: Lint and commit**

```bash
pnpm lint --write .
git add src/app/drawers/NewTradeDrawer.tsx src/app/drawers/NewTradeDrawer.test.tsx
git commit -m "feat(web): New Trade drawer backed by executions API"
```

---

### Task 10: New Setup drawer

**Files:**
- Create: `src/app/drawers/NewSetupDrawer.tsx`
- Test: `src/app/drawers/NewSetupDrawer.test.tsx`

**Interfaces:**
- Consumes: `Drawer`/`DrawerBanner`, `useUI`, `useCreateSetup` from `src/lib/hooks/useSetups.ts` (posts `{ name, description? }`), `useToastManager`.
- Produces: `NewSetupDrawer()` — mounted once in `AppShell` (Task 11).

- [ ] **Step 1: Write failing test `src/app/drawers/NewSetupDrawer.test.tsx`**

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setupsApi } from "../../lib/api/setups";
import { useUI } from "../../lib/ui";
import { NewSetupDrawer } from "./NewSetupDrawer";

vi.mock("../../lib/api/setups", () => ({
	setupsApi: { create: vi.fn() },
}));
vi.mock("../../components/Toast", () => ({
	useToastManager: () => ({ add: vi.fn() }),
}));

const mockedCreate = vi.mocked(setupsApi.create);

function wrap(ui: ReactNode) {
	const qc = new QueryClient({
		defaultOptions: { mutations: { retry: false } },
	});
	return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("NewSetupDrawer", () => {
	beforeEach(() => {
		mockedCreate.mockReset();
		useUI.getState().openDrawer("new-setup");
	});

	it("validates the name", async () => {
		wrap(<NewSetupDrawer />);
		await userEvent.click(screen.getByRole("button", { name: "Save" }));
		expect(await screen.findByText(/name is required/i)).toBeVisible();
		expect(mockedCreate).not.toHaveBeenCalled();
	});

	it("creates a setup and closes", async () => {
		mockedCreate.mockResolvedValue({ id: "s1" } as never);
		wrap(<NewSetupDrawer />);
		await userEvent.type(screen.getByLabelText("Name"), "Gap and Go");
		await userEvent.type(
			screen.getByLabelText("Description / Notes"),
			"Opening range breakout",
		);
		await userEvent.click(screen.getByRole("button", { name: "Save" }));
		await waitFor(() =>
			expect(mockedCreate).toHaveBeenCalledWith({
				name: "Gap and Go",
				description: "Opening range breakout",
			}),
		);
		await waitFor(() => expect(useUI.getState().drawer).toBeNull());
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/app/drawers/NewSetupDrawer.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/app/drawers/NewSetupDrawer.tsx`**

```tsx
import { useState } from "react";
import { Drawer, DrawerBanner } from "../../components/Drawer";
import { useToastManager } from "../../components/Toast";
import { useCreateSetup } from "../../lib/hooks/useSetups";
import { useUI } from "../../lib/ui";

const inputStyle: React.CSSProperties = {
	background: "var(--color-surface-raised)",
	color: "var(--color-text)",
	border: "1px solid var(--color-border)",
	borderRadius: "var(--radius-control)",
	padding: "7px 10px",
	fontSize: 13,
	fontFamily: "var(--font-ui)",
	outline: "none",
	width: "100%",
};

const labelStyle: React.CSSProperties = {
	fontSize: 11,
	fontWeight: 600,
	textTransform: "uppercase",
	letterSpacing: "0.04em",
	color: "var(--color-text-muted)",
};

export function NewSetupDrawer() {
	const open = useUI((s) => s.drawer === "new-setup");
	const closeDrawer = useUI((s) => s.closeDrawer);
	const toast = useToastManager();
	const createSetup = useCreateSetup();

	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [error, setError] = useState("");

	function close() {
		setName("");
		setDescription("");
		setError("");
		closeDrawer();
	}

	async function save() {
		setError("");
		if (!name.trim()) {
			setError("Name is required.");
			return;
		}
		try {
			await createSetup.mutateAsync({
				name: name.trim(),
				description: description.trim() || undefined,
			});
			toast.add({ title: "Setup created", description: name.trim() });
			close();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Save failed");
		}
	}

	const footer = (
		<>
			<button
				type="button"
				onClick={close}
				style={{
					background: "var(--color-surface-raised)",
					color: "var(--color-text)",
					border: "1px solid var(--color-border)",
					borderRadius: "var(--radius-control)",
					padding: "7px 14px",
					fontSize: 13,
					cursor: "pointer",
				}}
			>
				Cancel
			</button>
			<button
				type="button"
				onClick={save}
				disabled={createSetup.isPending}
				style={{
					background: "var(--color-accent)",
					color: "#0e1218",
					border: "none",
					borderRadius: "var(--radius-control)",
					padding: "7px 16px",
					fontSize: 13,
					fontWeight: 600,
					cursor: createSetup.isPending ? "default" : "pointer",
					opacity: createSetup.isPending ? 0.6 : 1,
				}}
			>
				Save
			</button>
		</>
	);

	return (
		<Drawer
			open={open}
			onOpenChange={(o) => {
				if (!o) close();
			}}
			title="New Setup"
			footer={footer}
		>
			<DrawerBanner>
				Define a playbook setup — a repeatable pattern you trade. Tag trades
				with it later to compare performance per setup.
			</DrawerBanner>

			<div className="flex flex-col gap-1">
				<label htmlFor="ns-name" style={labelStyle}>
					Name
				</label>
				<input
					id="ns-name"
					aria-label="Name"
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="e.g. Gap and Go"
					style={inputStyle}
				/>
			</div>

			<div className="flex flex-col gap-1">
				<label htmlFor="ns-desc" style={labelStyle}>
					Description / Notes
				</label>
				<textarea
					id="ns-desc"
					aria-label="Description / Notes"
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					placeholder="What defines this setup? Entry criteria, invalidation, targets…"
					rows={6}
					style={{ ...inputStyle, resize: "vertical" }}
				/>
			</div>

			{error && (
				<p className="text-xs" style={{ color: "var(--color-neg)" }}>
					{error}
				</p>
			)}
		</Drawer>
	);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/app/drawers/NewSetupDrawer.test.tsx`
Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
pnpm lint --write .
git add src/app/drawers/NewSetupDrawer.tsx src/app/drawers/NewSetupDrawer.test.tsx
git commit -m "feat(web): New Setup drawer backed by setups API"
```

---

### Task 11: Shell — sidebar, header bar, AppShell wiring

**Files:**
- Modify: `src/components/AppNav.tsx` (full rewrite of the render, keep filename)
- Create: `src/components/HeaderBar.tsx`
- Modify: `src/app/shell.tsx`

**Interfaces:**
- Consumes: `useUI` (Task 4), `computeHeaderStats` (Task 7), `NewTradeDrawer` (Task 9), `NewSetupDrawer` (Task 10), existing `AccountSwitcher`, `DateRangePicker`, `useSummary`/`useTrades`/`useCash`/`useAccounts` hooks, `useFilters`/`useFilterParams`, `useAuth`, `fmtMoney`/`fmtSignedMoney`.
- Produces: `AppNav()` (260px sidebar with quick actions), `HeaderBar()` (P&L block + search + range + sign-out). Nav labels change: `Reports` link now reads **Stats**; `Accounts` link now reads **Settings** (routes unchanged).

- [ ] **Step 1: Rewrite `src/components/AppNav.tsx`**

Replace the entire file:

```tsx
import { Link } from "@tanstack/react-router";
import {
	BookOpen,
	CalendarDays,
	CandlestickChart,
	LayoutDashboard,
	List,
	PieChart,
	Plus,
	Settings,
	Upload,
	Zap,
} from "lucide-react";
import { AccountSwitcher } from "./AccountSwitcher";
import { useUI } from "../lib/ui";

const ROUTER_ROUTES = [
	{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
	{ to: "/reports", label: "Stats", icon: PieChart },
	{ to: "/calendar", label: "Calendar", icon: CalendarDays },
	{ to: "/trades", label: "Trades", icon: List },
	{ to: "/playbook", label: "Playbook", icon: BookOpen },
	{ to: "/import", label: "Import", icon: Upload },
	{ to: "/settings", label: "Settings", icon: Settings },
] as const;

const itemBase: React.CSSProperties = {
	display: "flex",
	alignItems: "center",
	gap: "10px",
	padding: "8px 12px",
	borderRadius: "var(--radius-control)",
	fontSize: "13px",
	textDecoration: "none",
	position: "relative",
	transition: "background var(--duration-fast), color var(--duration-fast)",
	cursor: "pointer",
};

function QuickAction({
	label,
	icon: Icon,
	color,
	onClick,
}: {
	label: string;
	icon: typeof Plus;
	color: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			style={{
				...itemBase,
				color,
				background: "transparent",
				border: "none",
				width: "100%",
				textAlign: "left",
				fontFamily: "var(--font-ui)",
			}}
			onMouseEnter={(e) => {
				(e.currentTarget as HTMLElement).style.background =
					"var(--color-surface-hover)";
			}}
			onMouseLeave={(e) => {
				(e.currentTarget as HTMLElement).style.background = "transparent";
			}}
		>
			<Icon size={15} strokeWidth={1.5} />
			<span>{label}</span>
		</button>
	);
}

export function AppNav() {
	const openDrawer = useUI((s) => s.openDrawer);

	return (
		<nav
			aria-label="Main navigation"
			style={{
				width: "260px",
				background: "var(--color-surface-panel)",
				borderRight: "1px solid var(--color-border)",
				display: "flex",
				flexDirection: "column",
				gap: "2px",
				padding: "0 10px 12px",
				flexShrink: 0,
				overflowY: "auto",
			}}
		>
			{/* Wordmark */}
			<div
				className="flex items-center gap-2"
				style={{ padding: "14px 12px", marginBottom: "4px" }}
			>
				<CandlestickChart
					size={20}
					strokeWidth={2}
					style={{ color: "var(--color-accent)" }}
				/>
				<span
					style={{
						fontSize: "16px",
						fontWeight: 700,
						letterSpacing: "-0.01em",
						color: "var(--color-text)",
					}}
				>
					TraderMemos
				</span>
			</div>

			{/* Account switcher */}
			<div style={{ padding: "0 2px", marginBottom: "10px" }}>
				<AccountSwitcher />
			</div>

			{/* Nav */}
			{ROUTER_ROUTES.map(({ to, label, icon: Icon }) => (
				<Link
					key={to}
					to={to}
					style={itemBase}
					activeProps={{
						style: {
							...itemBase,
							color: "var(--color-accent)",
							background: "var(--color-accent-subtle)",
							boxShadow: "inset 3px 0 0 var(--color-accent)",
						},
					}}
					inactiveProps={{
						style: { ...itemBase, color: "var(--color-text-muted)" },
					}}
					onMouseEnter={(e) => {
						const el = e.currentTarget as HTMLElement;
						if (el.getAttribute("aria-current") !== "page") {
							el.style.background = "var(--color-surface-hover)";
							el.style.color = "var(--color-text)";
						}
					}}
					onMouseLeave={(e) => {
						const el = e.currentTarget as HTMLElement;
						if (el.getAttribute("aria-current") !== "page") {
							el.style.background = "transparent";
							el.style.color = "var(--color-text-muted)";
						}
					}}
				>
					<Icon size={15} strokeWidth={1.5} />
					<span>{label}</span>
				</Link>
			))}

			{/* Divider */}
			<div
				style={{
					borderTop: "1px solid var(--color-border)",
					margin: "10px 4px",
				}}
			/>

			{/* Quick actions */}
			<QuickAction
				label="New Trade"
				icon={Plus}
				color="var(--color-accent)"
				onClick={() => openDrawer("new-trade")}
			/>
			<QuickAction
				label="New Setup"
				icon={Zap}
				color="var(--color-amber)"
				onClick={() => openDrawer("new-setup")}
			/>
		</nav>
	);
}
```

- [ ] **Step 2: Create `src/components/HeaderBar.tsx`**

```tsx
import { LogOut, PanelLeft, Search } from "lucide-react";
import { pnlColor } from "./theme-tokens";
import { DateRangePicker } from "./DateRangePicker";
import { useAuth } from "../lib/auth";
import { useFilterParams, useFilters } from "../lib/filters";
import { computeHeaderStats } from "../lib/headerStats";
import { useAccounts } from "../lib/hooks/useAccounts";
import { useSummary } from "../lib/hooks/useAnalytics";
import { useCash } from "../lib/hooks/useCash";
import { useTrades } from "../lib/hooks/useTrades";
import { fmtMoney, fmtSignedMoney } from "../lib/format";
import { useUI } from "../lib/ui";

const LOCALE = "en-US";

function SubStat({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex flex-col leading-tight">
			<span
				className="text-[10px] uppercase tracking-wide"
				style={{ color: "var(--color-text-muted)" }}
			>
				{label}
			</span>
			<span
				className="text-[11px] tabular-nums"
				style={{ color: "var(--color-text)", fontFamily: "var(--font-mono)" }}
			>
				{value}
			</span>
		</div>
	);
}

export function HeaderBar() {
	const filters = useFilterParams();
	const accountId = useFilters((s) => s.accountId);
	const symbol = useFilters((s) => s.symbol) ?? "";
	const setSymbol = useFilters((s) => s.setSymbol);
	const signOut = useAuth((s) => s.signOut);
	const toggleSidebar = useUI((s) => s.toggleSidebar);

	const accounts = useAccounts().data ?? [];
	const summaryQ = useSummary(filters);
	const tradesQ = useTrades(filters);
	const cashQ = useCash(filters);

	const currency =
		accounts.find((a) => a.id === accountId)?.base_currency ?? "USD";
	const stats = computeHeaderStats({
		accounts,
		accountId,
		cashTx: cashQ.data ?? [],
		summary: summaryQ.data,
		trades: tradesQ.data ?? [],
	});

	return (
		<header
			className="flex items-center gap-4 px-4 shrink-0"
			style={{
				borderBottom: "1px solid var(--color-border)",
				background: "var(--color-surface-panel)",
				height: "56px",
			}}
		>
			<button
				type="button"
				onClick={toggleSidebar}
				aria-label="Toggle sidebar"
				style={{
					background: "none",
					border: "none",
					cursor: "pointer",
					color: "var(--color-text-muted)",
					display: "flex",
					padding: 4,
				}}
			>
				<PanelLeft size={16} strokeWidth={1.5} />
			</button>

			{/* Account P&L block */}
			<div className="flex items-center gap-3">
				<span
					className={`text-xl font-bold tabular-nums ${pnlColor(stats.netPnl)}`}
					style={{ fontFamily: "var(--font-mono)" }}
				>
					{fmtSignedMoney(stats.netPnl, currency, LOCALE)}
				</span>
				<SubStat label="Cash" value={fmtMoney(stats.cash, currency, LOCALE)} />
				<SubStat
					label="Active"
					value={fmtMoney(stats.active, currency, LOCALE)}
				/>
			</div>

			<div className="ml-auto flex items-center gap-2">
				{/* Search and filter */}
				<div
					className="flex items-center gap-2 px-3"
					style={{
						background: "var(--color-surface-raised)",
						border: "1px solid var(--color-border)",
						borderRadius: 999,
						height: 32,
						width: 240,
					}}
				>
					<Search
						size={14}
						strokeWidth={1.5}
						style={{ color: "var(--color-text-muted)", flexShrink: 0 }}
					/>
					<input
						value={symbol}
						onChange={(e) =>
							setSymbol(e.target.value.toUpperCase() || undefined)
						}
						placeholder="Search and Filter"
						aria-label="Search symbol"
						style={{
							background: "transparent",
							border: "none",
							outline: "none",
							color: "var(--color-text)",
							fontSize: 12,
							fontFamily: "var(--font-ui)",
							width: "100%",
						}}
					/>
				</div>
				<DateRangePicker />
				<button
					type="button"
					onClick={signOut}
					aria-label="Sign out"
					className="flex items-center justify-center"
					style={{
						width: 30,
						height: 30,
						color: "var(--color-text-muted)",
						background: "transparent",
						border: "1px solid var(--color-border)",
						borderRadius: "var(--radius-control)",
						cursor: "pointer",
					}}
				>
					<LogOut size={14} strokeWidth={1.5} />
				</button>
			</div>
		</header>
	);
}
```

- [ ] **Step 3: Rewrite `src/app/shell.tsx`**

```tsx
import { Outlet } from "@tanstack/react-router";
import { AppNav } from "../components/AppNav";
import { HeaderBar } from "../components/HeaderBar";
import { Toaster } from "../components/Toaster";
import { useAuth } from "../lib/auth";
import { useUI } from "../lib/ui";
import { NewSetupDrawer } from "./drawers/NewSetupDrawer";
import { NewTradeDrawer } from "./drawers/NewTradeDrawer";
import { LoginScreen } from "./screens/LoginScreen";

export function AppShell() {
	const authed = useAuth((s) => s.authed);
	const collapsed = useUI((s) => s.sidebarCollapsed);

	if (!authed) {
		return <LoginScreen />;
	}

	return (
		<div
			className="flex h-full"
			style={{ background: "var(--color-surface-base)" }}
		>
			{!collapsed && <AppNav />}

			<div className="flex flex-col flex-1 min-w-0 overflow-hidden">
				<HeaderBar />
				<main
					className="flex-1 overflow-auto p-4"
					style={{ background: "var(--color-surface-base)" }}
				>
					<Outlet />
				</main>
			</div>

			<NewTradeDrawer />
			<NewSetupDrawer />
			<Toaster />
		</div>
	);
}
```

- [ ] **Step 4: Run the full suite and build**

Run: `pnpm test && pnpm build`
Expected: all tests PASS, build succeeds. If `AppNav` previously exported anything besides `AppNav` (it doesn't — verify with `grep "export" src/components/AppNav.tsx`), keep those exports.

- [ ] **Step 5: Visual smoke check (only if the API is running)**

Run: `pnpm dev` and open http://localhost:5173 — confirm sidebar (wordmark, account switcher, nav, quick actions), header (P&L block, search pill), and that New Trade / New Setup open drawers. Skip if no API is available; the Playwright task covers this later.

- [ ] **Step 6: Lint and commit**

```bash
pnpm lint --write .
git add src/components/AppNav.tsx src/components/HeaderBar.tsx src/app/shell.tsx
git commit -m "feat(web): redesigned shell - sidebar, header P&L bar, drawer mounts"
```

---

### Task 12: Dashboard rework

**Files:**
- Modify: `src/app/screens/DashboardView.tsx` (full rewrite)
- Modify: `src/routes/dashboard.tsx`
- Modify: `src/app/screens/DashboardView.test.tsx` (full rewrite)

**Interfaces:**
- Consumes: `StatBar`, `SegmentedControl`, `Pill`, `tradeColumns`, `DataTable`, `EmptyState`, `Skeleton`, `ChartFrame`/`chartTheme`, `pnlColor`, format helpers, `Summary`/`EquityPoint`/`Trade`/`Account` types.
- Produces new `DashboardViewProps`:

```ts
export interface DashboardViewProps {
	summaryLoading: boolean;
	summaryError: boolean;
	summary: Summary | undefined;
	equityLoading: boolean;
	equityError: boolean;
	equityPoints: EquityPoint[];
	tradesLoading: boolean;
	tradesError: boolean;
	trades: Trade[]; // ALL trades in filter scope, sorted opened_at desc
	accounts: Account[];
	selectedAccountId: string | undefined;
	onSelectTrade: (t: Trade) => void;
}
```

(The `daily*`, `year`, `month` props are removed — the mini calendar is gone; the Calendar page owns that.)

- [ ] **Step 1: Rewrite the test `src/app/screens/DashboardView.test.tsx`**

Replace the whole file:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Summary, Trade } from "../../lib/api/types";
import { DashboardView } from "./DashboardView";

const SUMMARY: Summary = {
	total_trades: 4,
	wins: 2,
	losses: 2,
	breakeven: 0,
	win_rate: 0.5,
	net_pnl: -61.79,
	gross_profit: 69.48,
	gross_loss: -131.27,
	profit_factor: 0.53,
	expectancy: -15.45,
	avg_win: 34.74,
	avg_loss: -65.64,
	avg_trade: -15.45,
	largest_win: 58.09,
	largest_loss: -111.24,
	total_fees: 12.5,
};

const TRADE: Trade = {
	id: "t1",
	account_id: "a1",
	symbol: "TSLQ",
	instrument_type: "stock",
	direction: "long",
	status: "closed",
	opened_at: "2026-07-02T13:00:00Z",
	closed_at: "2026-07-02T13:39:00Z",
	qty_opened: 80,
	avg_entry_price: 18.02,
	avg_exit_price: 18.23,
	gross_pnl: 16.8,
	fees_total: 5.41,
	net_pnl: 11.39,
	pnl_currency: "USD",
	return_pct: 0.79,
	time_in_trade_secs: 2340,
	notes: "",
	tags: [],
};

const BASE = {
	summaryLoading: false,
	summaryError: false,
	summary: SUMMARY,
	equityLoading: false,
	equityError: false,
	equityPoints: [
		{ at: "2026-07-01T00:00:00Z", equity: -20.03 },
		{ at: "2026-07-02T00:00:00Z", equity: -61.79 },
	],
	tradesLoading: false,
	tradesError: false,
	trades: [TRADE],
	accounts: [],
	selectedAccountId: undefined,
	onSelectTrade: vi.fn(),
};

describe("DashboardView", () => {
	it("renders the stats strip from the summary", () => {
		render(<DashboardView {...BASE} />);
		expect(screen.getByText(/WINS/)).toBeInTheDocument();
		expect(screen.getByText(/LOSSES/)).toBeInTheDocument();
		expect(screen.getByText(/AVG W/)).toBeInTheDocument();
		expect(screen.getByText(/AVG L/)).toBeInTheDocument();
		expect(screen.getByText("PnL")).toBeInTheDocument();
		expect(screen.getByText("-$61.79")).toBeInTheDocument();
	});

	it("renders the trades table with the loaded footer", () => {
		render(<DashboardView {...BASE} />);
		expect(screen.getByText("TSLQ")).toBeInTheDocument();
		expect(screen.getByText("WIN")).toBeInTheDocument();
		expect(screen.getByText("All 1 trades loaded")).toBeInTheDocument();
	});

	it("renders range segmented control", () => {
		render(<DashboardView {...BASE} />);
		expect(screen.getByRole("button", { name: "30D" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "ALL" })).toBeInTheDocument();
	});

	it("shows the empty state with no data", () => {
		render(
			<DashboardView
				{...BASE}
				summary={{ ...SUMMARY, total_trades: 0 }}
				trades={[]}
				equityPoints={[]}
			/>,
		);
		expect(screen.getByText("No trades yet")).toBeInTheDocument();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/app/screens/DashboardView.test.tsx`
Expected: FAIL — old view doesn't render `WINS` / `All 1 trades loaded` / props mismatch.

- [ ] **Step 3: Rewrite `src/app/screens/DashboardView.tsx`**

```tsx
import { TrendingUp } from "lucide-react";
import { useState } from "react";
import {
	Area,
	AreaChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { ChartFrame, chartTheme } from "../../components/ChartFrame";
import { DataTable } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { Panel } from "../../components/Panel";
import { SegmentedControl } from "../../components/SegmentedControl";
import { Skeleton } from "../../components/Skeleton";
import { StatBar } from "../../components/StatBar";
import { pnlColor } from "../../components/theme-tokens";
import { tradeColumns } from "../../components/tradeColumns";
import type {
	Account,
	EquityPoint,
	Summary,
	Trade,
} from "../../lib/api/types";
import { fmtMoney, fmtPct, fmtSignedMoney } from "../../lib/format";

export interface DashboardViewProps {
	summaryLoading: boolean;
	summaryError: boolean;
	summary: Summary | undefined;
	equityLoading: boolean;
	equityError: boolean;
	equityPoints: EquityPoint[];
	tradesLoading: boolean;
	tradesError: boolean;
	trades: Trade[];
	accounts: Account[];
	selectedAccountId: string | undefined;
	onSelectTrade: (t: Trade) => void;
}

const LOCALE = "en-US";
const RANGES = [
	{ value: "30D", label: "30D" },
	{ value: "90D", label: "90D" },
	{ value: "ALL", label: "ALL" },
];

function getCurrency(accounts: Account[], accountId?: string): string {
	if (!accountId) return "USD";
	return accounts.find((a) => a.id === accountId)?.base_currency ?? "USD";
}

function startingBalance(accounts: Account[], accountId?: string): number {
	const list = accountId
		? accounts.filter((a) => a.id === accountId)
		: accounts;
	return list.reduce((s, a) => s + a.starting_balance, 0);
}

function rangeCutoff(range: string): number | null {
	if (range === "ALL") return null;
	const days = range === "30D" ? 30 : 90;
	return Date.now() - days * 86400_000;
}

function EquityBand({
	loading,
	error,
	points,
	currency,
	range,
	onRangeChange,
}: {
	loading: boolean;
	error: boolean;
	points: EquityPoint[];
	currency: string;
	range: string;
	onRangeChange: (r: string) => void;
}) {
	const cutoff = rangeCutoff(range);
	const visible = cutoff
		? points.filter((p) => new Date(p.at).getTime() >= cutoff)
		: points;

	return (
		<Panel>
			<div className="flex items-center justify-between px-3 pt-2">
				<SegmentedControl
					ariaLabel="Equity range"
					options={RANGES}
					value={range}
					onChange={onRangeChange}
				/>
			</div>
			{loading ? (
				<Skeleton height="150px" className="m-3" />
			) : error ? (
				<p className="p-4 text-xs" style={{ color: "var(--color-neg)" }}>
					Failed to load equity curve.
				</p>
			) : visible.length === 0 ? (
				<EmptyState title="No equity data" />
			) : (
				<ChartFrame className="border-0 rounded-none">
					<ResponsiveContainer width="100%" height={150}>
						<AreaChart
							data={visible}
							margin={{ top: 10, right: 12, bottom: 0, left: 0 }}
						>
							<defs>
								<linearGradient id="eq-fill" x1="0" y1="0" x2="0" y2="1">
									<stop offset="5%" stopColor="#6ea8fe" stopOpacity={0.2} />
									<stop offset="95%" stopColor="#6ea8fe" stopOpacity={0} />
								</linearGradient>
							</defs>
							<CartesianGrid vertical={false} stroke={chartTheme.gridColor} />
							<XAxis
								dataKey="at"
								tick={{ fontSize: 10, fill: chartTheme.axisColor }}
								tickFormatter={(v: string) => v.slice(0, 10)}
								axisLine={false}
								tickLine={false}
								minTickGap={60}
							/>
							<YAxis
								tick={{ fontSize: 10, fill: chartTheme.axisColor }}
								tickFormatter={(v: number) => fmtMoney(v, currency, LOCALE)}
								axisLine={false}
								tickLine={false}
								width={72}
							/>
							<Tooltip
								contentStyle={{
									background: chartTheme.tooltipBg,
									border: `1px solid ${chartTheme.tooltipBorder}`,
									color: chartTheme.tooltipText,
									fontSize: 11,
									fontFamily: "var(--font-mono)",
								}}
								labelFormatter={(label: string) => label.slice(0, 10)}
								formatter={(value: number) => [
									fmtMoney(value, currency, LOCALE),
									"Equity",
								]}
								cursor={{ fill: chartTheme.cursorFill }}
							/>
							<Area
								type="monotone"
								dataKey="equity"
								stroke="#6ea8fe"
								strokeWidth={1.5}
								fill="url(#eq-fill)"
								dot={false}
								activeDot={{ r: 3, fill: "#6ea8fe" }}
							/>
						</AreaChart>
					</ResponsiveContainer>
				</ChartFrame>
			)}
		</Panel>
	);
}

function StatsStrip({
	loading,
	error,
	summary,
	trades,
	currency,
	starting,
}: {
	loading: boolean;
	error: boolean;
	summary: Summary | undefined;
	trades: Trade[];
	currency: string;
	starting: number;
}) {
	if (loading) return <Skeleton height="150px" />;
	if (error)
		return (
			<p className="text-xs p-4" style={{ color: "var(--color-neg)" }}>
				Failed to load summary.
			</p>
		);
	if (!summary) return null;

	const total = Math.max(summary.total_trades, 1);
	const openCount = trades.filter((t) => t.status === "open").length;
	const avgWinAbs = Math.abs(summary.avg_win);
	const avgLossAbs = Math.abs(summary.avg_loss);
	const avgDen = avgWinAbs + avgLossAbs || 1;
	const pnlPct = starting > 0 ? summary.net_pnl / starting : null;

	return (
		<Panel>
			<div className="flex items-center gap-6 flex-wrap p-4">
				<div className="flex flex-col gap-3 flex-1" style={{ minWidth: 130 }}>
					<StatBar
						label="WINS"
						value={String(summary.wins)}
						right={fmtPct(summary.win_rate, LOCALE)}
						pct={summary.win_rate}
						tone="pos"
					/>
					<StatBar
						label="LOSSES"
						value={String(summary.losses)}
						right={fmtPct(summary.losses / total, LOCALE)}
						pct={summary.losses / total}
						tone="neg"
					/>
				</div>
				<div className="flex flex-col gap-3 flex-1" style={{ minWidth: 130 }}>
					<StatBar
						label="OPEN"
						value={String(openCount)}
						right={fmtPct(openCount / total, LOCALE)}
						pct={openCount / total}
						tone="accent"
					/>
					<StatBar
						label="WASH"
						value={String(summary.breakeven)}
						right={fmtPct(summary.breakeven / total, LOCALE)}
						pct={summary.breakeven / total}
						tone="amber"
					/>
				</div>
				<div className="flex flex-col gap-3 flex-1" style={{ minWidth: 150 }}>
					<StatBar
						label="AVG W"
						value={fmtMoney(summary.avg_win, currency, LOCALE)}
						pct={avgWinAbs / avgDen}
						tone="pos"
					/>
					<StatBar
						label="AVG L"
						value={fmtMoney(summary.avg_loss, currency, LOCALE)}
						pct={avgLossAbs / avgDen}
						tone="neg"
					/>
				</div>
				<div
					className="flex flex-col items-end gap-1"
					style={{
						borderLeft: "1px solid var(--color-border)",
						paddingLeft: 20,
					}}
				>
					<span
						className="text-[11px] uppercase tracking-wide"
						style={{ color: "var(--color-text-muted)" }}
					>
						PnL
					</span>
					<span
						className={`text-2xl font-bold tabular-nums ${pnlColor(summary.net_pnl)}`}
						style={{ fontFamily: "var(--font-mono)" }}
					>
						{fmtSignedMoney(summary.net_pnl, currency, LOCALE)}
					</span>
					{pnlPct != null && (
						<span
							className={`text-[11px] tabular-nums ${pnlColor(summary.net_pnl)}`}
						>
							{(pnlPct * 100).toFixed(2)}%
						</span>
					)}
				</div>
			</div>
		</Panel>
	);
}

export function DashboardView({
	summaryLoading,
	summaryError,
	summary,
	equityLoading,
	equityError,
	equityPoints,
	tradesLoading,
	tradesError,
	trades,
	accounts,
	selectedAccountId,
	onSelectTrade,
}: DashboardViewProps) {
	const currency = getCurrency(accounts, selectedAccountId);
	const starting = startingBalance(accounts, selectedAccountId);
	const [range, setRange] = useState("30D");

	const noData =
		!summaryLoading &&
		!tradesLoading &&
		!summaryError &&
		!tradesError &&
		summary?.total_trades === 0 &&
		trades.length === 0;

	if (noData) {
		return (
			<div className="flex items-center justify-center h-full min-h-[400px]">
				<EmptyState
					title="No trades yet"
					hint="Import a CSV or log a trade to get started."
					icon={<TrendingUp size={40} strokeWidth={1.5} />}
				/>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			{/* Top band: equity chart + stats strip */}
			<div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
				<div className="xl:col-span-2">
					<EquityBand
						loading={equityLoading}
						error={equityError}
						points={equityPoints}
						currency={currency}
						range={range}
						onRangeChange={setRange}
					/>
				</div>
				<div className="xl:col-span-3">
					<StatsStrip
						loading={summaryLoading}
						error={summaryError}
						summary={summary}
						trades={trades}
						currency={currency}
						starting={starting}
					/>
				</div>
			</div>

			{/* Trades table */}
			<Panel>
				{tradesLoading ? (
					<Skeleton height="240px" className="m-3" />
				) : tradesError ? (
					<p className="p-4 text-xs" style={{ color: "var(--color-neg)" }}>
						Failed to load trades.
					</p>
				) : trades.length === 0 ? (
					<EmptyState title="No trades in this range" />
				) : (
					<>
						<div style={{ maxHeight: 520 }}>
							<DataTable
								columns={tradeColumns(currency, onSelectTrade)}
								data={trades}
								onRowClick={onSelectTrade}
							/>
						</div>
						<p
							className="text-center text-xs py-3"
							style={{ color: "var(--color-text-muted)" }}
						>
							All {trades.length} trades loaded
						</p>
					</>
				)}
			</Panel>
		</div>
	);
}
```

- [ ] **Step 4: Update `src/routes/dashboard.tsx`**

Replace the whole file:

```tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { DashboardView } from "../app/screens/DashboardView";
import { useFilterParams, useFilters } from "../lib/filters";
import { useAccounts } from "../lib/hooks/useAccounts";
import { useEquityCurve, useSummary } from "../lib/hooks/useAnalytics";
import { useTrades } from "../lib/hooks/useTrades";

export const Route = createFileRoute("/dashboard")({
	component: DashboardPage,
});

function DashboardPage() {
	const filters = useFilterParams();
	const accountId = useFilters((s) => s.accountId);
	const navigate = useNavigate();

	const summaryQ = useSummary(filters);
	const equityQ = useEquityCurve(filters);
	const tradesQ = useTrades(filters);
	const accountsQ = useAccounts();

	const trades = [...(tradesQ.data ?? [])].sort(
		(a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime(),
	);

	return (
		<DashboardView
			summaryLoading={summaryQ.isLoading}
			summaryError={summaryQ.isError}
			summary={summaryQ.data}
			equityLoading={equityQ.isLoading}
			equityError={equityQ.isError}
			equityPoints={equityQ.data?.points ?? []}
			tradesLoading={tradesQ.isLoading}
			tradesError={tradesQ.isError}
			trades={trades}
			accounts={accountsQ.data ?? []}
			selectedAccountId={accountId}
			onSelectTrade={(t) =>
				navigate({ to: "/trades/$id", params: { id: t.id } })
			}
		/>
	);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test src/app/screens/DashboardView.test.tsx && pnpm test`
Expected: dashboard tests PASS; full suite PASS (no other file imports `DashboardViewProps`' removed fields — verify with `grep -rn "dailyPnl\|dailyLoading" src/routes/dashboard.tsx` returning nothing).

- [ ] **Step 6: Lint and commit**

```bash
pnpm lint --write .
git add src/app/screens/DashboardView.tsx src/app/screens/DashboardView.test.tsx src/routes/dashboard.tsx
git commit -m "feat(web): dashboard redesign - equity band, stats strip, dense trades table"
```

---

### Task 13: Calendar rework

**Files:**
- Modify: `src/app/screens/CalendarView.tsx` (full rewrite)
- Modify: `src/routes/calendar.tsx`
- Modify: `src/app/screens/CalendarView.test.tsx` (full rewrite)

**Interfaces:**
- Consumes: `monthGrid`, `buildDayRecords`, `weekSummaries`, `DayRecord`, `WeekSummary` (Task 5), `fmtRecord` (Task 2), `Pill`, `tradeColumns` (for the day drill-in table), `Summary` type, `useSummary`/`useTrades`.
- Produces new `CalendarViewProps`:

```ts
export interface CalendarViewProps {
	dailyPnl: Record<string, number>;
	dailyLoading: boolean;
	dailyError: boolean;
	records: Record<string, DayRecord>;
	monthSummary: Summary | undefined;
	accounts: Account[];
	selectedAccountId: string | undefined;
	year: number;
	month: number; // 1-based
	onPrevMonth: () => void;
	onNextMonth: () => void;
	onToday: () => void;
	selectedDay: string | null;
	onSelectDay: (date: string | null) => void;
	dayTrades: Trade[];
	dayTradesLoading: boolean;
	dayTradesError: boolean;
	currency: string;
	onSelectTrade: (t: Trade) => void;
}
```

(The `filters` prop is removed.)

- [ ] **Step 1: Rewrite the test `src/app/screens/CalendarView.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Summary } from "../../lib/api/types";
import { CalendarView } from "./CalendarView";

const MONTH_SUMMARY = {
	total_trades: 4,
	wins: 2,
	losses: 2,
	win_rate: 0.5,
	profit_factor: 0.53,
	net_pnl: -61.79,
} as Summary;

const BASE = {
	dailyPnl: { "2026-07-01": -20.03, "2026-07-02": -41.76 },
	dailyLoading: false,
	dailyError: false,
	records: {
		"2026-07-01": { wins: 0, losses: 1 },
		"2026-07-02": { wins: 2, losses: 1 },
	},
	monthSummary: MONTH_SUMMARY,
	accounts: [],
	selectedAccountId: undefined,
	year: 2026,
	month: 7,
	onPrevMonth: vi.fn(),
	onNextMonth: vi.fn(),
	onToday: vi.fn(),
	selectedDay: null,
	onSelectDay: vi.fn(),
	dayTrades: [],
	dayTradesLoading: false,
	dayTradesError: false,
	currency: "USD",
	onSelectTrade: vi.fn(),
};

describe("CalendarView", () => {
	it("renders the month stats header", () => {
		render(<CalendarView {...BASE} />);
		expect(screen.getByText("July 2026")).toBeInTheDocument();
		expect(screen.getByText("Trades")).toBeInTheDocument();
		expect(screen.getByText("Win rate")).toBeInTheDocument();
		expect(screen.getByText("Record")).toBeInTheDocument();
		expect(screen.getByText("2W")).toBeInTheDocument();
		expect(screen.getByText("2L")).toBeInTheDocument();
		expect(screen.getByText("Month P&L:")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Today" })).toBeInTheDocument();
	});

	it("renders day cells with pnl and records, plus WEEK column", () => {
		render(<CalendarView {...BASE} />);
		expect(screen.getByText("-$20.03")).toBeInTheDocument();
		expect(screen.getByText("-$41.76")).toBeInTheDocument();
		expect(screen.getByText("2W1L")).toBeInTheDocument();
		expect(screen.getByText("WEEK")).toBeInTheDocument();
		// Week 1 total = -61.79 with 2W2L record
		expect(screen.getByText("-$61.79")).toBeInTheDocument();
		expect(screen.getByText("2W2L")).toBeInTheDocument();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/app/screens/CalendarView.test.tsx`
Expected: FAIL — props mismatch / missing text.

- [ ] **Step 3: Rewrite `src/app/screens/CalendarView.tsx`**

```tsx
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { DataTable } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { Panel } from "../../components/Panel";
import { Skeleton } from "../../components/Skeleton";
import { pnlColor } from "../../components/theme-tokens";
import { tradeColumns } from "../../components/tradeColumns";
import type { Account, Summary, Trade } from "../../lib/api/types";
import {
	type DayRecord,
	monthGrid,
	weekSummaries,
} from "../../lib/calendar";
import { fmtPct, fmtRecord, fmtSignedMoney } from "../../lib/format";

const LOCALE = "en-US";
const DOW_HEADERS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export interface CalendarViewProps {
	dailyPnl: Record<string, number>;
	dailyLoading: boolean;
	dailyError: boolean;
	records: Record<string, DayRecord>;
	monthSummary: Summary | undefined;
	accounts: Account[];
	selectedAccountId: string | undefined;
	year: number;
	month: number;
	onPrevMonth: () => void;
	onNextMonth: () => void;
	onToday: () => void;
	selectedDay: string | null;
	onSelectDay: (date: string | null) => void;
	dayTrades: Trade[];
	dayTradesLoading: boolean;
	dayTradesError: boolean;
	currency: string;
	onSelectTrade: (t: Trade) => void;
}

/** Scale opacity 0.10..0.40 by magnitude (capped at $2000). */
function bgOpacity(pnl: number): number {
	const norm = Math.min(Math.abs(pnl) / 2000, 1);
	return 0.1 + norm * 0.3;
}

function dayBg(pnl: number): string {
	const op = bgOpacity(pnl).toFixed(2);
	return pnl >= 0
		? `rgba(52, 211, 153, ${op})`
		: `rgba(248, 113, 113, ${op})`;
}

function dayColor(pnl: number): string {
	return pnl >= 0 ? "var(--color-pos)" : "var(--color-neg)";
}

function todayString(): string {
	const d = new Date();
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function navBtnStyle(): React.CSSProperties {
	return {
		width: 28,
		height: 28,
		color: "var(--color-text-muted)",
		background: "transparent",
		border: "1px solid var(--color-border)",
		borderRadius: "var(--radius-control)",
		cursor: "pointer",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
	};
}

function HeaderStat({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex items-baseline gap-1.5">
			<span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
				{label}
			</span>
			<span
				className="text-xs font-semibold tabular-nums"
				style={{ color: "var(--color-text)" }}
			>
				{children}
			</span>
		</div>
	);
}

export function CalendarView({
	dailyPnl,
	dailyLoading,
	dailyError,
	records,
	monthSummary,
	accounts,
	selectedAccountId,
	year,
	month,
	onPrevMonth,
	onNextMonth,
	onToday,
	selectedDay,
	onSelectDay,
	dayTrades,
	dayTradesLoading,
	dayTradesError,
	currency,
	onSelectTrade,
}: CalendarViewProps) {
	const grid = monthGrid(year, month, dailyPnl);
	const weeks = weekSummaries(grid.weeks, records);
	const today = todayString();

	const monthLabel = new Date(year, month - 1, 1).toLocaleString(LOCALE, {
		month: "long",
		year: "numeric",
	});

	const startingList = selectedAccountId
		? accounts.filter((a) => a.id === selectedAccountId)
		: accounts;
	const starting = startingList.reduce((s, a) => s + a.starting_balance, 0);
	const monthPnl = monthSummary?.net_pnl ?? grid.monthTotal;
	const monthPct = starting > 0 ? (monthPnl / starting) * 100 : null;

	const hasAnyPnl = Object.keys(dailyPnl).some((key) => {
		const [y, m] = key.split("-").map(Number);
		return y === year && m === month;
	});

	return (
		<div className="flex flex-col gap-4">
			<Panel>
				{/* Header: month nav + stats */}
				<div
					className="flex items-center gap-3 flex-wrap px-4 py-3"
					style={{ borderBottom: "1px solid var(--color-border)" }}
				>
					<button
						type="button"
						onClick={onPrevMonth}
						aria-label="Previous month"
						style={navBtnStyle()}
					>
						<ChevronLeft size={14} strokeWidth={1.5} />
					</button>
					<span
						className="text-sm font-semibold tabular-nums"
						style={{ color: "var(--color-text)", minWidth: 110 }}
					>
						{monthLabel}
					</span>
					<button
						type="button"
						onClick={onNextMonth}
						aria-label="Next month"
						style={navBtnStyle()}
					>
						<ChevronRight size={14} strokeWidth={1.5} />
					</button>
					<button
						type="button"
						onClick={onToday}
						style={{
							...navBtnStyle(),
							width: "auto",
							padding: "0 10px",
							fontSize: 12,
							fontFamily: "var(--font-ui)",
						}}
					>
						Today
					</button>

					<div className="ml-auto flex items-center gap-5 flex-wrap">
						{monthSummary && (
							<>
								<HeaderStat label="Trades">
									{monthSummary.total_trades}
								</HeaderStat>
								<HeaderStat label="Win rate">
									{fmtPct(monthSummary.win_rate, LOCALE)}
								</HeaderStat>
								<div className="flex items-baseline gap-1.5">
									<span
										className="text-xs"
										style={{ color: "var(--color-text-muted)" }}
									>
										Record
									</span>
									<span
										className="text-xs font-semibold tabular-nums"
										style={{ color: "var(--color-pos)" }}
									>
										{monthSummary.wins}W
									</span>
									<span
										className="text-xs font-semibold tabular-nums"
										style={{ color: "var(--color-neg)" }}
									>
										{monthSummary.losses}L
									</span>
								</div>
								<HeaderStat label="Profit factor">
									{monthSummary.profit_factor === 0
										? "-"
										: monthSummary.profit_factor.toFixed(2)}
								</HeaderStat>
							</>
						)}
						<div className="flex items-baseline gap-1.5">
							<span
								className="text-xs"
								style={{ color: "var(--color-text-muted)" }}
							>
								Month P&L:
							</span>
							<span
								className={`text-xs font-bold tabular-nums ${pnlColor(monthPnl)}`}
							>
								{fmtSignedMoney(monthPnl, currency, LOCALE)}
								{monthPct != null && ` (${monthPct.toFixed(1)}%)`}
							</span>
						</div>
					</div>
				</div>

				{/* Grid */}
				{dailyLoading ? (
					<Skeleton height="420px" className="m-4" />
				) : dailyError ? (
					<p className="p-4 text-xs" style={{ color: "var(--color-neg)" }}>
						Failed to load daily P&L.
					</p>
				) : (
					<div className="p-4">
						{/* DOW header row + WEEK header */}
						<div
							className="grid gap-1 mb-1"
							style={{ gridTemplateColumns: "repeat(7, 1fr) 96px" }}
						>
							{DOW_HEADERS.map((d) => (
								<div
									key={d}
									className="text-center text-[10px] font-semibold tracking-wide py-1"
									style={{ color: "var(--color-text-muted)" }}
								>
									{d}
								</div>
							))}
							<div
								className="text-center text-[10px] font-semibold tracking-wide py-1"
								style={{ color: "var(--color-text-muted)" }}
							>
								WEEK
							</div>
						</div>

						{/* Week rows */}
						{grid.weeks.map((week, wi) => {
							const ws = weeks[wi];
							// Hide fully-empty trailing rows (6-row fixed grid)
							if (week.every((c) => c == null)) return null;
							return (
								<div
									// biome-ignore lint/suspicious/noArrayIndexKey: calendar rows are positional
									key={wi}
									className="grid gap-1 mb-1"
									style={{ gridTemplateColumns: "repeat(7, 1fr) 96px" }}
								>
									{week.map((cell, di) => {
										if (!cell) {
											// biome-ignore lint/suspicious/noArrayIndexKey: calendar cells are positional
											return <div key={di} style={{ minHeight: 84 }} />;
										}
										const dayNum = Number(cell.date.slice(8, 10));
										const hasPnl = cell.pnl != null;
										const rec = records[cell.date];
										const isSelected = selectedDay === cell.date;
										const isToday = cell.date === today;
										return (
											<button
												// biome-ignore lint/suspicious/noArrayIndexKey: calendar cells are positional
												key={di}
												type="button"
												onClick={() =>
													hasPnl
														? onSelectDay(isSelected ? null : cell.date)
														: undefined
												}
												aria-label={
													hasPnl
														? `${cell.date} ${fmtSignedMoney(cell.pnl!, currency, LOCALE)}`
														: cell.date
												}
												className="flex flex-col rounded-lg text-left"
												style={{
													minHeight: 84,
													padding: "6px 8px",
													background: hasPnl
														? dayBg(cell.pnl!)
														: "var(--color-surface-raised)",
													border: isSelected
														? "1px solid var(--color-accent)"
														: "1px solid transparent",
													cursor: hasPnl ? "pointer" : "default",
													position: "relative",
													transition: "border-color var(--duration-fast)",
												}}
											>
												<span
													className="text-[11px] font-medium"
													style={{
														color: hasPnl
															? dayColor(cell.pnl!)
															: "var(--color-text-muted)",
													}}
												>
													{dayNum}
												</span>
												{isToday && (
													<span
														data-testid="today-dot"
														style={{
															position: "absolute",
															top: 8,
															right: 8,
															width: 6,
															height: 6,
															borderRadius: 999,
															background: "var(--color-accent)",
														}}
													/>
												)}
												{hasPnl && (
													<span
														className="flex flex-col items-center justify-center flex-1 gap-0.5"
														style={{ color: dayColor(cell.pnl!) }}
													>
														<span className="text-sm font-bold tabular-nums">
															{fmtSignedMoney(cell.pnl!, currency, LOCALE)}
														</span>
														{rec && (
															<span className="text-[10px] tabular-nums opacity-90">
																{fmtRecord(rec.wins, rec.losses)}
															</span>
														)}
													</span>
												)}
											</button>
										);
									})}

									{/* WEEK summary cell */}
									<div
										className="flex flex-col items-center justify-center rounded-lg gap-0.5"
										style={{
											minHeight: 84,
											background: ws.hasData
												? dayBg(ws.pnl)
												: "var(--color-surface-raised)",
											color: ws.hasData
												? dayColor(ws.pnl)
												: "var(--color-text-muted)",
										}}
									>
										{ws.hasData ? (
											<>
												<span className="text-sm font-bold tabular-nums">
													{fmtSignedMoney(ws.pnl, currency, LOCALE)}
												</span>
												<span className="text-[10px] tabular-nums opacity-90">
													{fmtRecord(ws.wins, ws.losses)}
												</span>
											</>
										) : (
											<span className="text-xs">-</span>
										)}
									</div>
								</div>
							);
						})}

						{!hasAnyPnl && (
							<div className="flex items-center justify-center py-6">
								<EmptyState
									title="No trades this month"
									hint="Navigate to a month with trades to see the P&L heatmap."
									icon={<CalendarDays size={32} strokeWidth={1.5} />}
								/>
							</div>
						)}
					</div>
				)}
			</Panel>

			{/* Day drill-in */}
			{selectedDay && (
				<Panel
					title={`Trades - ${new Date(`${selectedDay}T00:00:00`).toLocaleDateString(
						LOCALE,
						{
							weekday: "short",
							month: "short",
							day: "numeric",
							year: "numeric",
						},
					)}`}
					right={
						<button
							type="button"
							onClick={() => onSelectDay(null)}
							className="text-[11px]"
							style={{
								color: "var(--color-text-muted)",
								background: "none",
								border: "none",
								cursor: "pointer",
							}}
						>
							Close
						</button>
					}
				>
					{dayTradesLoading ? (
						<Skeleton height="120px" className="m-4" />
					) : dayTradesError ? (
						<p className="p-4 text-xs" style={{ color: "var(--color-neg)" }}>
							Failed to load trades.
						</p>
					) : dayTrades.length === 0 ? (
						<EmptyState title="No trades on this day" />
					) : (
						<div style={{ maxHeight: 280 }}>
							<DataTable
								columns={tradeColumns(currency, onSelectTrade)}
								data={dayTrades}
								onRowClick={onSelectTrade}
							/>
						</div>
					)}
				</Panel>
			)}
		</div>
	);
}
```

- [ ] **Step 4: Update `src/routes/calendar.tsx`**

Replace the whole file:

```tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarView } from "../app/screens/CalendarView";
import { buildDayRecords } from "../lib/calendar";
import { useFilterParams, useFilters } from "../lib/filters";
import { useAccounts } from "../lib/hooks/useAccounts";
import { useDailyPnl, useSummary } from "../lib/hooks/useAnalytics";
import { useTrades } from "../lib/hooks/useTrades";

export const Route = createFileRoute("/calendar")({
	component: CalendarPage,
});

function monthRange(year: number, month: number) {
	const pad = (n: number) => String(n).padStart(2, "0");
	const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
	return {
		from: `${year}-${pad(month)}-01T00:00:00Z`,
		to: `${year}-${pad(month)}-${pad(lastDay)}T23:59:59Z`,
	};
}

function CalendarPage() {
	const filters = useFilterParams();
	const accountId = useFilters((s) => s.accountId);
	const accountsQ = useAccounts();
	const navigate = useNavigate();

	const now = new Date();
	const [year, setYear] = useState(now.getFullYear());
	const [month, setMonth] = useState(now.getMonth() + 1);
	const [selectedDay, setSelectedDay] = useState<string | null>(null);

	const dailyQ = useDailyPnl(filters);

	// Month-scoped stats + records
	const range = monthRange(year, month);
	const monthFilters = { ...filters, from: range.from, to: range.to };
	const monthSummaryQ = useSummary(monthFilters);
	const monthTradesQ = useTrades(monthFilters);
	const records = buildDayRecords(monthTradesQ.data ?? []);

	// Day drill-in
	const dayFilters = selectedDay
		? {
				...filters,
				from: `${selectedDay}T00:00:00Z`,
				to: `${selectedDay}T23:59:59Z`,
			}
		: {
				account_id: undefined,
				from: undefined,
				to: undefined,
				symbol: undefined,
			};
	const dayTradesQ = useTrades(dayFilters);

	const accounts = accountsQ.data ?? [];
	const currency =
		accounts.find((a) => a.id === accountId)?.base_currency ?? "USD";

	function shiftMonth(delta: number) {
		const d = new Date(year, month - 1 + delta, 1);
		setYear(d.getFullYear());
		setMonth(d.getMonth() + 1);
		setSelectedDay(null);
	}

	return (
		<CalendarView
			dailyPnl={dailyQ.data ?? {}}
			dailyLoading={dailyQ.isLoading}
			dailyError={dailyQ.isError}
			records={records}
			monthSummary={monthSummaryQ.data}
			accounts={accounts}
			selectedAccountId={accountId}
			year={year}
			month={month}
			onPrevMonth={() => shiftMonth(-1)}
			onNextMonth={() => shiftMonth(1)}
			onToday={() => {
				setYear(now.getFullYear());
				setMonth(now.getMonth() + 1);
				setSelectedDay(null);
			}}
			selectedDay={selectedDay}
			onSelectDay={setSelectedDay}
			dayTrades={selectedDay ? (dayTradesQ.data ?? []) : []}
			dayTradesLoading={selectedDay ? dayTradesQ.isLoading : false}
			dayTradesError={selectedDay ? dayTradesQ.isError : false}
			currency={currency}
			onSelectTrade={(t) =>
				navigate({ to: "/trades/$id", params: { id: t.id } })
			}
		/>
	);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test src/app/screens/CalendarView.test.tsx && pnpm test`
Expected: calendar tests PASS; full suite PASS.

- [ ] **Step 6: Lint and commit**

```bash
pnpm lint --write .
git add src/app/screens/CalendarView.tsx src/app/screens/CalendarView.test.tsx src/routes/calendar.tsx
git commit -m "feat(web): calendar redesign - stats header, tinted day cells, WEEK column"
```

---

### Task 14: Trades view on shared columns + login polish + hardcoded-color sweep

**Files:**
- Modify: `src/app/screens/TradesView.tsx`
- Modify: `src/app/screens/TradesView.test.tsx`
- Modify: `src/app/screens/LoginScreen.tsx` (wordmark block only)
- Modify: any file still using pre-redesign hex values (sweep)

**Interfaces:**
- Consumes: `tradeColumns` (Task 8).
- Produces: `TradesViewProps` unchanged (`trades, loading, error, currency, symbol, onSymbolChange, onSelectTrade`).

- [ ] **Step 1: Update `src/app/screens/TradesView.tsx` to use shared columns**

Delete the local `columns(currency)` function and the `fmtDate` helper and their now-unused imports (`ColumnDef`, `pnlColor`, `fmtSignedMoney`). Add `import { tradeColumns } from "../../components/tradeColumns";`. In the render, replace:

```tsx
					<DataTable
						columns={columns(currency)}
						data={trades}
						onRowClick={(t) => onSelectTrade(t.id)}
					/>
```

with:

```tsx
					<DataTable
						columns={tradeColumns(currency, (t) => onSelectTrade(t.id))}
						data={trades}
						onRowClick={(t) => onSelectTrade(t.id)}
					/>
```

Everything else in the file (toolbar, props, empty/loading states) stays.

- [ ] **Step 2: Update `src/app/screens/TradesView.test.tsx`**

Open the existing test file. Update any assertion that referenced the old column set (e.g. header texts `Symbol`, `Type`, `Opened`, `Closed`, `Net P&L`, `Tags`, or `LONG` direction text) to the new one. New reliable assertions: header `SYMBOL`, header `RETURN`, a rendered symbol cell, and a WIN pill for a winning trade. Example replacement for a column assertion block:

```tsx
expect(screen.getByText("SYMBOL")).toBeInTheDocument();
expect(screen.getByText("RETURN %")).toBeInTheDocument();
expect(screen.getByText("WIN")).toBeInTheDocument();
```

Keep the test's existing fixtures and interaction tests (row click → `onSelectTrade`, symbol filter input) — those behaviors are unchanged.

- [ ] **Step 3: Login wordmark**

In `src/app/screens/LoginScreen.tsx`, replace the wordmark `div` (the one containing only the text `TraderMemos`):

```tsx
				<div
					className="flex items-center gap-2 font-semibold"
					style={{ color: "var(--color-text)", marginBottom: 4 }}
				>
					<CandlestickChart
						size={18}
						strokeWidth={2}
						style={{ color: "var(--color-accent)" }}
					/>
					TraderMemos
				</div>
```

and add `import { CandlestickChart } from "lucide-react";` at the top. Also change the submit button's text color from `#0b0e14` to `#0e1218` (matches the new accent-button convention used in the drawers).

- [ ] **Step 4: Hardcoded color sweep**

Run: `grep -rn "#0b0e14\|#11151f\|#161b27\|#1d2330" src/ --include="*.tsx" --include="*.ts"`
For each hit (excluding `styles.css`, already redone): replace with the equivalent token — `#0b0e14`→`var(--color-surface-base)` (or `#0e1218` when used as text-on-accent), `#11151f`→`var(--color-surface-panel)`, `#161b27`→`var(--color-surface-hover)` or `var(--color-surface-raised)` (raised for card/input backgrounds), `#1d2330`→`var(--color-border)`. Also check `src/components/ChartFrame.tsx`'s `chartTheme` — if its grid/tooltip colors are hardcoded to the old palette, update them to the new hex values from Task 1 (`gridColor` → `#262e3d`, tooltip bg → `#1e2430`, border → `#262e3d`).

- [ ] **Step 5: Run the full suite and build**

Run: `pnpm test && pnpm build`
Expected: PASS / build succeeds.

- [ ] **Step 6: Lint and commit**

```bash
pnpm lint --write .
git add -A src/
git commit -m "feat(web): trades view on shared columns, login logo, token sweep"
```

---

### Task 15: E2E update + final verification

**Files:**
- Modify: `e2e/smoke.spec.ts`

**Interfaces:**
- Consumes: everything above; running API on :8080 with the seeded e2e user (see `playwright.config.ts` header comment; the dev server is started by Playwright).

- [ ] **Step 1: Update `e2e/smoke.spec.ts` for the new UI and add the drawer flow**

Replace the whole file:

```ts
import { expect, test } from "@playwright/test";

const EMAIL = process.env.E2E_EMAIL ?? "demo@tradermemos.app";
const PASSWORD = process.env.E2E_PASSWORD ?? "hunter2";

test("login -> dashboard -> calendar -> trades -> detail -> stats", async ({
	page,
}) => {
	await page.goto("/dashboard");
	await page.evaluate(() => localStorage.removeItem("tm_token"));
	await page.reload();

	// Login screen.
	await expect(page.getByText("Sign in to your journal")).toBeVisible();
	await page.locator("#email").fill(EMAIL);
	await page.locator("#password").fill(PASSWORD);
	await page.getByRole("button", { name: "Sign in" }).click();

	// Dashboard: stats strip + range control.
	await expect(page.getByText(/WINS/).first()).toBeVisible();
	await expect(page.getByText(/LOSSES/).first()).toBeVisible();
	await expect(page.getByRole("button", { name: "30D" })).toBeVisible();

	// Calendar: month stats header + WEEK column.
	await page.getByRole("link", { name: "Calendar" }).click();
	await expect(page.getByText("WEEK")).toBeVisible();
	await expect(page.getByRole("button", { name: "Today" })).toBeVisible();

	// Trades log -> open a trade -> detail.
	await page.getByRole("link", { name: "Trades" }).click();
	await expect(page.getByText(/\d+ trades/)).toBeVisible();
	await page.locator("tbody tr").first().click();
	await expect(page.getByText("Back to trades")).toBeVisible();

	// Stats (reports).
	await page.getByRole("link", { name: "Stats" }).click();
	await expect(page.getByText("REPORTS")).toBeVisible();
});

test("new trade drawer logs a trade", async ({ page }) => {
	await page.goto("/dashboard");
	await page.evaluate(() => localStorage.removeItem("tm_token"));
	await page.reload();
	await page.locator("#email").fill(EMAIL);
	await page.locator("#password").fill(PASSWORD);
	await page.getByRole("button", { name: "Sign in" }).click();
	await expect(page.getByText(/WINS/).first()).toBeVisible();

	// Open the drawer from the sidebar quick action.
	await page.getByRole("button", { name: "New Trade" }).click();
	await expect(page.getByText("Log any trade you've entered")).toBeVisible();

	const symbol = `E2E${Date.now() % 10000}`;
	await page.getByLabel("Symbol").fill(symbol);
	await page.getByLabel("Qty row 1").fill("5");
	await page.getByLabel("Price row 1").fill("10.50");
	await page.getByRole("button", { name: "Save" }).click();

	// Drawer closes and the trade shows up in the dashboard table.
	await expect(page.getByText("Log any trade you've entered")).toBeHidden();
	await expect(page.getByText(symbol)).toBeVisible();
});
```

Note for the reviewer: the reports screen keeps its `REPORTS` panel title (only the nav label changed to "Stats"). If `TradeDetailView` no longer says "Back to trades" (it was not modified — it does), adjust the assertion to what the detail page renders.

- [ ] **Step 2: Run e2e (requires the API stack)**

Start the stack from the repo root (`docker-compose.yml` provides the API; or run the API directly), then:

Run: `pnpm e2e`
Expected: 2 tests PASS. If no API is available in this environment, run `pnpm exec playwright test --list` to at least validate the spec compiles, note the skipped verification in the commit message, and flag it in your report.

- [ ] **Step 3: Full final verification**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: lint clean, all unit tests PASS, production build succeeds.

- [ ] **Step 4: Commit**

```bash
git add e2e/smoke.spec.ts
git commit -m "test(web): e2e smoke updated for redesign + new trade drawer flow"
```

---

## Self-Review Notes

- **Spec coverage:** tokens (T1), primitives (T3), Drawer+store (T4), calendar math (T5), executions flow (T6, T9), header P&L (T7, T11), table columns (T8), sidebar/header shell (T11), dashboard (T12), calendar screen (T13), remaining screens restyle via tokens + trades/login sweep (T14), tests kept green throughout, e2e (T15). Help nav item deliberately omitted (Global Constraints) — spec deviation agreed: no docs URL exists.
- **Type consistency:** `DrawerKind`, `ExecutionBody`, `ExecutionBatchError.failures: { index, message }[]`, `DayRecord`, `WeekSummary`, `HeaderStats`, `tradeColumns(currency, onView)` used identically across tasks.
- **Known judgment points for implementers:** Base UI Dialog RC API naming (`Dialog.Popup` etc.) — if a rename occurred in `1.0.0-rc.0`, check `node_modules/@base-ui-components/react/` exports and adjust; test assertions pin behavior, not markup.
