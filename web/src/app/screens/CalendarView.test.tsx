import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import type { Summary, Trade } from "@/lib/api/types";
import { CalendarView } from "./CalendarView";

vi.mock("../../components/Toast", () => ({
  useToastManager: () => ({ add: vi.fn<(...args: any[]) => any>() }),
}));

vi.mock("../../lib/hooks/useMoneyFx", () => ({
  useMoneyFx: (currency: string) => ({ currency, rate: 1 }),
}));

function wrap(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const MONTH_SUMMARY = {
  total_trades: 4,
  wins: 2,
  losses: 2,
  win_rate: 0.5,
  profit_factor: 0.53,
  net_pnl: -61.79,
} as Summary;

const DAY_TRADE: Trade = {
  id: "t1",
  account_id: "a1",
  symbol: "AAPL",
  status: "closed",
  direction: "long",
  instrument_type: "stock",
  opened_at: "2026-07-01T10:00:00Z",
  closed_at: "2026-07-01T11:00:00Z",
  qty_opened: 1,
  qty_remaining: 0,
  avg_entry_price: 10,
  avg_exit_price: 11,
  gross_pnl: 1,
  net_pnl: 1,
  fees_total: 0,
  pnl_currency: "USD",
  return_pct: 10,
  time_in_trade_secs: 3600,
  notes: "",
  tags: [],
};

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
  cashTx: [],
  selectedAccountId: undefined,
  year: 2026,
  month: 7,
  mode: "month" as const,
  onModeChange: vi.fn<(...args: any[]) => any>(),
  onPrevMonth: vi.fn<(...args: any[]) => any>(),
  onNextMonth: vi.fn<(...args: any[]) => any>(),
  onPrevYear: vi.fn<(...args: any[]) => any>(),
  onNextYear: vi.fn<(...args: any[]) => any>(),
  onToday: vi.fn<(...args: any[]) => any>(),
  onJumpToMonth: vi.fn<(...args: any[]) => any>(),
  canGoNextMonth: true,
  canGoNextYear: true,
  selectedDay: null as string | null,
  onSelectDay: vi.fn<(...args: any[]) => any>(),
  dayTrades: [] as Trade[],
  dayTradesLoading: false,
  dayTradesError: false,
  currency: "USD",
  onSelectTrade: vi.fn<(...args: any[]) => any>(),
};

describe("CalendarView", () => {
  it("renders compact P&L and opens month summary details in a modal", async () => {
    wrap(<CalendarView {...BASE} />);
    expect(screen.getByRole("button", { name: /July 2026, choose month/i })).toBeInTheDocument();

    const pnlBtn = screen.getByTitle("Month summary");
    expect(pnlBtn).toBeInTheDocument();

    await userEvent.click(pnlBtn);
    expect(screen.getByText("Days")).toBeInTheDocument();
    // "Trades" labels both the header chip and the modal stat.
    expect(screen.getAllByText("Trades").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Win rate")).toBeInTheDocument();
    expect(screen.getByText("Profit factor")).toBeInTheDocument();
  });

  it("renders the month header chip row with trades, wins, P&L, and return", () => {
    wrap(
      <CalendarView
        {...BASE}
        accounts={[{ id: "a1", base_currency: "USD" } as never]}
        cashTx={[
          {
            id: "c1",
            account_id: "a1",
            type: "deposit",
            amount: 10000,
            currency: "USD",
            occurred_at: "2026-06-01T00:00:00Z",
            note: "",
          } as never,
        ]}
      />,
    );
    expect(screen.getByText("Trades")).toBeInTheDocument();
    expect(screen.getByText("Wins")).toBeInTheDocument();
    expect(screen.getByText("P&L")).toBeInTheDocument();
    // -61.79 on 10,000 deposited → -0.6%.
    expect(screen.getByText("Return")).toBeInTheDocument();
    expect(screen.getAllByText(/-0\.6%/).length).toBeGreaterThanOrEqual(1);
  });

  it("shows a week return chip measured against the week-start balance", () => {
    wrap(<CalendarView {...BASE} equityPoints={[{ at: "2026-06-01T00:00:00Z", equity: 10000 }]} />);
    // Week 1 and the month both lose 61.79 on a 10,000 start balance → -0.6%
    // in the week chip and the header Return chip (one shared basis).
    expect(screen.getAllByText("-0.6%").length).toBeGreaterThanOrEqual(2);
    // Empty weeks say so instead of an em-dash placeholder.
    expect(screen.queryByText("—")).not.toBeInTheDocument();
    expect(screen.getAllByText("No trades").length).toBeGreaterThanOrEqual(1);
  });

  it("renders day cells with pnl and records, plus WEEK column", () => {
    wrap(<CalendarView {...BASE} />);
    // Compact money may render -$20 or -$20.03 depending on magnitude
    expect(screen.getByText(/-\$20/)).toBeInTheDocument();
    expect(screen.getByText(/-\$41/)).toBeInTheDocument();
    expect(screen.getByText("Week")).toBeInTheDocument();
    expect(screen.getByText("Week 1")).toBeInTheDocument();
    expect(screen.getAllByText(/2 days/).length).toBeGreaterThanOrEqual(1);
  });

  it("week cells use sm:h-full to fill the row inside Button trigger", () => {
    wrap(<CalendarView {...BASE} />);
    const weekBtn = screen.getByRole("button", { name: /^Week 1,/ });
    expect(weekBtn.className).toContain("sm:h-full");
    const emptyWeekBtn = screen.getAllByRole("button", { name: /No trades/i })[0]!;
    expect(emptyWeekBtn.className).toContain("sm:h-full");
  });

  it("opens week hover details on focus and week review drawer on click", async () => {
    wrap(<CalendarView {...BASE} equityPoints={[{ at: "2026-06-01T00:00:00Z", equity: 10000 }]} />);

    const weekBtn = screen.getByRole("button", { name: /^Week 1,/ });
    expect(weekBtn).toBeInTheDocument();

    weekBtn.focus();
    expect(await screen.findByText("Balance")).toBeInTheDocument();
    expect(screen.getByText("View week review →")).toBeInTheDocument();

    await userEvent.click(weekBtn);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(/Week review — Week 1 — Jul 1 – 4/)).toBeInTheDocument();
    expect(dialog).toHaveTextContent("2 trading days");
  });

  it("selecting a day in the week review drawer closes it and opens the day trades drawer", async () => {
    const onSelectDay = vi.fn();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { rerender } = render(
      <QueryClientProvider client={qc}>
        <CalendarView {...BASE} onSelectDay={onSelectDay} />
      </QueryClientProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: /^Week 1,/ }));
    expect(screen.getByText(/Week review — Week 1 — Jul 1 – 4/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Thu, Jul 2/i }));
    expect(onSelectDay).toHaveBeenCalledWith("2026-07-02");
    await waitFor(() => {
      expect(screen.queryByText(/Week review — Week 1/)).not.toBeInTheDocument();
    });

    rerender(
      <QueryClientProvider client={qc}>
        <CalendarView
          {...BASE}
          onSelectDay={onSelectDay}
          selectedDay="2026-07-02"
          dayTrades={[DAY_TRADE]}
        />
      </QueryClientProvider>,
    );
    expect(screen.getByText(/Trades —/i)).toBeInTheDocument();
    expect(screen.queryByText(/Week review —/)).not.toBeInTheDocument();
  });

  it("shows No trades on empty week cells without em-dash placeholders", () => {
    wrap(<CalendarView {...BASE} />);
    const emptyWeekBtns = screen.getAllByRole("button", { name: /No trades/i });
    expect(emptyWeekBtns.length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });

  it("renders year overview with twelve month cards and trade counts", () => {
    wrap(
      <CalendarView
        {...BASE}
        mode="year"
        yearDailyPnl={{ "2026-07-01": -20.03, "2026-03-10": 100 }}
        yearTradesByMonth={{ "2026-07": 3, "2026-03": 1 }}
      />,
    );
    expect(screen.getByRole("button", { name: /Jul 2026, 3 trades/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mar 2026, 1 trades?/i })).toBeInTheDocument();
    expect(screen.getByText("3 trades")).toBeInTheDocument();
    expect(screen.getByText("1 trade")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous year" })).toBeInTheDocument();
  });

  it("opens day trades as a card list in a drawer when a day is selected", () => {
    wrap(<CalendarView {...BASE} selectedDay="2026-07-01" dayTrades={[DAY_TRADE]} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(/Trades —/i)).toBeInTheDocument();
    expect(dialog).toHaveTextContent("1 trade");
    expect(dialog).toHaveTextContent("1W");
    expect(dialog).toHaveTextContent("100.0%");
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText("WIN")).toBeInTheDocument();
    expect(screen.getByText("STK")).toBeInTheDocument();
    expect(screen.getAllByText("+$1.00").length).toBeGreaterThanOrEqual(1);
  });
});
