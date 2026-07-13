# Competitive Analysis — Day-Trader Journal Requirements

**Date:** 2026-07-10  
**Sources:** Live Stonk Journal v2 tour, TraderVue public docs, TradeZella product pages  
**Goal:** Define what TraderMemos must ship to be session-ready for a professional day trader — not a visual clone of any one product.

---

## Positioning

| Product | Strength | Weakness for our users |
|---|---|---|
| **TraderVue** | Best-in-class **reports** (R-mode, MAE/MFE, comparison, liquidity, tags) | Older UX; tags ≈ playbooks; no modern risk-rules coach |
| **TradeZella** | **Playbooks + process** (checklists, replay, AI, prop sync, 50+ reports) | Cloud SaaS; expensive; not self-hosted |
| **Stonk Journal** | Closest UX reference — open trades, compliance, AI coach, planned setups | Cloud; PRO gates; blue SaaS aesthetic |
| **TraderMemos** | Self-hosted + Signal Terminal aesthetic + solid closed-trade core | Not session-ready yet (open book, rules, R analytics, process) |

**TraderMemos differentiator to protect:** self-hosted sovereignty + dense terminal craft.  
**Do not chase:** TradeZella replay/backtesting or prop-firm sync in v1 of this roadmap.

---

## What a day trader actually needs (ranked)

### P0 — Session desk (without these, the journal is evening-only)

1. **Open + partial positions in the book**  
   Stonk Journal copy: *"still open, partially exited, or fully closed."*  
   TraderMemos today: `GET /trades` returns **closed only** → OPEN filter is hollow.

2. **Initial risk → R-multiple everywhere**  
   TraderVue gold standard: every report switchable `$` ↔ `R`; trades without risk excluded from R mode.  
   TradeZella: multi TP/SL + auto R:R.  
   TraderMemos: `initial_risk` / `r_multiple` on detail exist; list/analytics barely use them.

3. **Risk rules + real compliance**  
   Stonk: Settings → Rules power **Check compliance** + Stats compliance impact.  
   TradeZella: prop drawdown/consistency warnings.  
   TraderMemos: client-side geometry only (target/stop vs direction).

4. **Playbook that measures edge**  
   TradeZella: strategy rules + checklist → tag trades → strategy P&L.  
   TraderVue: tag reports (same job, thinner UX).  
   Stonk: Setup Type on trade + New Setup as planned trade.  
   TraderMemos: setups are name/notes; New Setup does not convert to trade.

### P1 — Process & leak finding

5. **Mistake / emotion / quality tags that feed reports**  
   Stonk Journal mistakes: Early exit, Moved stop, No plan, Chased entry, Over-sized, Late exit, Wrong direction, Ignored signal.  
   TradeZella: custom tags + best/worst tag reports + cross-analysis (mistake × time of day).  
   TraderMemos: journal fields partly stuffed into notes text — not queryable.

6. **Time / session breakdowns**  
   All three: day-of-week, time-of-day, session. Day traders live here.  
   TraderMemos: day_of_week exists; session / time-of-day incomplete.

7. **MAE / MFE (excursion)**  
   TraderVue Advanced + TradeZella: how much of the move you captured.  
   TraderMemos: not implemented.

8. **Standalone notes + daily checklist**  
   TradeZella Notebook / pre-market checklist; Stonk New Note.  
   TraderMemos: New Note = localStorage stub.

### P2 — Nice later (do not block P0)

- AI coach / Zella AI (Stonk + TradeZella)  
- Trade replay / backtesting (TradeZella)  
- Liquidity add/remove (TraderVue — equity specialists)  
- Prop firm sync (TradeZella)  
- Share links / mentor mode  
- PWA offline  
- Broker auto-sync beyond CSV  

---

## Stonk Journal New Trade (live 2026-07-10)

Verified in browser on `v2.stonkjournal.com`:

| Area | Behavior |
|---|---|
| Header | Templates, Save copies to, Close |
| Tabs | General / Journal / Dividends |
| General | Market (STOCK…), Symbol, LONG/SHORT, Target, Stop, execution rows (BUY/SELL, datetime picker, qty, price, fee, +/−) |
| Journal | Setup Type, Emotional State, Tags (typeahead), Mistakes (chip toggles), Notes, Confidence slider, Trade Quality slider, Screenshots 0/5 |
| Dividends | Amount rolls into **trade P&L** (shorts subtract); W/L and R stay price-based |
| Footer | Save / **Check compliance** (against Settings rules) / Cancel |
| Copy | Explicitly supports **open / partial / closed** |

---

## TraderVue — steal these ideas

| Feature | Why day traders care | TraderMemos action |
|---|---|---|
| **R reporting mode** | Normalize size; compare process not dollars | Global `$`/`R` toggle on Reports + dashboard strip |
| **Initial risk required for R** | Honest risk-adjusted stats | Exclude null-risk trades from R charts; show “N excluded” |
| **MAE / MFE** | Exit quality | Store excursion when price history available; start with manual or import-derived |
| **Comparison reports** | Win days vs loss days, long vs short, tag A vs B | Add compare mode on Reports |
| **Tag reports** | Setup/mistake performance | First-class journal tags → breakdown API |
| **Liquidity reports** | Intraday equity specialists | Defer |

---

## TradeZella — steal these ideas

| Feature | Why day traders care | TraderMemos action |
|---|---|---|
| **Playbooks with rules/checklist** | Edge is per-setup | Upgrade Setup model: criteria, invalidation, checklist; performance by setup |
| **Strategy tagging on every trade** | Same | Wire Setup Type to playbook; Reports → by setup |
| **Day/time + cross-analysis** | Find leaks (e.g. FOMO first 15m) | Session + hour buckets; mistake × hour matrix later |
| **Multi TP/SL** | Scale-outs | Support multiple targets later; one target/stop is enough for P0 |
| **Daily checklist / EOD summary** | Process | Notes + checklist templates after notes API |
| **Running P&L / MAE-MFE** | Trade story | After open positions + price path |
| Replay / AI / Prop sync | Differentiator for them | Out of scope for self-hosted v1 |

---

## TraderMemos gap matrix (honest)

| Capability | SJ | TV | TZ | TM now | Priority |
|---|---|---|---|---|---|
| Closed trade log + import | ✓ | ✓ | ✓ | ✓ | — |
| Open / partial positions | ✓ | ✓ | ✓ | ✓ | — |
| Target + stop on trade | ✓ | ✓ | ✓ | ✓ (partial) | P0 polish |
| Initial risk → R analytics | ✓ | ✓✓ | ✓ | ✓ | — |
| Risk rules + compliance | ✓ | — | prop | ✓ | — |
| Playbook performance | thin | tags | ✓✓ | ✓ | — |
| Mistake/emotion tags → reports | ✓ | tags | ✓✓ | ✓ | — |
| Time/session reports | ✓ | ✓ | ✓✓ | ✓ | — |
| MAE/MFE | — | ✓✓ | ✓ | ✓ (manual) | — |
| Planned setup → convert | ✓ | — | playbook | ✓ | — |
| Standalone notes | ✓ | — | ✓ | ✓ | — |
| Dividends in trade P&L | ✓ | — | — | ✓ | — |
| AI coach | ✓ | — | ✓ | ✗ | P2 |
| Replay / backtest | — | — | ✓✓ | ✗ | P2 |
| Self-hosted | ✗ | ✗ | ✗ | ✓ | keep |

---

## Recommended build order (day-trader-first)

### Phase A — Open book (unblocks session use) ✅ in progress / landed core
1. `GET /trades` returns open + closed (filter by status). ✅  
2. Dashboard / Trades table show OPEN rows with remaining **POS** (`qty_remaining`). ✅  
3. New Trade can save buy-only (open) without forcing a close. ✅  
4. Add fills to open trades from detail. ✅

### Phase B — Risk as a first-class number ✅
1. Settings → Risk Rules (max risk/trade, max daily loss, max open risk, …). ✅  
2. Compliance check uses rules + planned size/stop. ✅  
3. Reports: `$` / `R` toggle; R distribution; “excluded missing risk” count. ✅  
4. Position size helper: entry + stop + account risk % → qty. ✅

### Phase C — Playbook edge ✅
1. Setup = planned trade (thesis, target, stop, checklist) + convert → trade. ✅  
2. Every trade links Setup Type; Reports breakdown by setup (+ mistake). ✅  
3. Mistake chips + emotion as structured fields (not notes text). ✅

### Phase D — Leak lab ✅
1. Time-of-day + session breakdowns (entry time, ET sessions). ✅  
2. MAE/MFE when data allows (manual journal fields). ✅  
3. Notes API + daily checklist templates. ✅  
4. Dividends merge into trade P&L (linked cash; W/L + R stay price-based). ✅

### Explicitly defer
AI coach, tick replay, prop sync, broker OAuth auto-sync, PWA.

---

## Success criteria (professional day trader)

After Phases A–C, a trader can:

1. See **open risk** on the desk during the session.  
2. Log a trade with stop → know **planned R** before entry.  
3. Fail a **compliance** check when over-sizing.  
4. Review which **setup** prints and which bleeds — in R, not just $.  
5. Tag **mistakes** and filter reports by them.

Until then, TraderMemos remains an **evening review tool**, not a trading desk journal.
