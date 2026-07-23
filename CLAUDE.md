# TraderMemos

Self-hosted trading journal (Go API + React web + planned Expo mobile).

## Design System

Always read `DESIGN.md` before making any visual or UI decisions.

All font choices, colors, spacing, radius tiers, and aesthetic direction are defined there.

Do not deviate without explicit user approval.

In QA mode, flag any code that doesn't match `DESIGN.md`.

Current direction: **Signal Terminal** (2026-07-10).

## User preferences

- **Borderless design** — avoid decorative borders on shell, page surfaces, list rows, and section dividers. Use unified `bg-bg` void, spacing, typography, and hover states to separate regions. Reserve borders for interactive controls (inputs, buttons, chips) and overlays (popovers, modals) where affordance needs them.
- **Card blocks** — wrap each page section in `Card` inside a `Page` wrapper (`gap-4` on void `bg-bg`). One card per logical block (equity, stats, table, settings section, etc.). Cards use borderless `bg-bg-panel` elevation, not box borders.

## Web toolchain (Vite+)

The `web/` app uses [Vite+](https://viteplus.dev/guide/) — unified dev, build, test, lint, and format via the `vp` CLI.

- Run commands from `web/` (or use `make` targets at the repo root).
- After pulling: `cd web && vp install`
- Validate changes: `vp check` and `vp test`
- Pre-commit hooks run `vp staged` on staged web files (`.vite-hooks/` at repo root).
- Node version is pinned in `web/.node-version` (24.18.0 LTS); pnpm 11 via `packageManager` + `scripts/ensure-pnpm.sh`.
