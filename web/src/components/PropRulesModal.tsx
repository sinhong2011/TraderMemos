import { useEffect, useState } from "react";
import type { DrawdownMode, PropSettings } from "@/lib/api/prop";
import { usePropSettings, useSavePropSettings } from "@/lib/hooks/useProp";
import { AmountInput } from "./AmountInput";
import { Field } from "./Field";
import { Modal } from "./Modal";
import { OptionsSelect } from "./OptionsSelect";
import { useToastManager } from "./Toast";
import { Button } from "./ui/button";

const MODE_OPTIONS: { value: DrawdownMode; label: string }[] = [
  { value: "trailing", label: "Trailing (ratchets on every high)" },
  { value: "eod", label: "End-of-day trailing" },
  { value: "static", label: "Static (fixed floor)" },
];

function numOrNull(s: string): number | null {
  const v = Number(s);
  return s.trim() !== "" && Number.isFinite(v) && v > 0 ? v : null;
}

export interface PropRulesButtonProps {
  accountId: string;
  accountName: string;
}

/**
 * Program-rules editor for a funded account: profit target, drawdown model,
 * daily loss limit, and consistency rule — the numbers the prop status card
 * evaluates against.
 */
export function PropRulesButton({ accountId, accountName }: PropRulesButtonProps) {
  const [open, setOpen] = useState(false);
  const toast = useToastManager();
  const settingsQ = usePropSettings(accountId, open);
  const save = useSavePropSettings(accountId);

  const [target, setTarget] = useState("");
  const [maxDd, setMaxDd] = useState("");
  const [mode, setMode] = useState<DrawdownMode>("trailing");
  const [dailyLoss, setDailyLoss] = useState("");
  const [consistency, setConsistency] = useState("");

  useEffect(() => {
    const s = settingsQ.data;
    if (!s) return;
    setTarget(s.profit_target != null ? String(s.profit_target) : "");
    setMaxDd(s.max_drawdown != null ? String(s.max_drawdown) : "");
    setMode(s.drawdown_mode ?? "trailing");
    setDailyLoss(s.daily_loss_limit != null ? String(s.daily_loss_limit) : "");
    setConsistency(s.consistency_pct != null ? String(s.consistency_pct * 100) : "");
  }, [settingsQ.data]);

  function handleSave() {
    const pctRaw = Number(consistency);
    const body: PropSettings = {
      profit_target: numOrNull(target),
      max_drawdown: numOrNull(maxDd),
      drawdown_mode: mode,
      daily_loss_limit: numOrNull(dailyLoss),
      consistency_pct:
        consistency.trim() !== "" && Number.isFinite(pctRaw) && pctRaw > 0 && pctRaw <= 100
          ? pctRaw / 100
          : null,
    };
    save.mutate(body, {
      onSuccess: () => {
        toast.add({ title: "Prop rules saved", description: accountName });
        setOpen(false);
      },
      onError: (err) => {
        toast.add({
          title: "Could not save prop rules",
          description: err instanceof Error ? err.message : "Save failed",
        });
      },
    });
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Prop rules
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={`Prop rules — ${accountName}`}
        className="max-w-[min(420px,94vw)]"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save rules"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="m-0 text-[12px] leading-relaxed text-muted-foreground">
            Enter your program&apos;s numbers; leave a field empty to skip that rule. The account
            card tracks equity against them.
          </p>
          <Field label="Profit target">
            <AmountInput value={target} onValueChange={setTarget} placeholder="3000" />
          </Field>
          <Field label="Max drawdown">
            <AmountInput value={maxDd} onValueChange={setMaxDd} placeholder="2000" />
          </Field>
          <Field label="Drawdown model">
            <OptionsSelect
              value={mode}
              onValueChange={(v) => setMode(v as DrawdownMode)}
              ariaLabel="Drawdown model"
              options={MODE_OPTIONS}
            />
          </Field>
          <Field label="Daily loss limit">
            <AmountInput value={dailyLoss} onValueChange={setDailyLoss} placeholder="1000" />
          </Field>
          <Field label="Consistency rule (% of profit one day may hold)">
            <AmountInput value={consistency} onValueChange={setConsistency} placeholder="40" />
          </Field>
        </div>
      </Modal>
    </>
  );
}
