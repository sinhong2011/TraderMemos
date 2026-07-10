import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BreakGroup, Setup } from "../../lib/api/types";
import { PlaybookView } from "./PlaybookView";

const noop = async () => {};
const base = {
	setupsLoading: false,
	setupsError: false,
	breakdownLoading: false,
	currency: "USD",
	onCreate: vi.fn(noop),
	onUpdate: vi.fn(noop),
	onDelete: vi.fn(noop),
};

const setup: Setup = {
	id: "s1",
	user_id: "u1",
	name: "ORB",
	description: "Opening range breakout",
	created_at: "2026-01-01T00:00:00Z",
	thesis: "Opening range breakout",
	symbol: "AAPL",
	direction: "long",
	target_price: 110,
	stop_price: 95,
	checklist: ["Above VWAP"],
};
const group: BreakGroup = {
	key: "ORB",
	summary: {
		total_trades: 5,
		wins: 3,
		losses: 2,
		breakeven: 0,
		win_rate: 0.6,
		net_pnl: 500,
		gross_profit: 700,
		gross_loss: 200,
		profit_factor: 3.5,
		expectancy: 100,
		avg_win: 233.33,
		avg_loss: 100,
		avg_trade: 100,
		largest_win: 300,
		largest_loss: 120,
		total_fees: 10,
	},
} as BreakGroup;

describe("PlaybookView", () => {
	it("renders a setup with its breakdown stats", () => {
		render(<PlaybookView {...base} setups={[setup]} breakdown={[group]} />);
		expect(screen.getByText("ORB")).toBeInTheDocument();
		expect(screen.getAllByText(/\$500\.00/).length).toBeGreaterThan(0);
	});

	it("shows an empty state with no setups", () => {
		render(<PlaybookView {...base} setups={[]} breakdown={[]} />);
		expect(screen.getByText("No setups yet")).toBeInTheDocument();
	});
});
