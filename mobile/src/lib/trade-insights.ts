/**
 * Derived trade metrics + deterministic rule-based coach notes, ported from
 * web/src/lib/tradeInsights.ts (same rules and priorities; copy localized
 * through the t macro). The LLM coach layers on top — these always render.
 */

import { t } from '@lingui/core/macro';

import type { TradeDetail } from '@/api/types';
import { gradeFromInt, intFromGrade, parseJournalNotes } from '@/lib/journal';
import { computeRiskReward } from '@/lib/risk-reward';

export type CoachTone = 'neg' | 'warn' | 'pos' | 'tip';

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
  /** Favorable continuation after the exit — what holding longer was worth. */
  postExitMfe: number | null;
  /** Adverse move after the exit — what exiting avoided. */
  postExitMae: number | null;
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
    postExitMfe: trade.post_exit_mfe,
    postExitMae: trade.post_exit_mae,
    holdLabel: rr.holdLabel,
    fillCount: trade.fills.length,
    qtyOpened: trade.qty_opened,
    qtyRemaining: trade.qty_remaining,
    setupName: trade.setup?.name ?? null,
    emotion: trade.emotional_state?.trim() ? trade.emotional_state : null,
    setupGrade: gradeFromInt(trade.confidence) || '',
    executionGrade: gradeFromInt(trade.trade_quality) || '',
    tagNames: (trade.tags ?? []).map((tag) => tag.name),
  };
}

const LOSS_EMOTIONS = new Set(['Overconfident', 'Greedy', 'FOMO', 'Revenge', 'Bored']);
const FEAR_EMOTIONS = new Set(['Anxious', 'Fearful', 'Tired']);

function planRecorded(insights: TradeInsights): boolean {
  return (
    (insights.initialRisk != null && insights.initialRisk > 0) ||
    insights.stop != null ||
    insights.target != null
  );
}

/** Rule-based coaching copy from trade + derived metrics (offline, deterministic). */
export function generateTradeCoachNotes(
  trade: TradeDetail,
  insights: TradeInsights,
): TradeCoachNote[] {
  const notes: TradeCoachNote[] = [];
  const net = insights.netPnl;
  const isClosed = trade.status === 'closed';
  const isLoss = net != null && net < 0;
  const isWin = net != null && net > 0;
  const isFlat = net === 0;
  const journal = parseJournalNotes(trade.notes ?? '');
  const mistakeTags = (trade.tags ?? [])
    .filter((tag) => tag.kind === 'mistake')
    .map((tag) => tag.name);
  const hasMistakeNoPlan = mistakeTags.some((name) => /no plan/i.test(name));

  if (isClosed && !planRecorded(insights)) {
    notes.push({
      id: 'no-plan',
      tone: 'neg',
      priority: 1,
      headline: t`No plan was recorded before the trade`,
      detail: hasMistakeNoPlan
        ? t`Risk, target, and stop are blank — and you tagged this as no plan. Define all three before entry next time so you can measure R and review honestly.`
        : t`Risk, target, and stop are all empty. Without a plan you can't judge whether the loss was bad luck or bad process.`,
    });
  }

  if (isClosed && !journal.entryReason.trim()) {
    notes.push({
      id: 'no-entry-reason',
      tone: 'warn',
      priority: 4,
      headline: t`Missing entry reason`,
      detail: t`Write why you entered while it's fresh. Future you needs the thesis, not just the P&L.`,
    });
  }

  if (isClosed && isLoss && !journal.exitReason.trim()) {
    notes.push({
      id: 'no-exit-reason',
      tone: 'warn',
      priority: 5,
      headline: t`Missing exit reason on a loser`,
      detail: t`Document why you closed — stop hit, thesis broken, or emotion — so you can spot repeat patterns.`,
    });
  }

  if (isLoss && insights.emotion && LOSS_EMOTIONS.has(insights.emotion)) {
    notes.push({
      id: 'emotion-loss',
      tone: 'neg',
      priority: 2,
      headline: t`${insights.emotion} state paired with a loss`,
      detail:
        insights.emotion === 'Overconfident'
          ? t`Overconfidence often shows up as oversizing or ignoring your stop. Check whether conviction exceeded your edge on this setup.`
          : t`${insights.emotion} can push size or timing. Compare this trade to your playbook rules before taking the next similar signal.`,
    });
  }

  if (isWin && insights.emotion && FEAR_EMOTIONS.has(insights.emotion)) {
    notes.push({
      id: 'emotion-win',
      tone: 'warn',
      priority: 6,
      headline: t`${insights.emotion} but the trade still won`,
      detail: t`You may have cut a winner early. Check MFE vs net — if you left meaningful profit, work on hold rules for this setup.`,
    });
  }

  if (insights.feeDragPct != null && insights.feeDragPct >= 0.15) {
    const pct = (insights.feeDragPct * 100).toFixed(0);
    notes.push({
      id: 'fee-drag-high',
      tone: 'neg',
      priority: 3,
      headline: t`Fees took a large bite of gross P&L`,
      detail: t`Commissions and fees were ${pct}% of gross — that materially changes the outcome. Fewer legs or lower-cost fills would help.`,
    });
  } else if (insights.feeDragPct != null && insights.feeDragPct >= 0.05 && isLoss) {
    const pct = (insights.feeDragPct * 100).toFixed(1);
    notes.push({
      id: 'fee-drag-moderate',
      tone: 'warn',
      priority: 7,
      headline: t`Fees amplified a small loss`,
      detail: t`${pct}% of gross went to fees across ${insights.fillCount} fills. Consider whether every add was worth the cost.`,
    });
  }

  if (
    isWin &&
    insights.mfeCapturePct != null &&
    insights.mfeCapturePct < 0.35 &&
    insights.mfe != null
  ) {
    const pct = (insights.mfeCapturePct * 100).toFixed(0);
    notes.push({
      id: 'poor-capture',
      tone: 'warn',
      priority: 4,
      headline: t`Most of the move was left on the table`,
      detail: t`You captured ${pct}% of MFE. Review your exit trigger — trailing stop or partial targets may fit this setup better.`,
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
      const r = leftR.toFixed(1);
      notes.push({
        id: 'left-on-table',
        tone: 'tip',
        priority: 8,
        headline: t`~${r}R given back from the peak`,
        detail: t`The trade worked but closed well off its best point. Note what would have kept you in for the next similar setup.`,
      });
    }
  }

  if (insights.postExitMfe != null && insights.initialRisk != null && insights.initialRisk > 0) {
    const postR = insights.postExitMfe / insights.initialRisk;
    const avoidedR = (insights.postExitMae ?? 0) / insights.initialRisk;
    if (postR >= 1) {
      const r = postR.toFixed(1);
      notes.push({
        id: 'exited-early',
        tone: 'tip',
        priority: 8,
        headline: t`~${r}R more ran after your exit`,
        detail: t`Price kept going your way in the window after the close. If this repeats on this setup, consider a runner or a trailing stop.`,
      });
    } else if (avoidedR >= 1 && postR < 0.5) {
      const r = avoidedR.toFixed(1);
      notes.push({
        id: 'well-timed-exit',
        tone: 'pos',
        priority: 9,
        headline: t`Exit dodged ~${r}R of drawdown`,
        detail: t`Price moved against the position soon after you closed. Whatever triggered this exit is worth writing down.`,
      });
    }
  }

  if (isLoss && insights.rMultiple != null && insights.rMultiple <= -1.5) {
    const r = insights.rMultiple.toFixed(1);
    notes.push({
      id: 'r-blowout',
      tone: 'neg',
      priority: 2,
      headline: t`Loss exceeded plan at ${r}R`,
      detail: t`This is more than a normal stop-out. Check for oversizing, moving the stop, or averaging down against your rules.`,
    });
  }

  if (isLoss && insights.mae != null && insights.initialRisk != null && insights.initialRisk > 0) {
    const maeR = Math.abs(insights.mae) / insights.initialRisk;
    if (maeR > 1.2) {
      const r = maeR.toFixed(1);
      notes.push({
        id: 'mae-exceeded',
        tone: 'warn',
        priority: 5,
        headline: t`Adverse excursion exceeded planned risk`,
        detail: t`MAE was ~${r}× your recorded risk. Either the stop was widened or the plan wasn't followed.`,
      });
    }
  }

  if (insights.fillCount >= 3) {
    const scaleNote =
      trade.fills.filter((fill) => fill.side === (trade.direction === 'long' ? 'buy' : 'sell'))
        .length >= 2;
    notes.push({
      id: 'many-fills',
      tone: isLoss && scaleNote ? 'warn' : 'tip',
      priority: 7,
      headline: t`${insights.fillCount} executions on one trade`,
      detail:
        scaleNote && isLoss
          ? t`Multiple adds before exit on a loser — classic averaging behavior. Decide in advance whether scaling in is allowed for this setup.`
          : t`Multiple fills increase fee drag and slippage. Make sure each add had a defined reason.`,
    });
  }

  const setupRank = intFromGrade(insights.setupGrade) ?? 0;
  const execRank = intFromGrade(insights.executionGrade) ?? 0;
  if (setupRank >= 4 && execRank > 0 && execRank <= 2) {
    notes.push({
      id: 'setup-exec-gap',
      tone: 'warn',
      priority: 6,
      headline: t`Good setup, weak execution`,
      detail: t`You rated the setup ${insights.setupGrade} but execution ${insights.executionGrade}. The idea may be fine — focus on entries, sizing, and stop discipline.`,
    });
  }

  if (setupRank > 0 && setupRank <= 2 && isLoss) {
    notes.push({
      id: 'weak-setup',
      tone: 'tip',
      priority: 8,
      headline: t`Low setup grade on a loser`,
      detail: t`You marked setup ${insights.setupGrade}. Filter similar B/C setups from your playbook or tighten entry criteria.`,
    });
  }

  if (trade.time_in_trade_secs != null && trade.time_in_trade_secs < 1800 && isLoss) {
    notes.push({
      id: 'quick-loss',
      tone: 'tip',
      priority: 9,
      headline: t`Quick loss — thesis failed fast`,
      detail: t`Held only ${insights.holdLabel}. That can be good risk control if the stop was planned; bad if you panic-exited before the setup developed.`,
    });
  }

  if (isWin && insights.rMultiple != null && insights.rMultiple >= 2) {
    const r = insights.rMultiple.toFixed(1);
    notes.push({
      id: 'strong-win',
      tone: 'pos',
      priority: 10,
      headline: t`Strong +${r}R result`,
      detail: planRecorded(insights)
        ? t`Process and outcome aligned. Capture what you did right in review notes so you can repeat it.`
        : t`Good outcome — still log your plan next time so wins are reproducible, not lucky.`,
    });
  }

  if (isFlat && isClosed) {
    notes.push({
      id: 'breakeven',
      tone: 'tip',
      priority: 10,
      headline: t`Scratch trade`,
      detail: t`Break-even after fees is still a process check: did you follow the plan, and was the setup worth the mental capital?`,
    });
  }

  for (const tag of mistakeTags) {
    if (/no plan/i.test(tag)) continue; // covered above
    notes.push({
      id: `mistake-${tag}`,
      tone: 'warn',
      priority: 5,
      headline: t`Mistake: ${tag}`,
      detail: t`You flagged this yourself — add one concrete rule in review notes to prevent the same mistake.`,
    });
  }

  return notes.sort((a, b) => a.priority - b.priority).slice(0, 5);
}
