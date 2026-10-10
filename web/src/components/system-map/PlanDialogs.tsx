import { t } from "@lingui/core/macro";
import { AlertTriangle, Link2 } from "lucide-react";
import { useId, useState } from "react";
import { DateTimePicker } from "@/components/DateTimePicker";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/Dialog";
import { Field } from "@/components/Field";
import { FormInput, FormTextarea } from "@/components/FormInput";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Skeleton } from "@/components/Skeleton";
import { Button } from "@/components/ui/button";
import type { CreatePlanBody, PlanCandidate, PlanSource, SystemPlan } from "@/lib/api/system";
import { cn } from "@/lib/cn";
import { isoToWallClock, wallClockToIso } from "@/lib/displayPrefs";
import { fmtDateTime } from "@/lib/format";
import { intlLocale } from "@/lib/locale";
import { usePlanCandidates } from "@/lib/hooks/useSystem";
import { useMoneyFormatters } from "@/lib/useMoneyFormatters";
import { draftFromRevision, draftToBody } from "@/lib/system-plan";

const SYMBOL_MAX = 32;
const REASON_MAX = 500;

export function directionLabel(d: "long" | "short"): string {
  return d === "long" ? t`Long` : t`Short`;
}

export function NewPlanDialog({
  open,
  onOpenChange,
  versionLabel,
  pending,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versionLabel: string;
  pending: boolean;
  onCreate: (body: CreatePlanBody) => void;
}) {
  const [symbol, setSymbol] = useState("");
  const [direction, setDirection] = useState<"long" | "short">("long");
  const [source, setSource] = useState<PlanSource>("live");
  const [occurredAt, setOccurredAt] = useState(() => isoToWallClock(new Date().toISOString()));
  const [thesis, setThesis] = useState("");
  const symbolId = useId();
  const thesisId = useId();
  const whenId = useId();
  const trimmed = symbol.trim().toUpperCase();

  const submit = () => {
    if (!trimmed || pending) return;
    onCreate({
      symbol: trimmed,
      direction,
      source,
      revision: {
        ...draftToBody({ ...draftFromRevision(null), thesis }),
        occurred_at: source === "retrospective" ? wallClockToIso(occurredAt) : null,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(520px,94vw)]">
        <DialogHeader className="flex-col items-start gap-1.5 pr-12">
          <DialogTitle>{t`New plan`}</DialogTitle>
          <DialogDescription className="text-left leading-relaxed">
            {t`Write it before the fill. It's checked against ${versionLabel}, and every save adds a revision instead of overwriting the last one.`}
          </DialogDescription>
        </DialogHeader>
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <DialogBody className="flex flex-col gap-4 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <Field label={t`Symbol`} htmlFor={symbolId}>
                <FormInput
                  id={symbolId}
                  autoFocus
                  value={symbol}
                  maxLength={SYMBOL_MAX}
                  placeholder="NVDA"
                  autoComplete="off"
                  onChange={(e) => setSymbol(e.target.value)}
                />
              </Field>
              <Field label={t`Side`}>
                <SegmentedControl
                  ariaLabel={t`Side`}
                  fullWidth
                  value={direction}
                  onChange={(v) => setDirection(v as "long" | "short")}
                  options={[
                    { value: "long", label: t`Long` },
                    { value: "short", label: t`Short` },
                  ]}
                />
              </Field>
            </div>
            <Field
              label={t`When`}
              description={
                source === "live"
                  ? t`Recorded now, before any fill.`
                  : t`Marked as written after the fact, so it never passes for a plan made in advance.`
              }
            >
              <SegmentedControl
                ariaLabel={t`When`}
                fullWidth
                value={source}
                onChange={(v) => setSource(v as PlanSource)}
                options={[
                  { value: "live", label: t`Planning now` },
                  { value: "retrospective", label: t`After the fact` },
                ]}
              />
            </Field>
            {source === "retrospective" ? (
              <Field label={t`When it happened`} htmlFor={whenId}>
                <DateTimePicker
                  id={whenId}
                  aria-label={t`When it happened`}
                  value={occurredAt}
                  onChange={setOccurredAt}
                />
              </Field>
            ) : null}
            <Field label={t`Thesis (optional)`} htmlFor={thesisId}>
              <FormTextarea
                id={thesisId}
                rows={2}
                value={thesis}
                placeholder={t`Why this, why now`}
                onChange={(e) => setThesis(e.target.value)}
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t`Cancel`}
            </Button>
            <Button type="submit" disabled={!trimmed || pending}>
              {pending ? t`Creating…` : t`Create plan`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  pending: boolean;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const inputId = useId();
  const trimmed = reason.trim();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(480px,94vw)]">
        <DialogHeader className="flex-col items-start gap-1.5 pr-12">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-left leading-relaxed">{description}</DialogDescription>
        </DialogHeader>
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            if (trimmed && !pending) onConfirm(trimmed);
          }}
        >
          <DialogBody className="gap-2 pt-1">
            <label htmlFor={inputId} className="text-sm font-medium">
              {t`Reason`}
            </label>
            <FormTextarea
              id={inputId}
              autoFocus
              rows={2}
              maxLength={REASON_MAX}
              value={reason}
              placeholder={t`Kept in the plan's history`}
              onChange={(e) => setReason(e.target.value)}
            />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t`Back`}
            </Button>
            <Button
              type="submit"
              variant={destructive ? "destructive" : "default"}
              disabled={!trimmed || pending}
            >
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CandidateRow({
  c,
  plan,
  picked,
  onPick,
}: {
  c: PlanCandidate;
  plan: SystemPlan;
  picked: boolean;
  onPick: () => void;
}) {
  const { fmtSignedMoney } = useMoneyFormatters();
  const elsewhere = c.linked_plan_id != null && c.linked_plan_id !== plan.id;
  const warnings: string[] = [];
  if (c.direction !== plan.direction) warnings.push(t`Opposite side to the plan`);
  if (c.opened_before_plan && plan.source === "live") {
    warnings.push(t`Opened before this plan was written`);
  }
  return (
    <li>
      <button
        type="button"
        role="radio"
        aria-checked={picked}
        disabled={elsewhere}
        onClick={onPick}
        className={cn(
          "flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2.5 text-start",
          "transition-colors duration-150 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent",
          picked && "bg-accent ring-2 ring-primary",
        )}
      >
        <span className="min-w-0">
          <span className="flex items-baseline gap-2">
            <span className="text-sm font-medium">{c.symbol}</span>
            <span className="text-2xs text-muted-foreground">
              {directionLabel(c.direction)} · {fmtDateTime(c.opened_at)}
            </span>
          </span>
          {elsewhere ? (
            <span className="mt-0.5 block text-2xs text-muted-foreground">
              {t`Already confirms another plan`}
            </span>
          ) : null}
          {!elsewhere && warnings.length > 0 ? (
            <span className="mt-0.5 flex items-center gap-1 text-2xs text-warning-foreground">
              <AlertTriangle className="size-3" aria-hidden />
              {warnings.join(" · ")}
            </span>
          ) : null}
        </span>
        <span className="shrink-0 text-end text-2xs text-muted-foreground tabular-nums">
          {c.net_pnl != null
            ? fmtSignedMoney(c.net_pnl, c.pnl_currency || "USD", intlLocale())
            : t`Open`}
        </span>
      </button>
    </li>
  );
}

export function LinkTradeDialog({
  open,
  onOpenChange,
  plan,
  pending,
  onLink,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: SystemPlan;
  pending: boolean;
  onLink: (tradeId: string) => void;
}) {
  const candidates = usePlanCandidates(plan.id, open);
  const [picked, setPicked] = useState<string | null>(null);
  const list = candidates.data ?? [];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(520px,94vw)]">
        <DialogHeader className="flex-col items-start gap-1.5 pr-12">
          <DialogTitle>{t`Link the trade that filled this plan`}</DialogTitle>
          <DialogDescription className="text-left leading-relaxed">
            {t`Pick the ${plan.symbol} trade yourself — nothing is matched automatically. You can unlink it later; both steps stay in the history.`}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {candidates.isLoading ? <Skeleton className="h-24" /> : null}
          {candidates.isError ? (
            <p className="text-sm text-destructive-foreground">{t`Could not load trades.`}</p>
          ) : null}
          {candidates.data && list.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t`No ${plan.symbol} trades yet. Import or log the fill, then link it here.`}
            </p>
          ) : null}
          {list.length > 0 ? (
            <ul role="radiogroup" aria-label={t`Trades`} className="flex flex-col gap-1">
              {list.map((c) => (
                <CandidateRow
                  key={c.id}
                  c={c}
                  plan={plan}
                  picked={picked === c.id}
                  onPick={() => setPicked(c.id)}
                />
              ))}
            </ul>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t`Cancel`}
          </Button>
          <Button
            type="button"
            disabled={!picked || pending}
            onClick={() => picked && onLink(picked)}
          >
            <Link2 className="size-4" aria-hidden />
            {t`Link trade`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
