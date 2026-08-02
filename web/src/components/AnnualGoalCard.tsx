import { Pencil, Target, Trash2 } from "lucide-react";
import { useState } from "react";
import { AmountInput } from "@/components/AmountInput";
import { Card } from "@/components/Card";
import { GoalProgressBar } from "@/components/GoalProgressBar";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { pnlColor } from "@/components/theme-tokens";
import {
  type AnnualGoalProgress,
  type GoalPaceStatus,
  computeAnnualGoalProgress,
} from "@/lib/annualGoal";
import { cn } from "@/lib/cn";
import { usePrivacyMode } from "@/lib/displayPrefs";
import { fmtMoney, fmtMoneyCompact, fmtPct, fmtSignedMoney } from "@/lib/format";
import { intlLocale } from "@/lib/locale";

function paceLabel(status: GoalPaceStatus): string {
  switch (status) {
    case "over":
      return "Goal reached";
    case "ahead":
      return "Ahead of pace";
    case "behind":
      return "Behind pace";
    default:
      return "On track";
  }
}

function paceTone(status: GoalPaceStatus): string {
  switch (status) {
    case "over":
    case "ahead":
      return "text-profit";
    case "behind":
      return "text-destructive";
    default:
      return "text-muted-foreground";
  }
}

export interface AnnualGoalCardProps {
  year: number;
  goalAmount: number | null | undefined;
  ytdNetPnl: number | undefined;
  currency: string;
  fxRate?: number;
  variant?: "hero" | "compact";
  loading?: boolean;
  saving?: boolean;
  className?: string;
  onSave: (amount: number) => Promise<void>;
  onClear?: () => Promise<void>;
}

export function AnnualGoalCard({
  year,
  goalAmount,
  ytdNetPnl,
  currency,
  fxRate = 1,
  variant = "hero",
  loading = false,
  saving = false,
  className,
  onSave,
  onClear,
}: AnnualGoalCardProps) {
  usePrivacyMode();
  const locale = intlLocale();
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const money = (v: number) => v * fxRate;
  const hasGoal = goalAmount != null && goalAmount > 0;
  const progress: AnnualGoalProgress | null =
    hasGoal && ytdNetPnl != null ? computeAnnualGoalProgress(goalAmount, ytdNetPnl, year) : null;

  function openEditor() {
    setDraft(hasGoal ? String(goalAmount) : "");
    setError(null);
    setEditOpen(true);
  }

  async function handleSave() {
    const parsed = Number(draft.replace(/,/g, ""));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Enter a goal greater than zero.");
      return;
    }
    setError(null);
    try {
      await onSave(parsed);
      setEditOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save goal");
    }
  }

  async function handleClear() {
    if (!onClear) return;
    setError(null);
    try {
      await onClear();
      setEditOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not clear goal");
    }
  }

  const editModal = (
    <Modal
      open={editOpen}
      onOpenChange={setEditOpen}
      title={`${year} P&L goal`}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          {hasGoal && onClear ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={saving}
              onClick={() => void handleClear()}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 size={14} strokeWidth={1.5} />
              Clear
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setEditOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={saving} onClick={() => void handleSave()}>
              {saving ? "Saving…" : "Save goal"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-muted-foreground">
            Target net P&L ({currency})
          </span>
          <AmountInput
            value={draft}
            onValueChange={setDraft}
            placeholder="100000"
            aria-label="Annual P&L goal amount"
            autoFocus
          />
        </label>
        {error ? <p className="m-0 text-[12px] text-destructive">{error}</p> : null}
        <p className="m-0 text-[12px] leading-relaxed text-muted-foreground">
          Progress uses calendar-year net P&L for {year}, respecting your account filter.
        </p>
      </div>
    </Modal>
  );

  // The page column is a flex column: shrink-0 keeps a card from being squeezed
  // below its content height.
  const cardClass = cn("shrink-0", className);

  // Passed as a node rather than a plain string so the home page's amber section
  // heading survives the move onto Card (whose string titles are muted grey).
  const cardTitle = (
    <h2 className="m-0 text-[12px] font-semibold tracking-wide text-chart-3">
      Annual P&L Goal · {year}
    </h2>
  );

  const editAction = (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Edit annual goal"
      onClick={openEditor}
      className="size-7 text-muted-foreground"
    >
      <Pencil size={13} strokeWidth={1.5} />
    </Button>
  );

  if (loading) {
    return (
      <Card title={cardTitle} className={cardClass}>
        <div className="h-8 w-20 animate-pulse rounded bg-muted" />
        <div className="mt-4 h-5 w-full animate-pulse rounded bg-muted" />
      </Card>
    );
  }

  if (!hasGoal || !progress) {
    return (
      <>
        <Card
          title={cardTitle}
          action={
            <Target
              size={18}
              strokeWidth={1.5}
              className="shrink-0 text-muted-foreground"
              aria-hidden
            />
          }
          className={cardClass}
        >
          <p className="m-0 text-[13px] text-muted-foreground">
            Set a {year} net P&L target to track progress here.
          </p>
          <Button type="button" variant="outline" size="sm" className="mt-4" onClick={openEditor}>
            Set annual goal
          </Button>
        </Card>
        {editModal}
      </>
    );
  }

  const fillClass =
    progress.paceStatus === "behind" && progress.progress < 1 ? "bg-warning" : "bg-profit";

  if (variant === "compact") {
    return (
      <>
        <Card title={cardTitle} action={editAction} className={cardClass}>
          <p className="m-0 flex flex-wrap items-baseline gap-1.5 text-[20px] font-semibold tabular-nums tracking-tight text-foreground sm:text-[22px]">
            <span className={pnlColor(progress.ytdNetPnl)}>
              {fmtMoneyCompact(money(progress.ytdNetPnl), currency, locale)}
            </span>
            <span className="text-[13px] font-medium text-muted-foreground">
              of {fmtMoneyCompact(money(progress.goal), currency, locale)}
            </span>
          </p>
          <GoalProgressBar
            progress={progress.progress}
            className="mt-3 h-4"
            fillClassName={fillClass}
            aria-label={`${year} goal progress`}
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[12px]">
            <span className={cn("font-medium tabular-nums", paceTone(progress.paceStatus))}>
              {fmtPct(progress.progressPct / 100, locale)} · {paceLabel(progress.paceStatus)}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {progress.overBy > 0
                ? `Over by ${fmtMoneyCompact(money(progress.overBy), currency, locale)}`
                : `Left ${fmtMoneyCompact(money(progress.remaining), currency, locale)}`}
            </span>
          </div>
        </Card>
        {editModal}
      </>
    );
  }

  // Hero variant
  return (
    <>
      {/*
       * Two-part instrument: the summary sits in a fixed left column, and the bar
       * takes the rest with YTD / Goal / Left annotating its ends. Stacking them
       * vertically instead leaves every value pinned to an edge of a card that is
       * as wide as the viewport.
       */}
      <Card title={cardTitle} action={editAction} className={cardClass}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-8">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 lg:w-[260px] lg:shrink-0">
            <p className="m-0 text-[32px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-foreground">
              {fmtPct(Math.min(progress.progressPct, 999) / 100, locale)}
            </p>
            <p
              className={cn(
                "m-0 text-[13px] font-medium tabular-nums",
                paceTone(progress.paceStatus),
              )}
            >
              {progress.paceStatus === "over" ? (
                <>+{fmtPct((progress.progressPct - 100) / 100, locale)} over goal</>
              ) : (
                <>
                  {fmtSignedMoney(money(progress.paceDelta), currency, locale)}
                  <span className="ml-1 font-normal text-muted-foreground">vs linear pace</span>
                </>
              )}
            </p>
          </div>

          <div className="min-w-0 flex-1">
            <GoalProgressBar
              progress={progress.progress}
              fillClassName={fillClass}
              aria-label={`${year} goal progress`}
            />

            <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-[13px] tabular-nums">
              <p className="m-0">
                <span className="font-medium text-muted-foreground">YTD </span>
                <span className={cn("font-semibold", pnlColor(progress.ytdNetPnl))}>
                  {fmtMoney(money(progress.ytdNetPnl), currency, locale)}
                </span>
              </p>
              <p className="m-0 text-muted-foreground">
                Goal{" "}
                <span className="font-semibold text-foreground">
                  {fmtMoney(money(progress.goal), currency, locale)}
                </span>
                <span className="mx-1.5 text-muted-foreground/50" aria-hidden>
                  ·
                </span>
                {progress.overBy > 0 ? (
                  <>
                    Over{" "}
                    <span className="font-semibold text-profit">
                      {fmtMoney(money(progress.overBy), currency, locale)}
                    </span>
                  </>
                ) : (
                  <>
                    Left{" "}
                    <span className="font-semibold text-foreground">
                      {fmtMoney(money(progress.remaining), currency, locale)}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </Card>
      {editModal}
    </>
  );
}
