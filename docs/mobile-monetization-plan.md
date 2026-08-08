# Mobile Monetization Plan — Free App + Pro Unlock

**Date:** 2026-08-08
**Scope:** iOS App Store release of `mobile/`. Web and API are unaffected.
**Question:** the App Store needs an Apple Developer Program membership ($99/yr). Should the app be free, ad-supported, subscription, or paid?

Companion docs: [traderwaves-competitive-plan.md](traderwaves-competitive-plan.md) (product roadmap this pricing line must not undercut), [roadmap.md](roadmap.md) (unified sequencing across both plans).

---

## Decision

1. **Ship v1.0 completely free.** No ads, no paywall, no IAP plumbing.
2. **Add a one-time non-consumable "Pro" unlock later**, once the app has real users and at least one Pro-only feature exists.
3. **No ads. Ever.**
4. **No subscription** — unless and until TraderMemos runs an actual ongoing service (hosted instance or push relay). Then it prices itself.
5. **(2026-08-08) Build all candidate features first, unlocked.** The final free/Pro assignment is deferred until the candidate pool is real — but must be settled before the first *public* App Store release (see Sequencing and Rules).

---

## The constraint that decides everything

TraderMemos is **self-hosted**. The user runs the Go API. The AI features use the user's own OpenAI-compatible key, stored on the user's own server (`mobile/src/app/(tabs)/(settings)/ai.tsx` — *"keys stay on your server"*).

Two consequences:

- **Zero marginal cost per user.** No storage, no compute, no inference bill. Nothing about a new user costs money, so nothing forces a recurring charge.
- **Every server-side feature is already free in the web app they self-host.** Reports, Wrapped, replay, calculators — all of it ships in `web/` on the same server.

> **Rule: gate what the phone uniquely adds. Never gate what the server already does.**

Charging on mobile for a capability the user already owns on their own machine is a toll booth. It produces refund requests, one-star reviews, and — fairly — resentment from exactly the audience that self-hosts to avoid rent.

**Honest test for any candidate feature:** *would someone who already pays to run their own server feel cheated?* If yes, it stays free.

---

## Options considered

| Option | Verdict | Reasoning |
|---|---|---|
| **Ads** | **Rejected** | This is a private financial journal. An ad SDK means an ATT prompt, a "Data Used to Track You" section in the privacy nutrition labels, and a third party sitting beside someone's P&L. At realistic download volume it earns a few dollars a month — trading the app's entire "private, self-hosted, serious" positioning for less than the developer fee. |
| **Subscription** | **Deferred** | The user hosts the server; we deliver no ongoing service, no storage, no compute. There is no honest recurring-value story. Churn problem (people cancel once they see nothing breaks) and an App Review risk (3.1.2 expects subscriptions to provide ongoing value). Revisit only if a hosted tier or push relay ships. |
| **Paid up-front** | **Rejected** | Kills discovery, kills the self-hosted OSS story, and blocks the try-before-you-buy path a journal needs (users must connect a server before the app does anything). |
| **Free + one-time Pro unlock** | **Chosen** | Matches the audience: people who self-host a Go API pay once for a good tool and resent renting one. Additive, not subtractive. No ongoing obligation. |

---

## The math

The bar is much lower than it feels.

- Apple Developer Program: **$99/year**
- Small Business Program (under $1M/yr — we qualify): Apple takes **15%**, not 30%
- A $9.99 unlock nets **$8.49**

**≈ 12 buyers per year covers the membership.** A $14.99 unlock needs 8.

Conclusion: monetization is not a survival question. Treat the $99 as the cost of shipping, and Pro as a tip jar with real benefits. If this stays a portfolio/OSS project, free-forever is a perfectly good permanent answer — it also keeps tax forms, banking setup, and refund handling entirely off the plate.

---

## The free / Pro line

### Free forever — never gate

**Core loop.** Log, edit, and view trades; calendar and day sheet; trade details; notes; tags; dashboard; the Reports overview. If a free user cannot journal, the app is worthless and the reviews will say so.

**All of Settings — especially data and security.** `export-trades`, `data-backup`, `import-trades`, `two-factor`, `api-tokens`. Paywalling someone's own data export or their account security is the fastest route to a hostile review, and it contradicts the sovereignty pitch that makes TraderMemos worth self-hosting.

**Anything with a web equivalent** (see audit below).

### Pro

Mobile-only value only. Today that is one shipped feature plus a roadmap (below).

---

## Audit: what already exists

Checked `mobile/src/app/` against `web/src/routes/`.

| Feature | Mobile | Web equivalent | Verdict |
|---|---|---|---|
| Trade replay | `replay.tsx`, `replay-controls.tsx` | `web/src/components/charts/useReplayController.ts` | **Free** — parity |
| Year Wrapped | `(tabs)/(reports)/wrapped.tsx` | `web/src/routes/wrapped.tsx` | **Free** — parity |
| Reports (Detailed / Behavior / Risk / Win-Loss) | `components/reports/*` | `web/src/routes/reports.tsx` | **Free** — parity |
| Tools (Kelly, FX, position size, R calculator) | `tool-kelly.tsx`, `tool-fx.tsx`, `tool-position-size.tsx`, `r-calculator.tsx` | `web/src/routes/calculator.tsx` | **Free** — parity |
| Playbook, checklist, economic events | `playbook.tsx`, `checklist.tsx`, `economic-events.tsx` | `web/src/routes/playbook.tsx`, `events.tsx` | **Free** — parity |
| Vision scan import | `trade-scan-overlay.tsx` | server-side OCR (`api/internal/ocr`), `web/src/routes/import.tsx` | **Free** — this is data *in*; never gate it |
| AI coach | `coach-card.tsx` | `api/internal/coach` | **Free** — user's own key, user's own server |
| **Share cards** | `share-trade.tsx`, `components/share-card.tsx` | **none** | **Pro candidate** |

**Finding:** exactly one existing feature is a clean Pro candidate. Share cards are mobile-only, pure delight, hold no data hostage, and free-tier sharing markets the app.

Split (aligned with the competitive plan's Plan 3, public share pages): the share *capability* — cards on mobile, public pages on web — is free everywhere, because sharing is the growth loop. Pro is cosmetics only: extra card styles and removal of the small "TraderMemos" mark. The mark on free cards is the growth loop working, not a limitation.

One feature is not a tier. **Pro requires building new things.**

---

## Pro candidate features (new work)

> **Decision 2026-08-08: build everything first — the final free/Pro assignment is deferred.**
> Everything below is built unlocked; nothing in the codebase should hard-code a tier. The
> only requirement while building: keep each feature's entry point behind a single
> `<ProGate>`-shaped seam (a one-place check that currently always passes), so the line can
> be drawn later without refactoring. The list below is the *ranked candidate pool*, kept as
> the record of why each feature would or wouldn't justify the unlock.

Ranked by *impossible on web* × *worth paying for*. Effort is a rough t-shirt size, not an estimate.

### P0 — the reason to buy

**1. Home Screen + Lock Screen widgets (WidgetKit)** — *Large*
Today's P&L, open positions, R remaining against the daily loss limit.
*Why Pro:* literally impossible in a browser; visible every phone unlock; genuine native work (app group, shared container, timeline refresh, config plugin) so the price feels earned.
*Builds on:* `components/daily-loss-card.tsx`, `components/prop-status-card.tsx`, `components/equity-strip.tsx`.
*Native:* new widget extension → needs an Expo config plugin (same pattern as `mobile/plugins/with-ios-scene-lifecycle.js`), plus an App Group for the shared data snapshot.

**2. Live Activity / Dynamic Island — trading session** — *Large*
Running day P&L, trades taken, distance to daily loss limit, live on the Lock Screen while the market is open.
*Why Pro:* the most "pro trader" thing the app could ship, and it exists only on a phone.
*Builds on:* the same snapshot layer as widgets — build #1 first, #2 gets much cheaper.

### Not Pro — resolved against the competitive plan

**Push / journal alerts are free.** The competitive plan's Plan 7 builds journal alerts (risk-rule broken, daily-loss limit, prop drawdown proximity, unreviewed trades, economic events) delivered via Expo push + outgoing webhooks from the user's own server — and TraderWaves *Pro-gates* alerts, so we win precisely by not gating them. This doc originally listed push alerts as Pro candidate #3; that is withdrawn. The only thing that could ever be paid is a TraderMemos-*operated* push relay, if one ever exists — gate the relay service, never the feature. (A relay is also the one thing that would honestly justify a subscription.)

### P1 — stickiness

**3. Siri / App Intents / Action Button** — *Medium*
"Log a trade" by voice; Action Button and Control Center bound straight to quick journal.
*Builds on:* `mobile/src/app/quick-journal.tsx` — the flow already exists, this is the intent wrapper.

### P2 — depth

**4. Offline journaling with a write queue** — *Medium–Large*
The expo-sqlite outbox already considered for offline writes. Journal on the subway, syncs on reconnect.
*Why Pro:* phone-only by definition; the reads side already exists (MMKV + TanStack Query persister).
*Note:* an `feat/mobile-offline-ux` worktree already exists — check overlap before starting.

**5. Face ID / Touch ID app lock** — *Small*
Privacy mode already exists; biometric lock on cold launch and resume.
*Borderline:* security-adjacent, which normally stays free. Defensible here because the free app is already private and this is an *additional* convenience layer, not the only protection. Flag for a final call before shipping.

**6. Share card styles + mark removal** — *Small*
The existing share card, productized. Cheapest Pro feature available; good candidate to ship *with* the entitlement plumbing so Pro isn't empty on day one. Cosmetics only — the share capability itself (cards, and the competitive plan's public share pages) stays free as the growth loop.

---

## Sequencing

Revised per the 2026-08-08 decision (**build all features first, assign tiers later**). The cross-plan feature order lives in [roadmap.md](roadmap.md); this section only covers monetization's own steps.

**Phase 0 — build (now).** All candidate features are built and ship unlocked. No IAP code, no tier logic — only the `<ProGate>` seam (a one-place always-true check) at each candidate's entry point so the line can be drawn later without refactoring. Distribution during this phase: TestFlight, where nothing is public yet and nothing is "taken away" later.

**Phase 1 — draw the line.** Once the candidate pool is real and TestFlight feedback exists, pick which candidates go Pro. Decision inputs: this doc's ranked list, which features testers actually use, and the *would-a-self-hoster-feel-cheated* test. **This must happen before the first public App Store release** — see Rules below for why.

**Phase 2 — entitlement plumbing.** Ships together with the line.
- App Store Connect: Paid Apps agreement, banking, tax forms (this is the slow part — allow days, not hours)
- One non-consumable product, e.g. `com.tradermemos.pro`
- Client: `expo-iap` or RevenueCat; needs a native rebuild (`make prebuild-ios`)
- **Restore Purchases is mandatory** (guideline 3.1.1) — a visible entry in Settings, not just an automatic call
- The `<ProGate>` seams flip from always-true to entitlement-checked — nothing else changes

**Phase 3 — reassess.** If a TraderMemos-operated push relay ever ships (see "Not Pro" above), revisit subscription pricing at that point *and only then*.

---

## Rules and constraints

- **The line must be drawn before the first *public* App Store release.** Deferring the decision while building (the current phase) is safe — TestFlight users expect churn. But taking a feature away from public users who already had it free is the single move that reliably burns an app's rating. If a candidate does ship free publicly and later moves to Pro, existing users must be grandfathered (free-forever for anyone who had it) — but the clean path is deciding first.
- **Restore Purchases is required** by App Review for non-consumables.
- **Never paywall** data export, backup, import, or 2FA.
- **Gating is client-side** in a self-hosted app and a determined user can bypass it. That is fine. Price Pro as a tip jar with benefits, not as DRM — do not spend effort on enforcement.
- **No ads keeps the privacy nutrition labels clean** — no tracking declaration, no ATT prompt, no SDK in the dependency tree.
- **Don't cripple the free tier's language.** Free is "a complete trading journal." Pro is "your journal on your Home Screen and Lock Screen." The free tier should never read as a demo.

---

## Open questions

1. **Which candidates actually go Pro** — deliberately deferred (decision 2026-08-08: build all features first). Resolve at Phase 1, before the first public App Store release.
2. **Face ID lock — free or Pro?** Listed as a P2 candidate, flagged as borderline. Leaning free if the app ever handles multi-user servers.
3. **Price point:** $9.99 vs $14.99. Both clear the bar trivially; $14.99 is defensible once widgets and Live Activity both ship.
4. **Android/Play Store:** out of scope for this document. The $25 one-time Play fee changes the math but not the strategy.

*(Resolved: push alerts are free, not Pro — see "Not Pro" above. Only a TraderMemos-operated relay could ever be paid.)*
