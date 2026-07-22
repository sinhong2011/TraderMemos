import { money, shares as fmtShares } from "../../../lib/r-calculator/format";
import { limiterLabel } from "../../../lib/r-calculator/messages";
import { useRCalculatorStore } from "../../../lib/r-calculator/useRCalculatorStore";
import { Card } from "../../Card";
import { SegmentedControl } from "../../SegmentedControl";
import { CalcInputField } from "./CalcInputField";
import { ExitLadder } from "./ExitLadder";
import { RAxis } from "./RAxis";
import { TradeTicket, type TradeTicketRow } from "./TradeTicket";
import { WarningBanner } from "./WarningBanner";

export function CalculatorPanel() {
  const store = useRCalculatorStore();
  const session = store.sessions.find((s) => s.id === store.activeId);
  if (!session) return null;

  const { input, result } = store;
  const isOpt = session.instrument === "options";
  const unit = isOpt ? "ct" : "sh";
  const long = input.direction === "long";

  const ticketRows: TradeTicketRow[] = [
    {
      label: isOpt ? "Type" : "Direction",
      value: isOpt ? (session.optionType === "call" ? "Call" : "Put") : long ? "Long" : "Short",
    },
    { label: "Entry", value: `$${money(input.entry)}` },
    { label: "Stop", value: `$${money(result.stopPrice)}` },
    {
      label: isOpt ? "Premium cost" : "Position value",
      value: `$${money(result.posValue)}`,
    },
    { label: "Risk budget", value: `$${money(result.riskAmt)}` },
    { label: "Cash left", value: `$${money(result.remainingCash)}` },
  ];

  if (isOpt) {
    ticketRows.push({
      label: "Max loss",
      value: `$${money(result.maxLoss)}`,
      tone: "loss",
    });
  }

  if (result.limiter !== "none") {
    ticketRows.push({
      label: "Limiter",
      value: limiterLabel(result.limiter),
    });
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-4 xl:grid-cols-2">
      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-0.5">
        <Card title="Trade setup">
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <SegmentedControl
                ariaLabel="Instrument type"
                fullWidth
                value={session.instrument}
                onChange={(v) => store.setField("instrument", v as "stock" | "options")}
                options={[
                  { value: "stock", label: "Stock shares" },
                  { value: "options", label: "Options contracts" },
                ]}
              />
              {isOpt ? (
                <SegmentedControl
                  ariaLabel="Option type"
                  fullWidth
                  value={session.optionType}
                  onChange={(v) => store.setField("optionType", v as "call" | "put")}
                  options={[
                    { value: "call", label: "▲ Call" },
                    { value: "put", label: "▼ Put" },
                  ]}
                />
              ) : (
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
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
              {isOpt ? (
                <>
                  <CalcInputField
                    label="Entry premium"
                    value={session.entryPrem}
                    onValue={(n) => store.setField("entryPrem", n)}
                    step={0.05}
                    min={0}
                    prefix="$"
                    accent="profit"
                  />
                  <CalcInputField
                    label="Stop premium"
                    value={session.stopPrem}
                    onValue={(n) => store.setField("stopPrem", n)}
                    step={0.05}
                    min={0}
                    prefix="$"
                    accent="loss"
                  />
                </>
              ) : (
                <>
                  <CalcInputField
                    label="Entry"
                    value={session.entry}
                    onValue={(n) => store.setField("entry", n)}
                    step={0.01}
                    min={0}
                    prefix="$"
                    accent="profit"
                  />
                  <CalcInputField
                    label="Stop"
                    value={session.stop}
                    onValue={(n) => store.setField("stop", n)}
                    step={0.01}
                    min={0}
                    prefix="$"
                    accent="loss"
                  />
                </>
              )}
              <CalcInputField
                label="Capital"
                value={session.capital}
                onValue={(n) => store.setField("capital", n)}
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
              {isOpt ? (
                <div className="col-span-2">
                  <CalcInputField
                    label="Shares / contract"
                    value={session.contractSize}
                    onValue={(n) => store.setField("contractSize", n)}
                    step={1}
                    min={1}
                    suffix="sh"
                    hint="Multiplier"
                    accent="accent"
                  />
                </div>
              ) : null}
            </div>
          </div>
        </Card>

        <ExitLadder />
        <WarningBanner warns={[...store.warns, ...store.exitWarns]} />
      </div>

      <div className="flex min-h-0 flex-col gap-3 xl:min-h-0">
        <TradeTicket
          heroLabel="Suggested size"
          heroValue={fmtShares(result.shares)}
          heroUnit={unit}
          rows={ticketRows}
        />
        <Card title="Risk / reward axis" fill flush className="min-h-[280px]">
          <RAxis />
        </Card>
      </div>
    </div>
  );
}
