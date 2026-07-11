import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BreakGroup } from "../../lib/api/types";
import { ReportsView } from "./ReportsView";

// Mock DataTable (virtualizer needs a sized container in jsdom) to render keys + P&L.
vi.mock("../../components/DataTable", () => ({
	DataTable: ({ data }: { data: BreakGroup[] }) => (
		<div data-testid="table">
			{data.map((g) => (
				<div key={g.key}>
					{g.key} {g.summary.net_pnl}
				</div>
			))}
		</div>
	),
}));

function grp(key: string, net: number): BreakGroup {
	return {
		key,
		summary: {
			total_trades: 1,
			wins: net >= 0 ? 1 : 0,
			losses: net < 0 ? 1 : 0,
			breakeven: 0,
			win_rate: net >= 0 ? 1 : 0,
			net_pnl: net,
			gross_profit: net > 0 ? net : 0,
			gross_loss: net < 0 ? -net : 0,
			profit_factor: 0,
			expectancy: net,
			avg_win: 0,
			avg_loss: 0,
			avg_trade: net,
			largest_win: 0,
			largest_loss: 0,
			total_fees: 0,
		},
	} as BreakGroup;
}

const base = {
	summaryLoading: false,
	summaryError: false,
	equityLoading: false,
	loading: false,
	error: false,
	currency: "USD",
	unit: "usd" as const,
	onUnitChange: vi.fn(),
	onDimChange: vi.fn(),
};

describe("ReportsView", () => {
	it("renders breakdown groups in the table", () => {
		render(
			<ReportsView
				{...base}
				dim="symbol"
				breakdown={[grp("AAPL", 200), grp("MSFT", -100)]}
			/>,
		);
		expect(screen.getByText(/AAPL/)).toBeInTheDocument();
		expect(screen.getByText(/MSFT/)).toBeInTheDocument();
	});

	it("shows an empty state when there is no data", () => {
		render(<ReportsView {...base} dim="symbol" breakdown={[]} />);
		expect(screen.getByText(/No .*data|No data/i)).toBeInTheDocument();
	});

	it("renders the summary metrics grid", () => {
		render(
			<ReportsView
				{...base}
				dim="symbol"
				breakdown={[grp("AAPL", 200)]}
				summary={grp("all", 60).summary}
			/>,
		);
		expect(screen.getByText("Profit Factor")).toBeInTheDocument();
		expect(screen.getByText("Expectancy")).toBeInTheDocument();
	});
});
