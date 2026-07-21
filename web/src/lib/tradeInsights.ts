import type { TradeDetail } from "../lib/api/types";
import { parseJournalNotes } from "./journalNotes";
import { computeRiskReward } from "./riskReward";
import { gradeFromInt, intFromGrade, type TradeGrade } from "./tradeGrades";

export type CoachTone = "neg" | "warn" | "pos" | "tip";

export interface TradeCoachNote {
  id: string;
  tone: CoachTone;
  headline: string;
  detail: string;
  /** Lower = higher priority. */
  priority: number;
}

export interface TradeInsights {
  grossPnl: number | null;
  netPnl: number | null;
  feesTotal: number;
  /** Fees as a share of |gross| P&L (0–1). */
  feeDragPct: number | null;
  returnPct: number | null;
  rMultiple: number | null;
  plannedRR: number | null;
  initialRisk: number | null;
  target: number | null;
  stop: number | null;
  breakeven: number | null;
  maxProfit: number | null;
  maxLoss: number | null;
  mae: number | null;
  mfe: number | null;
  /** Net ÷ MFE when MFE > 0 — how much of the favorable excursion was kept. */
  mfeCapturePct: number | null;
  /** MFE − net when both set — dollars left on the table (winners). */
  leftOnTable: number | null;
  holdLabel: string;
  fillCount: number;
  qtyOpened: number;
  qtyRemaining: number;
  setupName: string | null;
  emotion: string | null;
  setupGrade: string;
  executionGrade: string;
  tagNames: string[];
}

/** Derive display-ready insight metrics from a trade detail payload. */
export function computeTradeInsights(trade: TradeDetail): TradeInsights {
  const rr = computeRiskReward(trade);
  const gross = trade.gross_pnl;
  const net = trade.net_pnl;
  const fees = trade.fees_total;
  const mae = trade.mae;
  const mfe = trade.mfe;

  let feeDragPct: number | null = null;
  if (gross != null && Math.abs(gross) > 0) {
    feeDragPct = fees / Math.abs(gross);
  }

  let mfeCapturePct: number | null = null;
  let leftOnTable: number | null = null;
  if (mfe != null && mfe > 0 && net != null) {
    mfeCapturePct = net / mfe;
    leftOnTable = mfe - net;
  }

  return {
    grossPnl: gross,
    netPnl: net,
    feesTotal: fees,
    feeDragPct,
    returnPct: trade.return_pct,
    rMultiple: trade.r_multiple,
    plannedRR: rr.plannedRR,
    initialRisk: trade.initial_risk,
    target: rr.target,
    stop: rr.stop,
    breakeven: rr.breakeven,
    maxProfit: rr.maxProfit,
    maxLoss: rr.maxLoss,
    mae,
    mfe,
    mfeCapturePct,
    leftOnTable,
    holdLabel: rr.holdLabel,
    fillCount: trade.fills.length,
    qtyOpened: trade.qty_opened,
    qtyRemaining: trade.qty_remaining,
    setupName: trade.setup?.name ?? null,
    emotion: trade.emotional_state?.trim() ? trade.emotional_state : null,
    setupGrade: gradeFromInt(trade.confidence) || "",
    executionGrade: gradeFromInt(trade.trade_quality) || "",
    tagNames: (trade.tags ?? []).map((t) => t.name),
  };
}

export function insightsHasContent(i: TradeInsights): boolean {
  return (
    i.grossPnl != null ||
    i.netPnl != null ||
    i.feesTotal > 0 ||
    i.rMultiple != null ||
    i.plannedRR != null ||
    i.initialRisk != null ||
    i.target != null ||
    i.stop != null ||
    i.mae != null ||
    i.mfe != null ||
    i.setupName != null ||
    i.emotion != null ||
    Boolean(i.setupGrade) ||
    Boolean(i.executionGrade) ||
    i.tagNames.length > 0 ||
    i.fillCount > 0
  );
}

const LOSS_EMOTIONS = new Set(["Overconfident", "Greedy", "FOMO", "Revenge", "Bored"]);
const FEAR_EMOTIONS = new Set(["Anxious", "Fearful", "Tired"]);

function planRecorded(insights: TradeInsights): boolean {
  return (
    (insights.initialRisk != null && insights.initialRisk > 0) ||
    insights.stop != null ||
    insights.target != null
  );
}

function gradeRank(grade: TradeGrade | ""): number {
  if (!grade) return 0;
  const n = intFromGrade(grade);
  return n ?? 0;
}

function pushNote(
  notes: TradeCoachNote[],
  note: Omit<TradeCoachNote, "priority"> & { priority: number },
) {
  notes.push(note);
}

/** Rule-based coaching copy from trade + derived metrics (offline, deterministic). */
export function generateTradeCoachNotes(
  trade: TradeDetail,
  insights: TradeInsights,
): TradeCoachNote[] {
  const notes: TradeCoachNote[] = [];
  const net = insights.netPnl;
  const isClosed = trade.status === "closed";
  const isLoss = net != null && net < 0;
  const isWin = net != null && net > 0;
  const isFlat = net === 0;
  const journal = parseJournalNotes(trade.notes ?? "");
  const mistakeTags = (trade.tags ?? []).filter((t) => t.kind === "mistake").map((t) => t.name);
  const hasMistakeNoPlan = mistakeTags.some((n) => /no plan/i.test(n));

  if (isClosed && !planRecorded(insights)) {
    pushNote(notes, {
      id: "no-plan",
      tone: "neg",
      priority: 1,
      headline: "No plan was recorded before the trade",
      detail: hasMistakeNoPlan
        ? "Risk, target, and stop are blank — and you tagged this as no plan. Define all three before entry next time so you can measure R and review honestly."
        : "Risk, target, and stop are all empty. Without a plan you can't judge whether the loss was bad luck or bad process.",
    });
  }

  if (isClosed && !journal.entryReason.trim()) {
    pushNote(notes, {
      id: "no-entry-reason",
      tone: "warn",
      priority: 4,
      headline: "Missing entry reason",
      detail:
        "Write why you entered while it's fresh. Future you needs the thesis, not just the P&L.",
    });
  }

  if (isClosed && isLoss && !journal.exitReason.trim()) {
    pushNote(notes, {
      id: "no-exit-reason",
      tone: "warn",
      priority: 5,
      headline: "Missing exit reason on a loser",
      detail:
        "Document why you closed — stop hit, thesis broken, or emotion — so you can spot repeat patterns.",
    });
  }

  if (isLoss && insights.emotion && LOSS_EMOTIONS.has(insights.emotion)) {
    pushNote(notes, {
      id: "emotion-loss",
      tone: "neg",
      priority: 2,
      headline: `${insights.emotion} state paired with a loss`,
      detail:
        insights.emotion === "Overconfident"
          ? "Overconfidence often shows up as oversizing or ignoring your stop. Check whether conviction exceeded your edge on this setup."
          : `${insights.emotion} can push size or timing. Compare this trade to your playbook rules before taking the next similar signal.`,
    });
  }

  if (isWin && insights.emotion && FEAR_EMOTIONS.has(insights.emotion)) {
    pushNote(notes, {
      id: "emotion-win",
      tone: "warn",
      priority: 6,
      headline: `${insights.emotion} but the trade still won`,
      detail:
        "You may have cut a winner early. Check MFE vs net — if you left meaningful profit, work on hold rules for this setup.",
    });
  }

  if (insights.feeDragPct != null && insights.feeDragPct >= 0.15) {
    pushNote(notes, {
      id: "fee-drag-high",
      tone: "neg",
      priority: 3,
      headline: "Fees took a large bite of gross P&L",
      detail: `Commissions and fees were ${(insights.feeDragPct * 100).toFixed(0)}% of gross — on a ${isLoss ? "losing" : "winning"} trade that materially changes the outcome. Fewer legs or lower-cost fills would help.`,
    });
  } else if (insights.feeDragPct != null && insights.feeDragPct >= 0.05 && isLoss) {
    pushNote(notes, {
      id: "fee-drag-moderate",
      tone: "warn",
      priority: 7,
      headline: "Fees amplified a small loss",
      detail: `${(insights.feeDragPct * 100).toFixed(1)}% of gross went to fees. With ${insights.fillCount} fill${insights.fillCount === 1 ? "" : "s"}, consider whether every add was worth the cost.`,
    });
  }

  if (
    isWin &&
    insights.mfeCapturePct != null &&
    insights.mfeCapturePct < 0.35 &&
    insights.mfe != null
  ) {
    pushNote(notes, {
      id: "poor-capture",
      tone: "warn",
      priority: 4,
      headline: "Most of the move was left on the table",
      detail: `You captured ${(insights.mfeCapturePct * 100).toFixed(0)}% of MFE. Review your exit trigger — trailing stop or partial targets may fit this setup better.`,
    });
  }

  if (
    isWin &&
    insights.leftOnTable != null &&
    insights.leftOnTable > 0 &&
    insights.initialRisk != null &&
    insights.initialRisk > 0
  ) {
    const leftR = insights.leftOnTable / insights.initialRisk;
    if (leftR >= 1) {
      pushNote(notes, {
        id: "left-on-table",
        tone: "tip",
        priority: 8,
        headline: `~${leftR.toFixed(1)}R left after exit`,
        detail:
          "The trade worked but you exited before the move finished. Note what would have kept you in for the next similar setup.",
      });
    }
  }

  if (isLoss && insights.rMultiple != null && insights.rMultiple <= -1.5) {
    pushNote(notes, {
      id: "r-blowout",
      tone: "neg",
      priority: 2,
      headline: `Loss exceeded plan at ${insights.rMultiple.toFixed(1)}R`,
      detail:
        "This is more than a normal stop-out. Check for oversizing, moving the stop, or averaging down against your rules.",
    });
  }

  if (isLoss && insights.mae != null && insights.initialRisk != null && insights.initialRisk > 0) {
    const maeR = Math.abs(insights.mae) / insights.initialRisk;
    if (maeR > 1.2) {
      pushNote(notes, {
        id: "mae-exceeded",
        tone: "warn",
        priority: 5,
        headline: "Adverse excursion exceeded planned risk",
        detail: `MAE was ~${maeR.toFixed(1)}× your recorded risk. Either the stop was widened or the plan wasn't followed.`,
      });
    }
  }

  if (insights.fillCount >= 3) {
    const scaleNote =
      trade.fills.filter((f) => f.side === (trade.direction === "long" ? "buy" : "sell")).length >=
      2;
    pushNote(notes, {
      id: "many-fills",
      tone: isLoss && scaleNote ? "warn" : "tip",
      priority: 7,
      headline: `${insights.fillCount} executions on one trade`,
      detail:
        scaleNote && isLoss
          ? "Multiple adds before exit on a loser — classic averaging behavior. Decide in advance whether scaling in is allowed for this setup."
          : "Multiple fills increase fee drag and slippage. Make sure each add had a defined reason.",
    });
  }

  const setupRank = gradeRank(insights.setupGrade as TradeGrade);
  const execRank = gradeRank(insights.executionGrade as TradeGrade);
  if (setupRank >= 4 && execRank > 0 && execRank <= 2) {
    pushNote(notes, {
      id: "setup-exec-gap",
      tone: "warn",
      priority: 6,
      headline: "Good setup, weak execution",
      detail: `You rated the setup ${insights.setupGrade} but execution ${insights.executionGrade}. The idea may be fine — focus on entries, sizing, and stop discipline.`,
    });
  }

  if (setupRank > 0 && setupRank <= 2 && isLoss) {
    pushNote(notes, {
      id: "weak-setup",
      tone: "tip",
      priority: 8,
      headline: "Low setup grade on a loser",
      detail: `You marked setup ${insights.setupGrade}. Filter similar B/C setups from your playbook or tighten entry criteria.`,
    });
  }

  if (trade.time_in_trade_secs != null && trade.time_in_trade_secs < 1800 && isLoss) {
    pushNote(notes, {
      id: "quick-loss",
      tone: "tip",
      priority: 9,
      headline: "Quick loss — thesis failed fast",
      detail: `Held only ${insights.holdLabel}. That can be good risk control if the stop was planned; bad if you panic-exited before the setup developed.`,
    });
  }

  if (isWin && insights.rMultiple != null && insights.rMultiple >= 2) {
    pushNote(notes, {
      id: "strong-win",
      tone: "pos",
      priority: 10,
      headline: `Strong +${insights.rMultiple.toFixed(1)}R result`,
      detail: planRecorded(insights)
        ? "Process and outcome aligned. Capture what you did right in review notes so you can repeat it."
        : "Good outcome — still log your plan next time so wins are reproducible, not lucky.",
    });
  }

  if (isFlat && isClosed) {
    pushNote(notes, {
      id: "breakeven",
      tone: "tip",
      priority: 10,
      headline: "Scratch trade",
      detail:
        "Break-even after fees is still a process check: did you follow the plan, and was the setup worth the mental capital?",
    });
  }

  for (const tag of mistakeTags) {
    if (/no plan/i.test(tag)) continue; // covered above
    pushNote(notes, {
      id: `mistake-${tag}`,
      tone: "warn",
      priority: 5,
      headline: `Mistake: ${tag}`,
      detail:
        "You flagged this yourself — add one concrete rule in review notes to prevent the same mistake.",
    });
  }

  return notes.sort((a, b) => a.priority - b.priority).slice(0, 5);
}

export function coachHasNotes(trade: TradeDetail, insights: TradeInsights): boolean {
  return generateTradeCoachNotes(trade, insights).length > 0;
}
