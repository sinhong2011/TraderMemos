import type { Summary, Trade } from "./api/types";
import { fmtDateShort } from "./format";

export interface AccountContribution {
  accountId: string;
  name: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  netPnl: number;
}

/** Per-account closed-trade contribution, sorted by |netPnl| then trades. */
export function computeAccountContribution(
  trades: Trade[],
  accounts: { id: string; name: string }[],
): AccountContribution[] {
  const nameById = new Map(accounts.map((a) => [a.id, a.name]));
  const map = new Map<string, { trades: number; wins: number; losses: number; netPnl: number }>();

  for (const t of trades) {
    if (t.status === "open" || t.net_pnl == null) continue;
    const cur = map.get(t.account_id) ?? { trades: 0, wins: 0, losses: 0, netPnl: 0 };
    cur.trades += 1;
    cur.netPnl += t.net_pnl;
    if (t.net_pnl > 0) cur.wins += 1;
    else if (t.net_pnl < 0) cur.losses += 1;
    map.set(t.account_id, cur);
  }

  return [...map.entries()]
    .map(([accountId, s]) => ({
      accountId,
      name: nameById.get(accountId) ?? "Unknown",
      trades: s.trades,
      wins: s.wins,
      losses: s.losses,
      winRate: s.trades > 0 ? s.wins / s.trades : 0,
      netPnl: Math.round(s.netPnl * 100) / 100,
    }))
    .sort((a, b) => Math.abs(b.netPnl) - Math.abs(a.netPnl) || b.trades - a.trades);
}

export interface DayPnl {
  date: string;
  pnl: number;
}

export interface HomeInsights {
  bestStreak: number;
  worstStreak: number;
  bestDay: DayPnl | null;
  worstDay: DayPnl | null;
  avgHoldSecs: number | null;
  winHoldSecs: number | null;
  lossHoldSecs: number | null;
  mainMistake: string | null;
  topSymbol: string | null;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function dayKey(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return fmtDateShort(iso);
}

/** Closed trades only, oldest → newest by close (fallback open). */
export function chronologicalClosed(trades: Trade[]): Trade[] {
  return trades
    .filter((t) => t.status !== "open" && t.net_pnl != null)
    .slice()
    .sort((a, b) => {
      const aAt = a.closed_at ?? a.opened_at;
      const bAt = b.closed_at ?? b.opened_at;
      return new Date(aAt).getTime() - new Date(bAt).getTime();
    });
}

function streaks(closed: Trade[]): { best: number; worst: number } {
  let best = 0;
  let worst = 0;
  let curWin = 0;
  let curLoss = 0;
  for (const t of closed) {
    const pnl = t.net_pnl ?? 0;
    if (pnl > 0) {
      curWin += 1;
      curLoss = 0;
      if (curWin > best) best = curWin;
    } else if (pnl < 0) {
      curLoss += 1;
      curWin = 0;
      if (curLoss > worst) worst = curLoss;
    } else {
      curWin = 0;
      curLoss = 0;
    }
  }
  return { best, worst };
}

function dayPnls(closed: Trade[]): DayPnl[] {
  const map = new Map<string, number>();
  for (const t of closed) {
    const key = dayKey(t.closed_at ?? t.opened_at);
    if (!key || key === "-") continue;
    map.set(key, (map.get(key) ?? 0) + (t.net_pnl ?? 0));
  }
  return [...map.entries()].map(([date, pnl]) => ({ date, pnl }));
}

function mostFrequent(names: string[]): string | null {
  if (names.length === 0) return null;
  const counts = new Map<string, number>();
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
  let best: string | null = null;
  let bestN = 0;
  for (const [name, n] of counts) {
    if (n > bestN) {
      best = name;
      bestN = n;
    }
  }
  return best;
}

export function computeHomeInsights(trades: Trade[]): HomeInsights {
  const closed = chronologicalClosed(trades);
  const { best, worst } = streaks(closed);
  const days = dayPnls(closed);
  const bestDay = days.reduce<DayPnl | null>((acc, d) => (!acc || d.pnl > acc.pnl ? d : acc), null);
  const worstDay = days.reduce<DayPnl | null>(
    (acc, d) => (!acc || d.pnl < acc.pnl ? d : acc),
    null,
  );

  const holds = closed
    .map((t) => t.time_in_trade_secs)
    .filter((s): s is number => s != null && s > 0);
  const winHolds = closed
    .filter((t) => (t.net_pnl ?? 0) > 0)
    .map((t) => t.time_in_trade_secs)
    .filter((s): s is number => s != null && s > 0);
  const lossHolds = closed
    .filter((t) => (t.net_pnl ?? 0) < 0)
    .map((t) => t.time_in_trade_secs)
    .filter((s): s is number => s != null && s > 0);

  const mistakes = closed.flatMap((t) =>
    t.tags.filter((tag) => tag.kind === "mistake").map((tag) => tag.name),
  );
  const symbols = closed.map((t) => t.symbol);

  return {
    bestStreak: best,
    worstStreak: worst,
    bestDay,
    worstDay,
    avgHoldSecs: mean(holds),
    winHoldSecs: mean(winHolds),
    lossHoldSecs: mean(lossHolds),
    mainMistake: mostFrequent(mistakes),
    topSymbol: mostFrequent(symbols),
  };
}

export interface InsightRow {
  label: string;
  value: string;
  tone?: "pos" | "neg" | "muted";
  hint?: string;
}

export interface InsightPanel {
  title: string;
  hero: InsightRow;
  cells: InsightRow[];
}

export function buildInsightPanels(
  summary: Summary,
  insights: HomeInsights,
  currency: string,
  locale: string,
  maxDrawdown: number | undefined,
  formatters: {
    money: (v: number) => string;
    signed: (v: number) => string;
    pct: (r: number) => string;
    duration: (secs: number | null) => string;
  },
): InsightPanel[] {
  const { signed, pct, duration } = formatters;
  void currency;
  void locale;
  void formatters.money;

  return [
    {
      title: "PnL quality",
      hero: {
        label: "Expectancy",
        value: signed(summary.expectancy),
        tone: summary.expectancy >= 0 ? "pos" : "neg",
        hint: "per trade",
      },
      cells: [
        {
          label: "Best trade",
          value: summary.largest_win > 0 ? signed(summary.largest_win) : "—",
          tone: "pos",
        },
        {
          label: "Worst trade",
          value: summary.largest_loss > 0 ? signed(-summary.largest_loss) : "—",
          tone: "neg",
        },
        {
          label: "Max drawdown",
          value: maxDrawdown != null && maxDrawdown > 0 ? signed(-maxDrawdown) : "—",
          tone: "neg",
          hint: "pullback",
        },
        {
          label: "Profit factor",
          value: summary.profit_factor > 0 ? summary.profit_factor.toFixed(2) : "—",
        },
      ],
    },
    {
      title: "Stability",
      hero: {
        label: "Win rate",
        value: pct(summary.win_rate),
        hint: `${summary.wins}W / ${summary.losses}L`,
      },
      cells: [
        {
          label: "Best streak",
          value: insights.bestStreak > 0 ? String(insights.bestStreak) : "—",
        },
        {
          label: "Worst streak",
          value: insights.worstStreak > 0 ? String(insights.worstStreak) : "—",
          tone: insights.worstStreak > 0 ? "neg" : undefined,
        },
        {
          label: "Best day",
          value: insights.bestDay ? signed(insights.bestDay.pnl) : "—",
          tone: insights.bestDay && insights.bestDay.pnl > 0 ? "pos" : undefined,
          hint: insights.bestDay?.date,
        },
        {
          label: "Worst day",
          value: insights.worstDay ? signed(insights.worstDay.pnl) : "—",
          tone: insights.worstDay && insights.worstDay.pnl < 0 ? "neg" : undefined,
          hint: insights.worstDay?.date,
        },
        {
          label: "Main leak",
          value: insights.mainMistake ?? "None tagged",
          tone: insights.mainMistake ? "neg" : "muted",
        },
      ],
    },
    {
      title: "Time",
      hero: {
        label: "Average hold",
        value: duration(insights.avgHoldSecs),
        hint: `${summary.total_trades} trades`,
      },
      cells: [
        { label: "Winning hold", value: duration(insights.winHoldSecs), tone: "pos" },
        { label: "Losing hold", value: duration(insights.lossHoldSecs), tone: "neg" },
        {
          label: "Top symbol",
          value: insights.topSymbol ?? "—",
          hint: insights.topSymbol ? "most traded" : undefined,
        },
      ],
    },
  ];
}
