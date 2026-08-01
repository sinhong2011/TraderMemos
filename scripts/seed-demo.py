#!/usr/bin/env python3
"""Seed a TraderMemos instance with a realistic demo dataset.

Talks to the public API only — no database access — so it works against a local
`make up` stack or a deployed demo instance. Every fill is POSTed to
/executions, which lets the server group them into trades the same way a real
CSV import would.

    python3 scripts/seed-demo.py --api http://localhost:3000/api/v1 \
        --email demo@example.com --password 'demo-password'

Re-running is safe: executions are deduplicated server-side by
(symbol, side, qty, price, executed_at), so a second run is a no-op.
"""
from __future__ import annotations

import argparse
import json
import random
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

# --- shape of the generated book -------------------------------------------
TARGET_NET = 8400.00      # net P&L across the whole period
TARGET_WIN_RATE = 0.58
TARGET_PROFIT_FACTOR = 1.84
OPENING_BALANCE = 25000.00
DAYS_BACK = 88

SYMBOLS = [
    # symbol, reference price, weight, options allowed
    ("NVDA", 178.0, 10, True), ("TSLA", 305.0, 9, True), ("SPY", 612.0, 8, True),
    ("QQQ", 545.0, 8, True), ("AAPL", 232.0, 7, True), ("AMD", 168.0, 6, True),
    ("META", 690.0, 5, False), ("MSFT", 468.0, 5, False), ("AMZN", 218.0, 5, False),
    ("PLTR", 82.0, 5, False), ("COIN", 285.0, 4, False), ("AVGO", 235.0, 4, False),
    ("MU", 118.0, 4, False), ("GOOGL", 195.0, 4, False), ("SMCI", 44.0, 3, False),
]
SYMBOL_POOL = [s for s in SYMBOLS for _ in range(s[2])]

SETUPS = ["Momentum", "Breakout", "Pullback", "Gap Fill", "Reversal",
          "Scalp", "Mean Reversion", "Swing"]
# setup -> (weight on winners, weight on losers)
SETUP_BIAS = {
    "Momentum": (26, 10), "Breakout": (22, 12), "Pullback": (18, 14),
    "Gap Fill": (10, 12), "Reversal": (8, 16), "Scalp": (8, 14),
    "Mean Reversion": (5, 18), "Swing": (3, 4),
}

WIN_TAGS = [("A+ setup", "#4ade80"), ("Trend day", "#22d3ee"), ("Breakout", "#38bdf8"),
            ("Momentum", "#34d399"), ("Gap fill", "#fbbf24")]
LOSS_TAGS = [("Chased", "#fb923c"), ("Early exit", "#cbd5e1"), ("Moved stop", "#cbd5e1"),
             ("No plan", "#cbd5e1"), ("Oversized", "#f87171")]


class Api:
    def __init__(self, base: str, timeout: int = 30):
        self.base = base.rstrip("/")
        self.timeout = timeout
        self.token: str | None = None

    def __call__(self, method: str, path: str, body: dict | None = None):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(f"{self.base}{path}", data=data, method=method)
        req.add_header("Content-Type", "application/json")
        if self.token:
            req.add_header("Authorization", f"Bearer {self.token}")
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as r:
                raw = r.read()
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")[:300]
            raise SystemExit(f"{method} {path} failed: HTTP {e.code} {detail}") from None
        except urllib.error.URLError as e:
            raise SystemExit(f"cannot reach {self.base}: {e.reason}") from None

    def login(self, email: str, password: str) -> None:
        res = self("POST", "/auth/login", {"email": email, "password": password})
        self.token = res.get("access_token")
        if not self.token:
            raise SystemExit("login succeeded but returned no access_token")


def trading_days(end: datetime, count: int) -> list[datetime]:
    days, d = [], end - timedelta(days=count)
    while d <= end:
        if d.weekday() < 5:
            days.append(d)
        d += timedelta(days=1)
    return days


def build_book(rnd: random.Random, end: datetime) -> list[dict]:
    """Generate trades whose totals land on the win-rate / profit-factor targets."""
    sessions = [d for d in trading_days(end, DAYS_BACK) if rnd.random() > 0.20]

    # a positive drift with one drawdown stretch, so the equity curve has shape
    slump = set(range(int(len(sessions) * 0.42), int(len(sessions) * 0.42) + 6))
    tone = [rnd.uniform(-1.6, -0.2) if i in slump else rnd.gauss(0.55, 1.0)
            for i in range(len(sessions))]

    counts = [rnd.choice([2, 3, 3, 4, 4, 4, 5, 5, 6]) for _ in sessions]
    total = sum(counts)
    target_wins = round(total * TARGET_WIN_RATE)

    outcomes = []
    for i, n in enumerate(counts):
        p = TARGET_WIN_RATE + 0.22 * max(-1.0, min(1.0, tone[i]))
        outcomes.append([rnd.random() < p for _ in range(n)])

    # nudge to the exact win count
    flat = [(i, j) for i, o in enumerate(outcomes) for j in range(len(o))]
    wins = sum(sum(o) for o in outcomes)
    while wins != target_wins:
        i, j = rnd.choice(flat)
        if wins < target_wins and not outcomes[i][j]:
            outcomes[i][j], wins = True, wins + 1
        elif wins > target_wins and outcomes[i][j]:
            outcomes[i][j], wins = False, wins - 1

    gross_loss = TARGET_NET / (TARGET_PROFIT_FACTOR - 1.0)
    win_mags = [rnd.lognormvariate(0, 0.62) for _ in range(target_wins)]
    loss_mags = [rnd.lognormvariate(0, 0.52) for _ in range(total - target_wins)]
    ws = (gross_loss * TARGET_PROFIT_FACTOR) / sum(win_mags)
    ls = gross_loss / sum(loss_mags)
    win_mags = [m * ws for m in win_mags]
    loss_mags = [m * ls for m in loss_mags]
    rnd.shuffle(win_mags)
    rnd.shuffle(loss_mags)

    trades, wi, li = [], 0, 0
    for i, day in enumerate(sessions):
        entries = sorted(rnd.uniform(13 * 60 + 35, 19 * 60 + 40) for _ in range(counts[i]))
        for j in range(counts[i]):
            won = outcomes[i][j]
            if won:
                net, wi = win_mags[wi], wi + 1
            else:
                net, li = -loss_mags[li], li + 1

            symbol, ref, _, opt_ok = rnd.choice(SYMBOL_POOL)
            is_option = opt_ok and rnd.random() < 0.22
            long = rnd.random() < 0.78

            opened = day.replace(hour=int(entries[j] // 60), minute=int(entries[j] % 60),
                                 second=rnd.randint(0, 59), microsecond=0,
                                 tzinfo=timezone.utc)
            hold = rnd.choice([4, 7, 11, 16, 23, 34, 48, 62, 95, 140, 190]) + rnd.randint(0, 9)

            if is_option:
                mult, instrument = 100.0, "option"
                entry = round(max(0.45, rnd.gauss(ref * 0.018, ref * 0.006)), 2)
                qty = float(rnd.choice([1, 2, 2, 3, 3, 5, 5, 8, 10]))
                fee = round(0.65 * qty + 0.35, 2)
            else:
                mult, instrument = 1.0, "stock"
                entry = round(ref * rnd.uniform(0.94, 1.06), 2)
                qty = float(max(5, round(rnd.uniform(4500, 16000) / entry)))
                fee = round(1.00 + 0.0035 * qty, 2)

            delta = (net + fee * 2) / (qty * mult)
            exit_px = round(entry + delta if long else entry - delta, 2)
            if exit_px <= 0.01:
                exit_px = round(entry * 0.35, 2)

            trades.append(dict(
                symbol=symbol, instrument=instrument, long=long, qty=qty, mult=mult,
                entry=entry, exit=exit_px, fee=fee, won=won,
                opened=opened, closed=opened + timedelta(minutes=hold),
            ))
    return trades


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--api", default="http://localhost:3000/api/v1", help="API base URL")
    ap.add_argument("--email", required=True)
    ap.add_argument("--password", required=True)
    ap.add_argument("--account", help="account id (default: first account, else created)")
    ap.add_argument("--seed", type=int, default=20260731, help="RNG seed for reproducibility")
    args = ap.parse_args()

    rnd = random.Random(args.seed)
    api = Api(args.api)
    api.login(args.email, args.password)

    account_id = args.account
    if not account_id:
        accounts = api("GET", "/accounts") or []
        if accounts:
            account_id = accounts[0]["id"]
            print(f"using existing account {accounts[0].get('name', account_id)}")
        else:
            acc = api("POST", "/accounts", {
                "name": "Demo", "broker": "Demo Broker", "account_type": "margin",
                "base_currency": "USD", "starting_balance": 0,
            })
            account_id = acc["id"]
            print("created account 'Demo'")

    # opening balance as a deposit; starting_balance stays 0 so the equity
    # curve and the header balance agree.
    if not api("GET", f"/cash-transactions?account_id={account_id}"):
        api("POST", "/cash-transactions", {
            "account_id": account_id, "type": "deposit", "amount": OPENING_BALANCE,
            "currency": "USD", "note": "Opening balance",
            "occurred_at": (datetime.now(timezone.utc) - timedelta(days=DAYS_BACK + 2))
                           .replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        })
        print(f"deposited opening balance ${OPENING_BALANCE:,.0f}")

    existing = {s["name"]: s["id"] for s in (api("GET", "/setups") or [])}
    for name in SETUPS:
        if name not in existing:
            existing[name] = api("POST", "/setups", {"name": name})["id"]

    tags = {t["name"]: t["id"] for t in (api("GET", "/tags") or [])}
    for name, color in WIN_TAGS:
        if name not in tags:
            tags[name] = api("POST", "/tags", {"name": name, "color": color})["id"]
    for name, color in LOSS_TAGS:
        if name not in tags:
            tags[name] = api("POST", "/tags",
                             {"name": name, "color": color, "kind": "mistake"})["id"]

    trades = build_book(rnd, datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0) - timedelta(days=1))

    nets = [(t["exit"] - t["entry"] if t["long"] else t["entry"] - t["exit"])
            * t["qty"] * t["mult"] - t["fee"] * 2 for t in trades]
    gp = sum(n for n in nets if n > 0)
    gl = -sum(n for n in nets if n < 0)
    print(f"seeding {len(trades)} trades — net ${sum(nets):+,.2f}, "
          f"win rate {sum(1 for n in nets if n > 0) / len(nets):.0%}, PF {gp / gl:.2f}")

    stamp = lambda d: d.isoformat().replace("+00:00", "Z")
    for i, t in enumerate(trades, 1):
        entry_side = "buy" if t["long"] else "sell"
        trade_id = None
        for side, price, at in ((entry_side, t["entry"], t["opened"]),
                                ("sell" if t["long"] else "buy", t["exit"], t["closed"])):
            res = api("POST", "/executions", {
                "account_id": account_id, "symbol": t["symbol"],
                "instrument_type": t["instrument"], "side": side, "quantity": t["qty"],
                "price": price, "fees": t["fee"], "commission": 0,
                "executed_at": stamp(at), "multiplier": t["mult"],
            })
            trade_id = res.get("trade_id") or trade_id

        if trade_id:
            names = list(SETUP_BIAS)
            weights = [SETUP_BIAS[n][0 if t["won"] else 1] for n in names]
            patch = {"setup_ids": [existing[rnd.choices(names, weights=weights, k=1)[0]]]}
            if rnd.random() < 0.72:
                pool = WIN_TAGS if t["won"] else LOSS_TAGS
                picked = rnd.sample(pool, 2 if rnd.random() < 0.28 else 1)
                patch["tag_ids"] = [tags[n] for n, _ in picked]
            api("PATCH", f"/trades/{trade_id}", patch)

        if i % 25 == 0 or i == len(trades):
            print(f"  {i}/{len(trades)} trades", flush=True)

    print("done — open the dashboard to see the seeded book")
    return 0


if __name__ == "__main__":
    sys.exit(main())
