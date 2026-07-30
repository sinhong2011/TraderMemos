import { money, shares as fmtShares, signedMoney } from "@/lib/r-calculator/format";
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
              />
              <CalcInputField
                label="Gap bottom"
                value={session.zoneBottom}
                onValue={(n) => store.setField("zoneBottom", n)}
                step={0.01}
                min={0}
                prefix="$"
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-medium text-muted-foreground">Entry at</span>
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
              />
              <CalcInputField
                label="Target"
                value={session.rMultiple}
                onValue={(n) => store.setField("rMultiple", n)}
                step={0.5}
                min={0}
                suffix="R"
                hint="reward multiple"
              />
              <CalcInputField
                label="Account"
                value={session.account}
                onValue={(n) => store.setField("account", n)}
                step={100}
                min={0}
                prefix="$"
              />
              <CalcInputField
                label="Risk"
                value={session.riskPct}
                onValue={(n) => store.setField("riskPct", n)}
                step={0.25}
                min={0}
                suffix="%"
                hint="per trade"
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
        {/* Keep the card mounted when the inputs are invalid so the column doesn't collapse. */}
        <Card title="Risk / reward axis" fill flush className="min-h-[280px]">
          {result.valid ? (
            <FvgAxis
              long={long}
              rMultiple={session.rMultiple}
              entryPrice={result.entryPrice}
              stopPrice={result.stopPrice}
              targetPrice={result.targetPrice}
              profitAtTarget={result.profitAtTarget}
              lossAtStop={result.lossAtStop}
            />
          ) : (
            <div className="flex min-h-[240px] flex-1 items-center justify-center px-4 pb-4 text-center text-[13px] text-muted-foreground">
              Set a valid gap and stop to plot the axis.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function FvgAxis({
  long,
  rMultiple,
  entryPrice,
  stopPrice,
  targetPrice,
  profitAtTarget,
  lossAtStop,
}: {
  long: boolean;
  rMultiple: number;
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  profitAtTarget: number;
  lossAtStop: number;
}) {
  const entryTop = (rMultiple / (rMultiple + 1)) * 100;

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
      <div className="relative flex min-h-[240px] flex-1 items-stretch justify-center gap-2 py-2">
        {/* Left scale */}
        <div className="relative w-10 shrink-0">
          <AxisLabel top="0%" text={`+${rMultiple}R`} tone="profit" align="right" />
          <AxisLabel top={`${entryTop}%`} text="0" tone="muted" align="right" emphasize />
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
              className="absolute inset-x-0 top-0 origin-bottom overflow-hidden rounded-t-full bg-linear-to-t from-profit/30 to-profit/90"
              style={{ height: `${entryTop}%` }}
            />
            <div
              className="absolute inset-x-0 origin-top overflow-hidden rounded-b-full bg-linear-to-b from-destructive/90 to-destructive/30"
              style={{
                top: `${entryTop}%`,
                height: `${100 - entryTop}%`,
              }}
            />
          </div>
          <div
            aria-hidden
            className={cn(
              "absolute left-1/2 z-10 flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-background text-[9px] font-bold ring-2",
              long ? "text-profit ring-profit" : "text-destructive ring-destructive",
            )}
            style={{ top: `${entryTop}%` }}
          >
            {long ? "▲" : "▼"}
          </div>
        </div>

        {/* Right prices */}
        <div className="relative w-28 shrink-0 sm:w-32">
          <FvgPriceLabel
            top="0%"
            tone="profit"
            caption={`Target +${rMultiple}R`}
            price={money(targetPrice)}
            pl={signedMoney(profitAtTarget)}
          />
          <FvgPriceLabel
            top={`${entryTop}%`}
            tone="text"
            caption="Entry"
            price={money(entryPrice)}
            emphasize
          />
          <FvgPriceLabel
            top="100%"
            tone="loss"
            caption="Stop −1R"
            price={money(stopPrice)}
            pl={signedMoney(-lossAtStop)}
          />
        </div>
      </div>
    </div>
  );
}

function FvgPriceLabel({
  top,
  tone,
  caption,
  price,
  pl,
  emphasize,
}: {
  top: string;
  tone: "profit" | "loss" | "text";
  caption: string;
  price: string;
  pl?: string;
  emphasize?: boolean;
}) {
  return (
    <div className="absolute left-0 -translate-y-1/2" style={{ top }}>
      <p className="m-0 text-[11px] text-muted-foreground">{caption}</p>
      <p
        className={cn(
          "m-0 tabular-nums",
          emphasize ? "text-sm font-semibold" : "text-[13px] font-medium",
          tone === "profit" && "text-profit",
          tone === "loss" && "text-destructive",
          tone === "text" && "text-foreground",
        )}
      >
        {price}
      </p>
      {pl ? (
        <p
          className={cn(
            "m-0 text-[11px] tabular-nums",
            tone === "profit" ? "text-profit/80" : "text-destructive/80",
          )}
        >
          {pl}
        </p>
      ) : null}
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
