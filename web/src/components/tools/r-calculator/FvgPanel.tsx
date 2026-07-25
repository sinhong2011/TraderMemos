import { money, shares as fmtShares } from "@/lib/r-calculator/format";
import { useFvgStore } from "@/lib/r-calculator/useFvgStore";
import { cn } from "@/lib/cn";
import { Card } from "@/components/Card";
import { SegmentedControl } from "@/components/SegmentedControl";
import { CalcInputField } from "./CalcInputField";
import { TradeTicket, type TradeTicketRow } from "./TradeTicket";
import { WarningBanner } from "./WarningBanner";

export function FvgPanel() {
  const store = useFvgStore();
  const session = store.sessions.find((s) => s.id === store.activeId);
  if (!session) return null;

  const { result } = store;
  const isManual = session.entryAt === "manual";
  const long = session.direction === "long";

  const ticketRows: TradeTicketRow[] = [
    { label: "Direction", value: long ? "Long" : "Short" },
    { label: "Entry", value: `$${money(result.entryPrice)}` },
    { label: "Stop", value: `$${money(result.stopPrice)}` },
    { label: "Target", value: `$${money(result.targetPrice)}` },
    { label: "1R / share", value: `$${money(result.oneR)}` },
    { label: "Position value", value: `$${money(result.positionValue)}` },
    {
      label: "Profit at target",
      value: `$${money(result.profitAtTarget)}`,
      tone: "profit",
    },
    {
      label: "Loss at stop",
      value: `$${money(result.lossAtStop)}`,
      tone: "loss",
    },
    { label: "Realised R:R", value: `${result.realRR.toFixed(1)}:1` },
  ];

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-4 xl:grid-cols-2">
      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-0.5">
        <Card title="Trade setup">
          <div className="flex flex-col gap-3">
            <SegmentedControl
              ariaLabel="Trade direction"
              fullWidth
              value={session.direction}
              onChange={(v) => store.setField("direction", v as "long" | "short")}
              options={[
                { value: "long", label: "▲ Long" },
                { value: "short", label: "▼ Short" },
              ]}
            />

            <div className="grid grid-cols-2 gap-2">
              <CalcInputField
                label="Gap top"
                value={session.zoneTop}
                onValue={(n) => store.setField("zoneTop", n)}
                step={0.01}
                min={0}
                prefix="$"
                accent="profit"
              />
              <CalcInputField
                label="Gap bottom"
                value={session.zoneBottom}
                onValue={(n) => store.setField("zoneBottom", n)}
                step={0.01}
                min={0}
                prefix="$"
                accent="loss"
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Entry at
              </span>
              <SegmentedControl
                ariaLabel="Entry location"
                fullWidth
                value={session.entryAt}
                onChange={(v) =>
                  store.setField("entryAt", v as "top" | "mid" | "bottom" | "manual")
                }
                options={[
                  { value: "top", label: "Top" },
                  { value: "mid", label: "Mid" },
                  { value: "bottom", label: "Bottom" },
                  { value: "manual", label: "Manual" },
                ]}
              />
              {isManual ? (
                <CalcInputField
                  label="Entry price"
                  value={session.entryPrice}
                  onValue={(n) => store.setField("entryPrice", n)}
                  step={0.01}
                  min={0}
                  prefix="$"
                  accent="accent"
                />
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <CalcInputField
                label="Stop buffer"
                value={session.stopBuffer}
                onValue={(n) => store.setField("stopBuffer", n)}
                step={0.01}
                min={0}
                prefix="$"
                hint="beyond the gap"
                accent="loss"
              />
              <CalcInputField
                label="Target"
                value={session.rMultiple}
                onValue={(n) => store.setField("rMultiple", n)}
                step={0.5}
                min={0}
                suffix="R"
                hint="reward multiple"
                accent="profit"
              />
              <CalcInputField
                label="Account"
                value={session.account}
                onValue={(n) => store.setField("account", n)}
                step={100}
                min={0}
                prefix="$"
                accent="accent"
              />
              <CalcInputField
                label="Risk"
                value={session.riskPct}
                onValue={(n) => store.setField("riskPct", n)}
                step={0.25}
                min={0}
                suffix="%"
                hint="per trade"
                accent="accent"
              />
            </div>
          </div>
        </Card>

        <WarningBanner warns={store.warns} />
      </div>

      <div className="flex min-h-0 flex-col gap-3 xl:min-h-0">
        <TradeTicket
          heroLabel="Suggested size"
          heroValue={fmtShares(result.shares)}
          heroUnit="sh"
          rows={ticketRows}
        />
        {result.valid ? (
          <Card title="Risk / reward axis" fill flush className="min-h-[280px]">
            <FvgAxis long={long} rMultiple={session.rMultiple} />
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function FvgAxis({ long, rMultiple }: { long: boolean; rMultiple: number }) {
  const entryTop = (rMultiple / (rMultiple + 1)) * 100;

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
      <div className="relative flex min-h-[240px] flex-1 items-stretch justify-center gap-2 py-2">
        {/* Left scale */}
        <div className="relative w-10 shrink-0">
          <AxisLabel top="0%" text={`+${rMultiple}R`} tone="profit" align="right" />
          <AxisLabel top={`${entryTop}%`} text="Entry" tone="muted" align="right" emphasize />
          <AxisLabel top="100%" text="−1R" tone="loss" align="right" />
        </div>

        {/* Track */}
        <div className="relative w-12 shrink-0">
          <div className="absolute top-0 left-1/2 h-full w-px -translate-x-1/2 bg-border" />
          <div
            className="absolute top-0 left-1/2 w-[14px] origin-center -translate-x-1/2"
            style={{ height: "100%" }}
          >
            <div
              className="absolute inset-x-0 top-0 origin-bottom overflow-hidden rounded-t-full"
              style={{
                height: `${entryTop}%`,
                background: "linear-gradient(to top, rgba(74,222,128,0.3), rgba(74,222,128,0.9))",
              }}
            />
            <div
              className="absolute inset-x-0 origin-top overflow-hidden rounded-b-full"
              style={{
                top: `${entryTop}%`,
                height: `${100 - entryTop}%`,
                background:
                  "linear-gradient(to bottom, rgba(251,113,133,0.9), rgba(251,113,133,0.3))",
              }}
            />
          </div>
          <div
            className={cn(
              "absolute left-1/2 z-10 flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-background text-[9px] font-bold ring-2",
              long ? "text-profit ring-profit" : "text-destructive ring-loss",
            )}
            style={{ top: `${entryTop}%` }}
          >
            {long ? "▲" : "▼"}
          </div>
        </div>

        {/* Right spacer for symmetry */}
        <div className="w-10 shrink-0" />
      </div>
    </div>
  );
}

function AxisLabel({
  top,
  text,
  tone,
  align,
  emphasize,
}: {
  top: string;
  text: string;
  tone: "profit" | "loss" | "muted";
  align: "left" | "right";
  emphasize?: boolean;
}) {
  return (
    <span
      className={cn(
        "absolute -translate-y-1/2 whitespace-nowrap text-[10px] tabular-nums",
        align === "right" ? "right-0 text-right" : "left-0 text-left",
        tone === "profit" && "text-profit",
        tone === "loss" && "text-destructive",
        tone === "muted" && "text-muted-foreground",
        emphasize && "font-semibold",
      )}
      style={{ top }}
    >
      {text}
    </span>
  );
}
