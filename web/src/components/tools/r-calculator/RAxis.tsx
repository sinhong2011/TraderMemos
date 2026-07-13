import { useState } from "react";
import { money, rLabel, shares as fmtShares, signedMoney } from "../../../lib/r-calculator/format";
import { useRCalculatorStore } from "../../../lib/r-calculator/useRCalculatorStore";
import { cn } from "../../../lib/cn";

export function RAxis() {
	const store = useRCalculatorStore();
	const session = store.sessions.find((s) => s.id === store.activeId);
	const [active, setActive] = useState<string | null>(null);

	if (!session) return null;

	const { input, result, exitResult } = store;
	const long = input.direction === "long";
	const isOpt = session.instrument === "options";
	const unit = isOpt ? "ct" : "sh";
	const maxR = exitResult.maxAxisR;

	const top = (r: number) => ((maxR - r) / (maxR + 1)) * 100;
	const entryTop = top(0);
	const util =
		result.riskAmt > 0
			? Math.min(1, Math.max(0, result.realRisk / result.riskAmt))
			: 0;
	const railScale = 0.4 + 0.6 * util;

	const exitPrice = (r: number) =>
		long ? input.entry + r * result.r1 : input.entry - r * result.r1;

	const badge = isOpt
		? session.optionType === "call"
			? "CALL"
			: "PUT"
		: session.direction === "long"
			? "LONG"
			: "SHORT";
	const bullish = isOpt
		? session.optionType === "call"
		: session.direction === "long";

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="flex shrink-0 items-center justify-between px-4 pt-3 pb-1">
				<span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
					Risk / reward axis
				</span>
				<span
					className={cn(
						"rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
						bullish ? "bg-profit/15 text-profit" : "bg-loss/15 text-loss",
					)}
				>
					{badge}
				</span>
			</div>

			<div
				className="relative grid min-h-[280px] flex-1 w-full grid-cols-[auto_1fr_auto] items-stretch px-4 py-2"
			>
				{/* Left scale */}
				<div className="relative w-10 shrink-0">
					<ScaleTick top="0%" text={rLabel(maxR)} tone="profit" />
					{exitResult.tiers.map((tier) => (
						<ScaleTick
							key={tier.r}
							top={`${top(tier.r)}%`}
							text={`${rLabel(tier.r)} · ${tier.pct}%`}
							tone="profit"
						/>
					))}
					<ScaleTick top={`${entryTop}%`} text="0" tone="muted" emphasize />
					<ScaleTick top="100%" text="−1R" tone="loss" />
				</div>

				{/* Center rail */}
				<div className="relative mx-2 w-12 shrink-0">
					<div className="absolute top-0 left-1/2 h-full w-px -translate-x-1/2 bg-border" />

					<div
						className="absolute top-0 left-1/2 h-full w-[18px] origin-center transition-transform duration-300"
						style={{
							marginLeft: "-9px",
							transform: `scaleX(${railScale})`,
						}}
					>
						<div
							className="absolute inset-x-0 top-0 origin-bottom overflow-hidden rounded-t-full"
							style={{
								height: `${entryTop}%`,
								background:
									"linear-gradient(to top, rgba(74,222,128,0.3), rgba(74,222,128,0.9))",
								boxShadow: "0 0 12px -2px rgba(74,222,128,0.4)",
							}}
						/>
						<div
							className="absolute inset-x-0 origin-top overflow-hidden rounded-b-full"
							style={{
								top: `${entryTop}%`,
								height: `${100 - entryTop}%`,
								background:
									"linear-gradient(to bottom, rgba(251,113,133,0.9), rgba(251,113,133,0.3))",
								boxShadow: "0 0 12px -2px rgba(251,113,133,0.4)",
							}}
						/>
					</div>

					{exitResult.tiers.map((tier, i) => (
						<button
							key={tier.r}
							type="button"
							className={cn(
								"absolute left-1/2 z-20 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-bg ring-2 ring-profit transition-transform",
								active === `tier-${i}` && "scale-150",
							)}
							style={{ top: `${top(tier.r)}%` }}
							onMouseEnter={() => setActive(`tier-${i}`)}
							onMouseLeave={() => setActive(null)}
						/>
					))}

					<button
						type="button"
						className={cn(
							"absolute left-1/2 z-10 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-bg text-[10px] font-bold ring-2 transition-transform",
							bullish ? "text-profit ring-profit" : "text-loss ring-loss",
							active === "entry" && "scale-110",
						)}
						style={{ top: `${entryTop}%` }}
						onMouseEnter={() => setActive("entry")}
						onMouseLeave={() => setActive(null)}
					>
						{long ? "▲" : "▼"}
					</button>
				</div>

				{/* Right prices */}
				<div className="relative w-28 shrink-0 sm:w-36">
					<PriceLabel
						top="0%"
						tone="profit"
						caption={`Hold ${rLabel(exitResult.trailerTargetR)}`}
						price={money(
							exitResult.tiers.length
								? exitPrice(exitResult.trailerTargetR)
								: result.target3,
						)}
						pl={signedMoney(exitResult.totalAtTarget)}
					/>
					{exitResult.tiers.map((tier, i) => (
						<PriceLabel
							key={tier.r}
							top={`${top(tier.r)}%`}
							tone="profit"
							caption={`Target ${rLabel(tier.r)} · ${tier.pct}%`}
							price={money(tier.price)}
							pl={signedMoney(tier.profit)}
							active={active === `tier-${i}`}
						/>
					))}
					<PriceLabel
						top={`${entryTop}%`}
						tone="text"
						caption="Entry"
						price={money(input.entry)}
						emphasize
						active={active === "entry"}
					/>
					<PriceLabel
						top="100%"
						tone="loss"
						caption="Stop −1R"
						price={money(result.stopPrice)}
						pl={result.realRisk > 0 ? signedMoney(-result.realRisk) : "—"}
						active={active === "stop"}
					/>
				</div>
			</div>

			<AxisStrip
				shares={result.shares}
				posValue={result.posValue}
				riskAmt={result.riskAmt}
				remainingCash={result.remainingCash}
				maxLoss={result.maxLoss}
				limiter={result.limiter}
				isOpt={isOpt}
				unit={unit}
			/>
		</div>
	);
}

function ScaleTick({
	top,
	text,
	tone,
	emphasize,
}: {
	top: string;
	text: string;
	tone: "profit" | "loss" | "muted";
	emphasize?: boolean;
}) {
	return (
		<span
			className={cn(
				"absolute right-0 -translate-y-1/2 whitespace-nowrap text-right text-[9px] tabular-nums",
				tone === "profit" && "text-profit",
				tone === "loss" && "text-loss",
				tone === "muted" && "text-text-dim",
				emphasize && "font-semibold",
			)}
			style={{ top }}
		>
			{text}
		</span>
	);
}

function PriceLabel({
	top,
	tone,
	caption,
	price,
	pl,
	emphasize,
	active,
}: {
	top: string;
	tone: "profit" | "loss" | "text";
	caption: string;
	price: string;
	pl?: string;
	emphasize?: boolean;
	active?: boolean;
}) {
	return (
		<div
			className={cn(
				"absolute left-0 -translate-y-1/2 transition-opacity",
				active === false && "opacity-60",
			)}
			style={{ top }}
		>
			<p className="m-0 text-[9px] uppercase tracking-widest text-text-dim">
				{caption}
			</p>
			<p
				className={cn(
					"m-0 tabular-nums",
					emphasize ? "text-sm font-bold" : "text-xs font-semibold",
					tone === "profit" && "text-profit",
					tone === "loss" && "text-loss",
					tone === "text" && "text-text",
				)}
			>
				{price}
			</p>
			{pl ? (
				<p
					className={cn(
						"m-0 text-[10px] tabular-nums",
						tone === "profit" ? "text-profit/80" : "text-loss/80",
					)}
				>
					{pl}
				</p>
			) : null}
		</div>
	);
}

function AxisStrip({
	shares,
	posValue,
	riskAmt,
	remainingCash,
	maxLoss,
	limiter,
	isOpt,
	unit,
}: {
	shares: number;
	posValue: number;
	riskAmt: number;
	remainingCash: number;
	maxLoss: number;
	limiter: string;
	isOpt: boolean;
	unit: string;
}) {
	return (
		<div className="mt-auto flex shrink-0 flex-wrap gap-1.5 px-4 py-3">
			<Metric label="Suggested size">
				{fmtShares(shares)} {unit}
			</Metric>
			<Metric label={isOpt ? "Premium cost" : "Position value"}>
				${money(posValue)}
			</Metric>
			<Metric label="Risk budget">${money(riskAmt)}</Metric>
			<Metric label="Cash left">${money(remainingCash)}</Metric>
			{isOpt ? (
				<Metric label="Max loss" tone="loss">
					${money(maxLoss)}
				</Metric>
			) : null}
			<Metric
				label="Limiter"
				tone={limiter !== "none" ? "signal" : undefined}
			>
				{limiter === "risk"
					? "Risk-limited"
					: limiter === "cash"
						? "Cash-limited"
						: "—"}
			</Metric>
		</div>
	);
}

function Metric({
	label,
	children,
	tone,
}: {
	label: string;
	children: React.ReactNode;
	tone?: "loss" | "signal";
}) {
	return (
		<span className="inline-flex items-baseline gap-1 rounded-control bg-bg-hover px-2 py-1 text-[10px]">
			<span className="text-text-dim">{label}</span>
			<span
				className={cn(
					"font-semibold tabular-nums",
					tone === "loss" && "text-loss",
					tone === "signal" && "text-signal",
					!tone && "text-text",
				)}
			>
				{children}
			</span>
		</span>
	);
}
