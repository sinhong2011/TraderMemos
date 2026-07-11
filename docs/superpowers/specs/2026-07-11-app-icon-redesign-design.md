# App Icon Redesign — T Monogram

**Date:** 2026-07-11
**Status:** Approved (concept + design approved by user via option selection)
**Direction:** Signal Terminal (see `DESIGN.md`)

## Problem

The current mark (pen + journal line + ascending bars) is a mashup of competitor
patterns (TradeZella pen, Tradervue bars) and turns to mud at 16px. It says
nothing ownable about Signal Terminal.

## Approved concept

**Monogram T + profit tick.** A sharp geometric **T** (for TraderMemos) built
from heavy rectangular bars — terminal/mono character feel — in accent violet
`#a78bfa`. The stem's base kicks up-right into a diagonal profit tick that
terminates in a profit-green `#4ade80` node with a soft glow
(`rgba(74,222,128,0.35)`), the "my P&L glows on the grid" moment. Background is
the `#09090b` void with a subtle dot grid. Signal yellow is excluded (wayfinding
only, per DESIGN.md). Rejected alternatives: glowing step-equity line, terminal
cursor, refined pen mark.

## Deliverables

1. `web/src/components/AppLogo.tsx` — same props API (`size`, `className`,
   `showBackground`, `title`), new geometry using theme classes
   (`fill-accent`, `fill-profit`). Nav/login pick it up automatically.
2. `web/public/favicon.svg` — standalone hardcoded-color version, geometry
   tuned to survive 16px (coarse dot grid, no fine detail).
3. PNG icon set rendered from a 1024px master SVG:
   - `web/public/apple-touch-icon.png` (180×180, opaque)
   - `web/public/icon-192.png`, `web/public/icon-512.png`
   - `web/public/icon-maskable-512.png` (mark inset to 80% safe zone)
   - `web/public/manifest.webmanifest` + `index.html` links (`manifest`,
     `apple-touch-icon`, `theme-color #09090b`)
   - The 1024 master is kept in-repo as the source for the planned Expo app
     icon.

## Non-goals

- No wordmark/lockup changes, no marketing assets, no light-theme variant
  (app is dark-default).
