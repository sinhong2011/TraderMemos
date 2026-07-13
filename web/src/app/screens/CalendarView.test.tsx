import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import type { Summary } from "../../lib/api/types";
import { CalendarView } from "./CalendarView";

const MONTH_SUMMARY = {
  total_trades: 4,
  wins: 2,
  losses: 2,
  win_rate: 0.5,
  profit_factor: 0.53,
  net_pnl: -61.79,
} as Summary;

const BASE = {
  dailyPnl: { "2026-07-01": -20.03, "2026-07-02": -41.76 },
  dailyLoading: false,
  dailyError: false,
  records: {
    "2026-07-01": { wins: 0, losses: 1 },
    "2026-07-02": { wins: 2, losses: 1 },
  },
  monthSummary: MONTH_SUMMARY,
  accounts: [],
  selectedAccountId: undefined,
  year: 2026,
  month: 7,
  onPrevMonth: vi.fn(),
  onNextMonth: vi.fn(),
  onToday: vi.fn(),
  onJumpToMonth: vi.fn(),
  canGoNext: true,
  selectedDay: null,
  onSelectDay: vi.fn(),
  dayTrades: [],
  dayTradesLoading: false,
  dayTradesError: false,
  currency: "USD",
  onSelectTrade: vi.fn(),
};

describe("CalendarView", () => {
  it("renders the month stats header", () => {
    render(<CalendarView {...BASE} />);
    expect(screen.getByRole("button", { name: /July 2026, choose month/i })).toBeInTheDocument();
    expect(screen.getByText("Trades")).toBeInTheDocument();
    expect(screen.getByText("Win rate")).toBeInTheDocument();
    expect(screen.getByText("Record")).toBeInTheDocument();
    expect(screen.getByText("2W")).toBeInTheDocument();
    expect(screen.getByText("2L")).toBeInTheDocument();
    expect(screen.getByText("Month P&L:")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Today" })).toBeInTheDocument();
  });

  it("renders day cells with pnl and records, plus WEEK column", () => {
    render(<CalendarView {...BASE} />);
    expect(screen.getByText("-$20.03")).toBeInTheDocument();
    expect(screen.getByText("-$41.76")).toBeInTheDocument();
    expect(screen.getByText("2W1L")).toBeInTheDocument();
    expect(screen.getByText("WEEK")).toBeInTheDocument();
    // Week 1 total = -61.79 with 2W2L record. Note: monthSummary.net_pnl is
    // also -61.79 in this fixture, so the same text renders twice (header
    // stat + WEEK cell) - assert presence via getAllByText.
    expect(screen.getAllByText("-$61.79").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("2W2L")).toBeInTheDocument();
  });
});
