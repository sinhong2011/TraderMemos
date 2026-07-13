# Design System — TraderMemos

**Direction:** Signal Terminal  
**Created:** 2026-07-10 via design-consultation  
**Preview:** `~/.gstack/projects/TraderMemos/designs/design-system-20260710/preview-signal-terminal.html`

## Product Context

- **What this is:** Self-hosted trading journal with dashboard, P&L calendar, trade log, playbook, reports, and CSV import.
- **Who it's for:** Active self-directed traders who review performance daily (hours at the screen).
- **Space/industry:** Trading journals (TradeZella, TraderSync, Stonk Journal) — differentiated by self-hosted sovereignty and bold 2026 terminal aesthetic.
- **Project type:** Data-dense web app / dashboard (not marketing site).

## Memorable Thing

**Electric precision — my P&L glows on the grid.**

Every layout, color, and motion choice serves that feeling: serious tool, engineered craft, screenshot-worthy without being decorative slop.

## Aesthetic Direction

- **Direction:** Signal Terminal — Raycast/Linear-grade dark precision + neo-brutalist data density + subtle cinematic grain.
- **Decoration level:** Intentional (dot grid, film grain, inner glow on hero metrics) — never card soup or gradient hero blobs.
- **Mood:** Fast, engineered, electric. Numbers are the hero. Chrome stays quiet until it signals (accent, signal yellow).
- **Reference influences:** Linear (micro-states, optical spacing), Raycast (grid, glow, dark premium), 2026 neo-brutalist bento dashboards (asymmetric stats, step charts), Muzli dark-mode elevation ladder.

### Deliberate departures from category norms

1. **Asymmetric bento dashboard** instead of uniform widget cards (TradeZella pattern).
2. **Glowing hero P&L + step/bar equity** instead of soft area chart in a rounded card.
3. **Dot grid + grain on void** instead of flat slate panels.
4. **Acid signal yellow** for wayfinding (labels, kbd hints) — not used on P&L.

### Safe category baseline (keep)

- Dark default, green/red P&L semantics, left nav (icon rail), global date/account filters.
- Virtualized trade table, calendar heatmap, playbook, import flow.

## Typography

| Role | Font | Notes |
|------|------|-------|
| **All UI** | General Sans (400/500/600/700) | Load via Fontshare. Tight tracking on headings (`-0.02em` to `-0.04em`). |
| **Numbers** | General Sans + `tabular-nums` | Applied globally; keeps columns aligned without a separate mono face. |

**Do not use:** Inter, Geist, Roboto, system-ui as primary UI face (reads as generic 2024 SaaS). No monospace fonts in the product UI.

### Type scale (compact density)

| Token | Size | Use |
|-------|------|-----|
| `text-hero` | 32px | Header net P&L |
| `text-stat` | 28px | Bento big numbers |
| `text-title` | 14–16px | Section titles |
| `text-body` | 14px | Default UI |
| `text-label` | 11–12px | Uppercase labels, `0.08–0.12em` tracking |
| `text-micro` | 10px | Table headers, pill text |

## Color

- **Approach:** Restrained accent + electric signal + semantic P&L. No purple gradient heroes.

### Surfaces (elevation ladder — +8% luminance per step)

| Token | Hex | Use |
|-------|-----|-----|
| `--color-bg` | `#09090b` | App void, rail |
| `--color-bg-elevated` | `#111114` | Sidebar, table header |
| `--color-bg-panel` | `#16161a` | Bento cells, panels |
| `--color-bg-hover` | `#1c1c22` | Row hover, active |
| `--color-bg-inset` | `#060608` | Chart wells, inputs |

### Structure

| Token | Value |
|-------|-------|
| `--color-border` | `rgba(255,255,255,0.08)` |
| `--color-border-strong` | `rgba(255,255,255,0.14)` |
| `--color-grid` | `rgba(255,255,255,0.03)` |

### Text

| Token | Hex |
|-------|-----|
| `--color-text` | `#fafafa` |
| `--color-text-muted` | `#71717a` |
| `--color-text-dim` | `#52525b` |

### Accent & signal

| Token | Hex | Use |
|-------|-----|-----|
| `--color-accent` | `#a78bfa` | Links, active nav, symbol column, focus ring |
| `--color-accent-glow` | `rgba(167,139,250,0.35)` | Hero glow, active rail |
| `--color-accent-bg` | `rgba(167,139,250,0.12)` | Selected states |
| `--color-signal` | `#e4ff1a` | Wayfinding labels, kbd hints, section tags — **never on P&L** |

### Semantic P&L

| Token | Hex |
|-------|-----|
| `--color-profit` | `#4ade80` |
| `--color-loss` | `#fb7185` |
| `--color-flat` | `#71717a` |

P&L text may use subtle glow on hero figure only: `text-shadow: 0 0 40px rgba(74,222,128,0.35)`.

### Background treatment

- Dot grid: 24px cells, `--color-grid`.
- Film grain: fixed pseudo-element, ~4% opacity, `pointer-events: none`.
- Radial washes: accent at 20% 0%, profit at 80% 100%, very low opacity.

## Spacing

- **Base unit:** 4px
- **Density:** Compact (cockpit)
- **Scale:** 1(4) · 2(8) · 3(12) · 4(16) · 5(20) · 6(24) · 8(32) · 12(48)
- **Table row height:** 40px (virtualized)
- **Icon rail width:** 52px; icons ≥18px; hit targets ≥36px; tooltips on hover

## Layout

- **Approach:** Grid-disciplined + asymmetric bento
- **Shell:** Icon rail + main column (no 260px text sidebar by default)
- **Header:** 52px — hero P&L, inline chips (WR, PF), `⌘K` search, date filter
- **Icon rail:** 52px wide; icons ≥18px; hit targets ≥36px
- **Dashboard bento:** CSS grid, 1px gap hairlines, one tall equity cell + stat cells — **not equal card grid**
- **Tables:** Full width, no nested Panel wrappers
- **Max content width:** None (use horizontal space)

### Border radius (tiered — locked)

| Element | Radius |
|---------|--------|
| Bento cells, tables, app shell | `0–3px` (`--radius-sharp: 3px`) |
| Buttons, inputs, pills, badges | `6px` (`--radius-control: 6px`) |
| Drawers, modals, toasts | `8–10px` (`--radius-overlay: 10px`) |
| Dots, avatars | `9999px` |

**Rule:** Never uniform `12px` on everything. Data sharp, controls soft.

### Shadows

- **Data panels:** Prefer 1px borders + elevation ladder, not drop shadows.
- **App shell / marketing moments:** Hard offset optional: `4px 4px 0 #000` (neo-brutalist, use sparingly — dashboard outer frame only).

## Motion

- **Approach:** Minimal-functional
- **Easing:** `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out)
- **Duration:** micro 100ms · short 150ms · medium 250ms
- **Allowed:** drawer slide, row hover bg, focus ring, skeleton shimmer
- **Forbidden:** scroll hijack, parallax, infinite decorative loops
- **Reduced motion:** collapse to instant / opacity-only

## Components

Build a **Signal** kit on existing stack — do **not** install default shadcn theme.

| Layer | Choice |
|-------|--------|
| Primitives | `@base-ui-components/react` (already installed) |
| Styling | Tailwind v4 + CSS variables in `web/src/styles.css` |
| Variants | CVA for Button, Badge, Pill, Input |
| Icons | Lucide 16px, stroke 1.5, default `--color-text-dim` |

### Required components (replace inline styles)

- `SignalShell` — grid bg, grain, rail + outlet
- `SignalHeader` — hero P&L, chips, cmd search
- `SignalBento` + `SignalBentoCell`
- `SignalTable` — dense table styling
- `SignalBadge` — bordered mono pills (WIN/LOSS/OPEN)
- `SignalChartWell` — inset well, step/bar or monochrome line
- `SignalDrawer` — right slide-over, overlay radius

### Migration order

1. Replace `:root` tokens in `styles.css` (delete Stonk sampling)
2. Build Signal primitives
3. Rebuild shell (rail + header)
4. Dashboard bento + table
5. Calendar, trades, detail, remaining screens

## Anti-patterns (do not ship)

- Stonk Journal blue `#4fa5ff` palette clone
- `--surface-base` === `--surface-panel` (flat slab)
- Inline `style={{}}` on layout components
- Duplicate P&L in header AND dashboard hero without hierarchy
- Rounded card grid with identical padding (AI slop)
- Purple gradient text on marketing-style heroes inside app
- Serif body text in tables

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-10 | Signal Terminal direction approved | User rejected "normal" Apogee Ledger; wanted 2026 standout (Linear/Raycast/brutalist) |
| 2026-07-10 | Tiered radius (sharp data, soft controls) | Brutalist edge without harsh daily use on inputs |
| 2026-07-10 | General Sans + IBM Plex Mono | Distinct from Geist/Inter; mono for all numeric data |
| 2026-07-11 | JetBrains Mono Variable (Fontsource) | Replaces IBM Plex static; single variable file, sharper terminal read at 10–11px |
| 2026-07-10 | Violet accent + signal yellow | Ownable vs category blue; yellow for wayfinding only |
