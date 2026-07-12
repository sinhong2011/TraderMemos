import { useRCalculatorStore } from "../../../lib/r-calculator/useRCalculatorStore";
import { CalcInputField } from "./CalcInputField";
import { ExitLadder } from "./ExitLadder";
import { RAxis } from "./RAxis";
import { SegmentedControl } from "./SegmentedControl";
import { WarningBanner } from "./WarningBanner";

export function CalculatorPanel() {
	const store = useRCalculatorStore();
	const session = store.sessions.find((s) => s.id === store.activeId);
	if (!session) return null;

	const isOpt = session.instrument === "options";

	return (
		<div className="grid h-full min-h-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_28rem]">
			<div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-0.5">
				<div className="grid grid-cols-2 gap-2">
					<SegmentedControl
						ariaLabel="Instrument type"
						subtle
						value={session.instrument}
						onChange={(v) => store.setField("instrument", v)}
						segments={[
							{ value: "stock", label: "Stock", sub: "SHARES" },
							{ value: "options", label: "Options", sub: "CONTRACTS" },
						]}
					/>
					{isOpt ? (
						<SegmentedControl
							ariaLabel="Option type"
							value={session.optionType}
							onChange={(v) => store.setField("optionType", v)}
							segments={[
								{
									value: "call",
									label: "Call",
									sub: "Bullish",
									glyph: "▲",
									accent: "profit",
								},
								{
									value: "put",
									label: "Put",
									sub: "Bearish",
									glyph: "▼",
									accent: "loss",
								},
							]}
						/>
					) : (
						<SegmentedControl
							ariaLabel="Trade direction"
							value={session.direction}
							onChange={(v) => store.setField("direction", v)}
							segments={[
								{
									value: "long",
									label: "Long",
									sub: "LONG",
									glyph: "▲",
									accent: "profit",
								},
								{
									value: "short",
									label: "Short",
									sub: "SHORT",
									glyph: "▼",
									accent: "loss",
								},
							]}
						/>
					)}
				</div>

				<div className="grid grid-cols-2 gap-2">
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
						accent="signal"
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

				<ExitLadder />
				<WarningBanner warns={[...store.warns, ...store.exitWarns]} />
			</div>

			<div className="flex min-h-[360px] flex-col xl:min-h-0 xl:flex-1">
				<div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-card bg-bg-panel">
					<RAxis />
				</div>
			</div>
		</div>
	);
}
