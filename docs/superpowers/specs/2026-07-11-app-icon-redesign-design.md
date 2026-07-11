# App Icon Redesign — T Monogram

**Date:** 2026-07-11
**Status:** Approved (concept + design approved by user via option selection)
**Direction:** Signal Terminal (see `DESIGN.md`)

## Problem

The current mark (pen + journal line + ascending bars) is a mashup of competitor
patterns (TradeZella pen, Tradervue bars) and turns to mud at 16px. It says
nothing ownable about Signal Terminal.

## Approved concept (final, after iteration)

**"The T being typed"** — a glass-white **T** monogram with a detached
profit-green terminal **block cursor** at cap height, on a violet gradient
tile (`#b591ff → #8b5cf6 → #5426c9`), rendered Apple-HIG style: top light
source, extruded T with drop shadow, bottom vignette, film grain, and an
etched equity **step-line** climbing behind the T to the glowing cursor.
Green appears only in the cursor (the single signal state). Signal yellow is
excluded (wayfinding only, per DESIGN.md).

Iteration history: flat violet T + diagonal tick (rejected: lollipop read),
flat T + cap-height cursor on void (rejected: too flat), P3 simple gradient
tile (rejected: too simple) → **P4 "steps"** shipped 2026-07-11.

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
