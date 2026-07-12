import { money, shares as fmtShares } from "../../../lib/r-calculator/format";
import { useFvgStore } from "../../../lib/r-calculator/useFvgStore";
import { CalcInputField } from "./CalcInputField";
import { SegmentedControl } from "./SegmentedControl";
import { WarningBanner } from "./WarningBanner";
import { cn } from "../../../lib/cn";

export function FvgPanel() {
	const store = useFvgStore();
	const session = store.sessions.find((s) => s.id === store.activeId);
	if (!session) return null;

	const { result } = store;
	const isManual = session.entryAt === "manual";
	const long = session.direction === "long";

	return (
		<div className="grid h-full min-h-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
			<div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-0.5">
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
					<span className="text-[10px] font-medium uppercase tracking-widest text-text-dim">
						Entry at
					</span>
					<SegmentedControl
						ariaLabel="Entry location"
						subtle
						value={session.entryAt}
						onChange={(v) => store.setField("entryAt", v)}
						segments={[
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
						hint="R multiple"
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
						accent="signal"
					/>
				</div>

				<WarningBanner warns={store.warns} />
			</div>

			<div className="flex min-h-[360px] flex-col gap-3 overflow-y-auto xl:min-h-0">
				<FvgTradeCard result={result} long={long} />
				{result.valid ? <FvgAxis long={long} rMultiple={session.rMultiple} /> : null}
			</div>
		</div>
	);
}

function FvgTradeCard({
	result,
	long,
}: {
	result: ReturnType<typeof useFvgStore.getState>["result"];
	long: boolean;
}) {
	const rows = [
		{ label: "Direction", value: long ? "Long" : "Short" },
		{ label: "Entry", value: `$${money(result.entryPrice)}` },
		{ label: "Stop", value: `$${money(result.stopPrice)}` },
		{ label: "Target", value: `$${money(result.targetPrice)}` },
		{ label: "1R / share", value: `$${money(result.oneR)}` },
		{ label: "Shares", value: fmtShares(result.shares) },
		{ label: "Position value", value: `$${money(result.positionValue)}` },
		{
			label: "Profit at target",
			value: `$${money(result.profitAtTarget)}`,
			tone: "profit" as const,
		},
		{
			label: "Loss at stop",
			value: `$${money(result.lossAtStop)}`,
			tone: "loss" as const,
		},
		{ label: "Realised R:R", value: `${result.realRR.toFixed(1)}:1` },
	];

	return (
		<div className="rounded-card bg-bg-panel p-4">
			<h3 className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
				Trade ticket
			</h3>
			<dl className="grid gap-2">
				{rows.map((row) => (
					<div key={row.label} className="flex items-baseline justify-between gap-2">
						<dt className="text-[10px] uppercase tracking-widest text-text-dim">
							{row.label}
						</dt>
						<dd
							className={cn(
								"m-0 text-xs font-semibold tabular-nums",
								row.tone === "profit" && "text-profit",
								row.tone === "loss" && "text-loss",
								!row.tone && "text-text",
							)}
						>
							{row.value}
						</dd>
					</div>
				))}
			</dl>
		</div>
	);
}

function FvgAxis({
	long,
	rMultiple,
}: {
	long: boolean;
	rMultiple: number;
}) {
	const entryTop = (rMultiple / (rMultiple + 1)) * 100;

	return (
		<div className="rounded-card bg-bg-panel p-4">
			<h3 className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
				Risk / reward axis
			</h3>
			<div
				className="relative mx-auto w-12"
				style={{ height: `${(rMultiple + 1) * 60}px` }}
			>
				<div className="absolute top-0 left-1/2 h-full w-px -translate-x-1/2 bg-border" />
				<div
					className="absolute top-0 left-1/2 w-[14px] origin-center -translate-x-1/2"
					style={{ height: "100%" }}
				>
					<div
						className="absolute inset-x-0 top-0 origin-bottom overflow-hidden rounded-t-full"
						style={{
							height: `${entryTop}%`,
							background:
								"linear-gradient(to top, rgba(74,222,128,0.3), rgba(74,222,128,0.9))",
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
						"absolute left-1/2 z-10 flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-bg text-[9px] font-bold ring-2",
						long ? "text-profit ring-profit" : "text-loss ring-loss",
					)}
					style={{ top: `${entryTop}%` }}
				>
					{long ? "▲" : "▼"}
				</div>
			</div>
			<div className="mt-3 flex justify-between text-[10px] tabular-nums">
				<span className="text-profit">+{rMultiple}R</span>
				<span className="text-text-dim">Entry</span>
				<span className="text-loss">−1R</span>
			</div>
		</div>
	);
}
