import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CalendarView } from "./CalendarView";

const baseProps = {
  dailyLoading: false,
  dailyError: false,
  year: 2026,
  month: 6,
  onPrevMonth: vi.fn(),
  onNextMonth: vi.fn(),
  selectedDay: null,
  onSelectDay: vi.fn(),
  dayTrades: [],
  dayTradesLoading: false,
  dayTradesError: false,
  filters: {},
  currency: "USD",
};

describe("CalendarView", () => {
  it("renders the day cell with its P&L", () => {
    render(<CalendarView {...baseProps} dailyPnl={{ "2026-06-15": -50 }} />);
    expect(screen.getByText("June 2026")).toBeInTheDocument();
    // the 15th cell shows its loss value
    expect(screen.getAllByText("-$50.00").length).toBeGreaterThan(0);
  });

  it("shows an empty state when the month has no P&L", () => {
    render(<CalendarView {...baseProps} dailyPnl={{}} />);
    expect(screen.getByText("No trades this month")).toBeInTheDocument();
  });
});
