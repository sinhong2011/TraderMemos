# Unified Roadmap

**Date:** 2026-08-08
**What this is:** the single sequencing view across the two active plans. The plans themselves hold the detail — this file only orders the work and records cross-plan decisions.

- [traderwaves-competitive-plan.md](traderwaves-competitive-plan.md) — product roadmap (importers, `tm-sync`, share pages, backtester, Monte Carlo, alerts, marketing)
- [mobile-monetization-plan.md](mobile-monetization-plan.md) — iOS pricing policy (free app + one-time Pro unlock; candidate features)
- Background: [competitive-day-trader-roadmap.md](competitive-day-trader-roadmap.md), [stonk-journal-v2-features.md](stonk-journal-v2-features.md)

**Governing decision (2026-08-08): finish all features first.** Everything ships unlocked (TestFlight during development); the free/Pro line is drawn last, before the first public App Store release. While building, each mobile Pro-candidate keeps a one-place `<ProGate>` seam (always-true for now) so the line needs no refactoring later.

---

## Waves

| Wave | Work | Source | Notes |
|---|---|---|---|
| **1** | cTrader / DXtrade / MatchTrader CSV presets · Public share pages · Monte Carlo on Reports | Competitive Plans 1A, 3, 5 | Cheap, independent, disjoint files — parallelizable across worktrees |
| **2** | MT4/MT5 statement parsers → `tm-sync` local watcher | Competitive Plans 1B–D, 2 | Parsers must land before the agent; Windows binaries matter most |
| **3** | Mobile natives: WidgetKit widgets → Live Activity (shared snapshot layer) · Siri / App Intents / Action Button · share card styles · Face ID lock · offline write queue | Monetization candidates 1–6 | Runs in parallel with Waves 1–2 (different surface). Offline queue: check overlap with the existing `feat/mobile-offline-ux` worktree first |
| **4** | Free-symbol replay (the backtester) | Competitive Plan 4 | Largest single item; paper-account flag first |
| **5** | Journal alerts (**free** — see decision below) · Portfolio mode across accounts · Marketing feature/comparison pages | Competitive Plans 6–8 | Alerts reuse `compliance.go` / prop / jobs; portfolio needs the currency decision first |
| **6** | Draw the free/Pro line → IAP plumbing (Paid Apps agreement, non-consumable, Restore Purchases, `<ProGate>` flips on) → **public App Store launch** | Monetization Phases 1–2 | The only wave with tier logic. ASC paperwork is the slow part — start the agreement/banking/tax forms early in Wave 5 |

Each work item gets a typed branch in `.claude/worktrees/<name>`; this repo is shared across sessions.

---

## Cross-plan decisions (resolved)

| Decision | Outcome | Where recorded |
|---|---|---|
| Push / journal alerts | **Free, never Pro** — TraderWaves gates alerts; we win by not gating. Only a TraderMemos-*operated* relay could ever be paid (and would justify a subscription) | Both plans |
| Sharing | Capability free everywhere (mobile cards + web public pages = growth loop); Pro is cosmetics only (card styles, mark removal) | Both plans |
| Free/Pro line timing | Deferred while building; settled before first public App Store release; grandfather anything that slips out free publicly | Monetization plan, Rules |

## Still open

1. Share pages: off-by-default server setting vs on-with-90-day-expiry (Competitive Plan 3)
2. Portfolio currency: convert via `/market/fx` vs block mixed-currency aggregation (Competitive Plan 6 — settle before it starts)
3. Which candidates go Pro (Wave 6) and price point $9.99 vs $14.99 (Monetization plan)
