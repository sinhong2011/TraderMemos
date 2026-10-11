# Spec — Trading System Builder

Status: phases 1–3 built (API + web) with Phase A honesty fixes · 2026-10-10 ·
map stages C and D built, stage E and mobile pending. Map UI tracked in [trading-system-map-plan.md](trading-system-map-plan.md).

**Built:** `/system` (blueprint + five-node rule map, vague-wording check, versions,
change log with required reasons, four-week plan), the day's market regime on the
Day page, the system card on every trade (plan fields stamped `planned_at`, time
stop, exit state, 5-item post-trade check → suggested adherence), and the Review
tab (coverage, process × outcome quadrant, results by market / setup / exit state /
trade type / adherence / version with sample-size bands, losing-streak diagnosis).
Hesitated misses are shown separately and do not dilute version adherence rate.
Sample bands are thin / indicative / adequate — never "reliable". Week 4 of the
plan is version revision (activate next), not "completed review". Mixed-currency
portfolios are rejected by the shared loader (`mixed_currencies`).

Data: migration 000050 (PG 000014) — new tables only, no trade_journal rebuild.

**Built on the map:** stage C plans (revisions, statuses, confirmed trade links)
and stage D holding evidence (append-only revisions, withdraw, scaling-rule
reminder, time-stop prompt that does not exit). Old per-trade cards are not
tagged legacy.

**Not built:** portfolio view, the optional 17th decision, map stage E review
loop, mobile port.

## 1. What exists vs. what is missing

| Framework piece | Exists today | Gap |
|---|---|---|
| A system as one thing | `trading_systems` + versioned rules | Multi-system UI later |
| 1 Market environment | Regime labels on version + daily regime | No auto-detect from bars |
| 2 Selection, 3 Setup | Decision text + Playbook setups | Per-trade setup checklist ticks |
| 4 Trigger | Decision text + `trigger_met` on card | — |
| 5–7 Risk / size | Decision text; existing risk_rules | Server open-risk enforcement |
| 8 Portfolio check | Decision text | Portfolio view (phase 4) |
| 9 Dynamic adjustment | Decision text; follow-mode add/trim notes | Portfolio view still later |
| 10–13 Exit diagnosis | Card fields + holding evidence timeline | One card exit state is not the timeline |
| 14–16 MRA | System review analytics + change log | Map review decisions (stage E) |
| 4-week plan | Derived plan steps on `/system` | Week 4 ≠ saved review decision yet |
