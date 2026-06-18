import { render, screen } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import type { Account, EquityPoint, Summary, Trade } from "../../lib/api/types";
import { DashboardView } from "./DashboardView";

// DataTable uses @tanstack/react-virtual which needs real DOM layout to
// produce virtual rows. Stub it out so cells render unconditionally.
vi.mock("../../components/DataTable", () => ({
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	DataTable: ({
		data,
		columns,
	}: {
		data: Record<string, unknown>[];
		columns: {
			accessorKey?: string;
			cell: (ctx: { getValue: () => unknown }) => React.ReactNode;
		}[];
	}) => (
		<table>
			<tbody>
				{data.map((row, ri) => (
					<tr key={ri}>
						{columns.map((col, ci) => (
							<td key={ci}>
								{col.cell({
									getValue: () =>
										col.accessorKey ? row[col.accessorKey] : undefined,
								})}
							</td>
						))}
					</tr>
				))}
			</tbody>
		</table>
	),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockSummary: Summary = {
	total_trades: 42,
	wins: 25,
	losses: 17,
	breakeven: 0,
	win_rate: 0.58,
	net_pnl: 4182,
	gross_profit: 8000,
	gross_loss: 3818,
	profit_factor: 1.94,
	expectancy: 48,
	avg_win: 200,
	avg_loss: 100,
	avg_trade: 99.57,
	largest_win: 800,
	largest_loss: 400,
	total_fees: 120,
};

const mockEquityPoints: EquityPoint[] = [
	{ at: "2026-06-01T00:00:00Z", equity: 15000 },
];

const mockDailyPnl: Record<string, number> = {
	"2026-06-15": -50,
};

const mockTrades: Trade[] = [
	{
		id: "t1",
		account_id: "a1",
		symbol: "AAPL",
		instrument_type: "stock",
		direction: "long",
		status: "closed",
		opened_at: "2026-06-13T09:30:00Z",
		closed_at: "2026-06-14T11:00:00Z",
		qty_opened: 10,
		avg_entry_price: 195,
		avg_exit_price: 215,
		gross_pnl: 200,
		fees_total: 2,
		net_pnl: 198,
		pnl_currency: "USD",
		return_pct: 0.1026,
		time_in_trade_secs: 91800,
		notes: "",
		tags: [],
	},
];

const mockAccounts: Account[] = [
	{
		id: "a1",
		user_id: "u1",
		name: "Main",
		broker: "IBKR",
		account_type: "margin",
		base_currency: "USD",
		starting_balance: 10000,
		created_at: "2026-01-01T00:00:00Z",
	},
];

// ---------------------------------------------------------------------------
// Default props helper
// ---------------------------------------------------------------------------

const defaultProps = {
	summaryLoading: false,
	summaryError: false,
	summary: mockSummary,
	equityLoading: false,
	equityError: false,
	equityPoints: mockEquityPoints,
	dailyLoading: false,
	dailyError: false,
	dailyPnl: mockDailyPnl,
	tradesLoading: false,
	tradesError: false,
	trades: mockTrades,
	accounts: mockAccounts,
	selectedAccountId: "a1",
	year: 2026,
	month: 6,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DashboardView", () => {
	it("renders win rate KPI correctly", () => {
		render(<DashboardView {...defaultProps} />);
		// fmtPct(0.58, "en-US") => "58%"
		expect(screen.getByText("58%")).toBeInTheDocument();
	});

	it("renders the recent trade symbol AAPL", () => {
		render(<DashboardView {...defaultProps} />);
		expect(screen.getByText("AAPL")).toBeInTheDocument();
	});

	it("renders Net P&L KPI with correct sign and value", () => {
		render(<DashboardView {...defaultProps} />);
		// fmtSignedMoney(4182, "USD", "en-US") => "+$4,182.00"
		expect(screen.getByText("+$4,182.00")).toBeInTheDocument();
	});

	it("renders Profit Factor KPI", () => {
		render(<DashboardView {...defaultProps} />);
		expect(screen.getByText("1.94")).toBeInTheDocument();
	});

	it("shows skeleton when summary is loading", () => {
		const { container } = render(
			<DashboardView {...defaultProps} summaryLoading summary={undefined} />,
		);
		// Skeleton elements are aria-hidden divs with the shimmer class
		const skeletons = container.querySelectorAll('[aria-hidden="true"]');
		expect(skeletons.length).toBeGreaterThan(0);
	});

	it("shows empty state when there are no trades and no summary data", () => {
		render(
			<DashboardView
				{...defaultProps}
				summary={{ ...mockSummary, total_trades: 0 }}
				trades={[]}
			/>,
		);
		expect(screen.getByText("No trades yet")).toBeInTheDocument();
		expect(
			screen.getByText("Import a CSV or add a trade to get started."),
		).toBeInTheDocument();
	});

	it("shows error message when summary query fails", () => {
		render(
			<DashboardView
				{...defaultProps}
				summaryLoading={false}
				summaryError
				summary={undefined}
			/>,
		);
		expect(screen.getByText(/Failed to load summary/i)).toBeInTheDocument();
	});

	it("renders the equity curve panel", () => {
		render(<DashboardView {...defaultProps} />);
		expect(screen.getByText(/Equity Curve/i)).toBeInTheDocument();
	});

	it("renders the recent trades panel header", () => {
		render(<DashboardView {...defaultProps} />);
		expect(screen.getByText(/Recent Trades/i)).toBeInTheDocument();
	});
});
