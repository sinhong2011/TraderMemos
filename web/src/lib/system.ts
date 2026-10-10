import { t } from "@lingui/core/macro";
import type {
  Adherence,
  ChangeReason,
  ChecklistItem,
  DecisionId,
  ExitState,
  PlanStep,
  Rule,
  Stance,
  SystemPart,
  SystemVersion,
} from "@/lib/api/system";

export const DECISIONS: DecisionId[] = [
  "market",
  "selection",
  "setup",
  "trigger",
  "risk_budget",
  "trade_risk",
  "position_size",
  "portfolio",
  "scaling",
  "definition",
  "evidence",
  "diagnosis",
  "action",
  "measure",
  "review",
  "adjust",
];

export const PARTS: SystemPart[] = ["entry", "sizing", "exit", "review"];

export function partOf(d: DecisionId): SystemPart {
  switch (d) {
    case "market":
    case "selection":
    case "setup":
    case "trigger":
      return "entry";
    case "risk_budget":
    case "trade_risk":
    case "position_size":
    case "portfolio":
    case "scaling":
      return "sizing";
    case "definition":
    case "evidence":
    case "diagnosis":
    case "action":
      return "exit";
    default:
      return "review";
  }
}

export function partCopy(part: SystemPart): { title: string; hint: string } {
  switch (part) {
    case "entry":
      return { title: t`Entry`, hint: t`When and what you trade.` };
    case "sizing":
      return { title: t`Position sizing`, hint: t`How much risk each trade and the book carry.` };
    case "exit":
      return { title: t`Exit`, hint: t`How you read the trade after entry and what you do.` };
    case "review":
      return { title: t`Review`, hint: t`Measure, judge process apart from outcome, adjust.` };
  }
}

export function decisionCopy(id: DecisionId): { title: string; question: string; example: string } {
  switch (id) {
    case "market":
      return {
        title: t`Market environment`,
        question: t`When do I trade actively, cut risk, or stop trading?`,
        example: t`Index above the 200-day and the 50-day rising = normal; below the 200-day = defensive; more new lows than highs for two weeks = paused.`,
      };
    case "selection":
      return {
        title: t`Stock selection`,
        question: t`What qualifies? What will I never trade, even if it is going up?`,
        example: t`Liquid names above $10 with average volume over 1M; no biotech binary events.`,
      };
    case "setup":
      return {
        title: t`Setup`,
        question: t`Which price structure must exist before I prepare a trade?`,
        example: t`A base of at least 3 weeks after a 30% advance, the last pullback under 10% on falling volume.`,
      };
    case "trigger":
      return {
        title: t`Trigger`,
        question: t`Which objective event makes me actually buy? Before it happens, do I know I do nothing?`,
        example: t`Buy only on a break and hold above the pivot with volume above the 50-day average.`,
      };
    case "risk_budget":
      return {
        title: t`Risk budget`,
        question: t`The most planned risk the whole account carries at once, and when that grows or shrinks.`,
        example: t`At most 6% open risk; cut to 3% in defensive markets.`,
      };
    case "trade_risk":
      return {
        title: t`Per-trade risk`,
        question: t`The most one trade may risk, and how risk is split between better and worse odds.`,
        example: t`1% of equity per trade at full size; 0.5% when the setup is only a B.`,
      };
    case "position_size":
      return {
        title: t`Position size`,
        question: t`Size worked out from entry, stop and per-trade risk.`,
        example: t`Shares = (equity × risk%) / (entry − stop). Size follows risk, never the other way round.`,
      };
    case "portfolio":
      return {
        title: t`Portfolio check`,
        question: t`Concentration, correlation, gap, liquidity and slippage across all positions.`,
        example: t`No more than two names in the same theme; skip if the open gap risk on the book exceeds 3%.`,
      };
    case "scaling":
      return {
        title: t`Dynamic adjustment`,
        question: t`Which new evidence justifies adding, and which justifies trimming?`,
        example: t`Add only when relative strength makes a new high with the index; trim when the thesis is intact but time is half gone.`,
      };
    case "definition":
      return {
        title: t`Trade definition`,
        question: t`Type of trade, expected move, holding time, core hypothesis.`,
        example: t`Momentum swing, 2–3 weeks, targeting the measured move of the base.`,
      };
    case "evidence":
      return {
        title: t`New evidence`,
        question: t`What to watch after entry: structure, relative strength, sector, levels, catalysts.`,
        example: t`Daily close under the 10-day and sector lagging for two sessions weakens the thesis.`,
      };
    case "diagnosis":
      return {
        title: t`State diagnosis`,
        question: t`Wrong, still working, not working, or finished — how do I tell them apart?`,
        example: t`Wrong = close under the stop structure; not working = flat past planned hold with no follow-through.`,
      };
    case "action":
      return {
        title: t`Action`,
        question: t`What to do in each state: hold, trim, take profit, stop out, exit.`,
        example: t`Wrong → exit; finished → take at least half; not working past time stop → exit.`,
      };
    case "measure":
      return {
        title: t`Measure`,
        question: t`Which numbers tell me the system is working — by market, setup and adherence?`,
        example: t`Win rate, average win/loss, expectancy in R, results by regime and by setup.`,
      };
    case "review":
      return {
        title: t`Review`,
        question: t`How do I judge process apart from outcome?`,
        example: t`Use the process × outcome quadrant; wrong-but-won is the most dangerous cell.`,
      };
    case "adjust":
      return {
        title: t`Adjust`,
        question: t`Which lessons are worth a rule change, and which are just normal variance?`,
        example: t`Change a rule only with enough trades behind it; a single normal loss changes nothing.`,
      };
  }
}

export function emptyRule(): Rule {
  return { text: "", executable: false };
}

export const STANCES: Stance[] = ["normal", "defensive", "paused"];

export function stanceLabel(
  stance: Stance,
  version?: Pick<SystemVersion, "regimes"> | null,
): string {
  const custom = version?.regimes?.[stance];
  if (custom) return custom;
  switch (stance) {
    case "normal":
      return t`Normal`;
    case "defensive":
      return t`Defensive`;
    case "paused":
      return t`Paused`;
  }
}

export function stanceHint(stance: Stance): string {
  switch (stance) {
    case "normal":
      return t`Trade the system at normal risk.`;
    case "defensive":
      return t`Smaller size, fewer trades.`;
    case "paused":
      return t`Stand aside and watch.`;
  }
}

export const EXIT_STATES: ExitState[] = ["wrong", "not_working", "finished", "other"];
export const ADHERENCES: Adherence[] = ["full", "partial", "none"];
export const CHECKLIST: ChecklistItem[] = [
  "planned_entry",
  "preset_exit",
  "risk_as_planned",
  "exit_by_plan",
  "no_manual_edits",
];
export const CHANGE_REASONS: ChangeReason[] = ["execution", "regime", "risk", "other"];

export function exitStateCopy(s: ExitState): { label: string; hint: string } {
  switch (s) {
    case "wrong":
      return { label: t`Wrong`, hint: t`The core hypothesis was broken — cut.` };
    case "not_working":
      return {
        label: t`Not working`,
        hint: t`Not proven wrong, but never followed through — time and opportunity cost.`,
      };
    case "finished":
      return { label: t`Finished`, hint: t`Target reached, or the edge was fading.` };
    case "other":
      return { label: t`Other`, hint: t`Left for a reason outside the system.` };
  }
}

export function adherenceLabel(a: Adherence): string {
  switch (a) {
    case "full":
      return t`Fully followed`;
    case "partial":
      return t`Partly followed`;
    case "none":
      return t`Not followed`;
  }
}

export function checklistLabel(c: ChecklistItem): string {
  switch (c) {
    case "planned_entry":
      return t`Entered at a level planned beforehand`;
    case "preset_exit":
      return t`Stop and target were set before entry`;
    case "risk_as_planned":
      return t`Size and risk matched the plan`;
    case "exit_by_plan":
      return t`Exited by the plan, not by emotion`;
    case "no_manual_edits":
      return t`Did not move or remove the stop or target off-plan`;
  }
}

export function changeReasonCopy(r: ChangeReason): { label: string; hint: string } {
  switch (r) {
    case "execution":
      return {
        label: t`Execution error`,
        hint: t`The rule was fine; I didn't follow it. Fix the process.`,
      };
    case "regime":
      return {
        label: t`Only works in some markets`,
        hint: t`Narrow when this rule or setup may be used.`,
      };
    case "risk":
      return {
        label: t`Risk too high`,
        hint: t`Losses were too large too often. Change the sizing rules.`,
      };
    case "other":
      return { label: t`Other`, hint: t`Another reason — say which evidence.` };
  }
}

export function planStepCopy(key: PlanStep["key"]): { title: string; detail: string } {
  switch (key) {
    case "write":
      return {
        title: t`Write v1.0`,
        detail: t`Answer all 16 decisions so someone else would decide the same, then activate.`,
      };
    case "test":
      return {
        title: t`Test on past trades`,
        detail: t`Card past or backtest trades against the rules; note ambiguous, conflicting or missing cases.`,
      };
    case "live":
      return {
        title: t`Run it live`,
        detail: t`Trade it live with a card on each trade. The question is "can I follow it?", not "does it make money?". Progress counts carded live trades — not a small-size check.`,
      };
    case "revise":
      return {
        title: t`Revise the version`,
        detail: t`Activate the next version after the live run. A saved review decision comes later — this step only tracks that you revised.`,
      };
  }
}

/** Words that make a rule non-executable. Nudge only — never blocks save. */
const VAGUE_EN =
  /\b(depends|feel|feels|feeling|maybe|roughly|somewhat|kinda|sort of|if it looks|strong)\b/i;
const VAGUE_ZH = /視情況|感覺|大概|差不多|好似|可能|或許/;

export function vagueWords(text: string): string[] {
  const hits = new Set<string>();
  for (const m of text.matchAll(new RegExp(VAGUE_EN, "gi"))) hits.add(m[0].toLowerCase());
  for (const m of text.matchAll(new RegExp(VAGUE_ZH, "g"))) hits.add(m[0]);
  return [...hits];
}

export function changedDecisions(
  prev: Record<string, Rule> | undefined,
  next: Record<string, Rule>,
): DecisionId[] {
  const out: DecisionId[] = [];
  for (const d of DECISIONS) {
    const a = prev?.[d] ?? emptyRule();
    const b = next[d] ?? emptyRule();
    if (a.text !== b.text || a.executable !== b.executable) out.push(d);
  }
  return out;
}

export const VERSION_NAME_MAX = 80;

/** "v1.1 · Trend pullbacks", or just the number when the version has no name. */
export function versionTitle(v: Pick<SystemVersion, "label" | "name">): string {
  const name = v.name?.trim();
  return name ? `${v.label} · ${name}` : v.label;
}
