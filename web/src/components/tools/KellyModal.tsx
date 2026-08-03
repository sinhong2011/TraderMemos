import { useEffect, useMemo, useState } from "react";
import { fieldInputClass } from "@/components/field-styles";
import { Modal } from "@/components/Modal";
import { useFilterParams } from "@/lib/filters";
import { useSummary } from "@/lib/hooks/useAnalytics";
import { kellyFraction } from "@/lib/kelly";

const labelClass =
  "mb-1 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground";
const inputClass = fieldInputClass;

export function KellyModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const filters = useFilterParams();
  const summary = useSummary(filters).data;

  const [winRate, setWinRate] = useState("50");
  const [payoff, setPayoff] = useState("1.5");
  const [seeded, setSeeded] = useState(false);

  // Each open seeds from the trader's actual stats (current filters) when
  // there is at least one win and one loss to derive them from.
  useEffect(() => {
    if (!open) {
      setSeeded(false);
      return;
    }
    if (seeded || !summary) return;
    if (summary.wins > 0 && summary.losses > 0 && summary.avg_loss > 0) {
      setWinRate((summary.win_rate * 100).toFixed(1));
      setPayoff((summary.avg_win / summary.avg_loss).toFixed(2));
    }
    setSeeded(true);
  }, [open, seeded, summary]);

  const kelly = useMemo(
    () => kellyFraction(Number(winRate) / 100, Number(payoff)),
    [winRate, payoff],
  );

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Kelly criterion"
      className="max-w-[420px]"
    >
      <p className="m-0 text-xs leading-relaxed text-muted-foreground">
        Optimal fraction of capital to risk per trade from win rate and payoff ratio. Prefilled from
        your recorded stats when available.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass} htmlFor="kelly-winrate">
            Win rate %
          </label>
          <input
            id="kelly-winrate"
            className={inputClass}
            inputMode="decimal"
            value={winRate}
            onChange={(e) => setWinRate(e.target.value)}
            placeholder="55"
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="kelly-payoff">
            Payoff (win ÷ loss)
          </label>
          <input
            id="kelly-payoff"
            className={inputClass}
            inputMode="decimal"
            value={payoff}
            onChange={(e) => setPayoff(e.target.value)}
            placeholder="1.5"
          />
        </div>
      </div>
      {kelly != null ? (
        <div className="rounded-panel border border-border bg-muted px-3.5 py-3">
          <p className="m-0 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Full Kelly
          </p>
          <p className="mt-1 mb-0 text-2xl tabular-nums text-foreground">
            {(kelly * 100).toFixed(1)}%
          </p>
          {kelly > 0 ? (
            <p className="mt-1 mb-0 text-[11px] tabular-nums text-muted-foreground">
              Half Kelly {(kelly * 50).toFixed(1)}% · Quarter {(kelly * 25).toFixed(1)}% — most
              traders size at half Kelly or less.
            </p>
          ) : (
            <p className="mt-1 mb-0 text-[11px] text-muted-foreground">
              No positive edge at these numbers — Kelly says risk nothing until win rate or payoff
              improves.
            </p>
          )}
        </div>
      ) : (
        <p className="m-0 text-xs text-muted-foreground">
          Enter a win rate (0–100) and a payoff ratio above zero.
        </p>
      )}
    </Modal>
  );
}
