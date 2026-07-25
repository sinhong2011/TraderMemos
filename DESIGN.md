# Design System — TraderMemos

**Direction:** shadcn/ui (neutral base)  
**Updated:** 2026-07-24

## Product Context

- **What this is:** Self-hosted trading journal with dashboard, P&L calendar, trade log, playbook, reports, and CSV import.
- **Who it's for:** Active self-directed traders who review performance daily.
- **Project type:** Data-dense web app / dashboard.

## Aesthetic Direction

- **Direction:** [shadcn/ui](https://ui.shadcn.com) design principles — semantic tokens, light/dark via `.dark`, Base UI primitives.
- **Decoration:** Minimal. Prefer spacing, typography, and muted/accent surfaces over custom chrome (no grain, grid void, or hard neo-brutalist shadows).
- **Mood:** Calm, readable, product-neutral. Numbers stay clear; chrome stays quiet.

### Category baseline

- Dark default (ThemeProvider), green/red P&L via domain tokens, left nav, global date/account filters.
- Virtualized trade table, calendar heatmap, playbook, import flow.

## Typography

| Role | Font | Notes |
|------|------|-------|
| **All UI** | Poppins → `font-sans` | `@fontsource/poppins`. Fallback: system UI stack. |
| **Numbers** | Poppins + `tabular-nums` | Applied globally in `@layer base`. |

## Color

Tokens live in `web/src/global.css` (`:root` / `.dark`) and are exposed with `@theme inline` per shadcn Tailwind v4.

### Semantic (shadcn)

`background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`, `chart-1`…`chart-5`, `sidebar-*`.

Use utilities like `bg-background`, `text-muted-foreground`, `bg-primary`, `bg-card`, `bg-accent` (hover/selected surface — **not** brand fill).

Brand / high-emphasis actions → `primary` / `primary-foreground`.

### Domain extensions (trading)

Added with the same pattern as [shadcn “Adding New Tokens”](https://ui.shadcn.com/docs/theming#adding-new-tokens):

| Token | Use |
|-------|-----|
| `profit` | Positive P&L text/fills (`text-profit`, `bg-profit/10`) |
| `loss` | Prefer `destructive` for errors; `loss` aliases P&L red where distinct |
| `flat` | Zero / flat P&L |

### Semantic extensions (ReUI)

ReUI alerts/badges also use: `info`, `success`, `warning`, `invert`, and `destructive-foreground` (see https://reui.io/docs/styling). Keep domain `profit` / `loss` / `flat` for P&L; use ReUI `success` / `destructive` for UI chrome states.

## Spacing & radius

- Prefer Tailwind spacing scale.
- `--radius: 0.625rem` with shadcn derived `rounded-sm`…`rounded-4xl`. Prefer `rounded-md` / `rounded-lg` on controls and cards.

## Motion

- Short transitions (150ms), ease-out.
- Honor `prefers-reduced-motion`.

## Components

| Layer | Choice |
|-------|--------|
| Primitives | `@base-ui/react` |
| Styling | Tailwind v4 + CSS variables in `web/src/global.css` |
| Config | `web/components.json` (`style: base-nova`, registry `@reui`) |
| Variants | CVA |
| Icons | Lucide |
| Extended UI | [ReUI](https://reui.io/docs) → `web/src/components/reui/` |

Add UI with the CLI from `web/`:

```bash
pnpm dlx shadcn@latest add <component>
pnpm dlx shadcn@latest add @reui/<name> --yes
```

Floating overlays (popover, select, menu, tooltip) use `bg-popover` / `text-popover-foreground` via `overlay-styles.ts` — not `bg-accent` or Signal-era hardcoded shadows.

### Layout wrappers

- `<Page>` — route padding on `bg-background`
- `<Card>` — `bg-card`, optional title/action; `flush` for tables

## Anti-patterns

- Signal Terminal leftovers: `bg-bg`, `text-text`, `rounded-control`, `signal-app`, grain/grid voids, hard offset shadows, acid signal yellow wayfinding.
- Hardcoded purple/green rgba instead of theme tokens.
- Treating `bg-accent` as brand fill (that’s hover/muted surface in shadcn).

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-10 | Signal Terminal | Early product identity |
| 2026-07-24 | Adopt shadcn theme system | Align with Base UI + CLI ecosystem; light/dark; remove custom Signal token surface |
| 2026-07-24 | Integrate ReUI registry | Free Base UI components/examples + Cursor MCP/skill; premium via license key |
