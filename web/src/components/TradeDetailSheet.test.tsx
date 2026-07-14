import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { TradeDetail } from "../lib/api/types";
import { TradeDetailSheet } from "./TradeDetailSheet";

const navigate = vi.fn<() => void>();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}));

vi.mock("../lib/hooks/useTradeDetail", () => ({
  useTradeDetail: vi.fn<() => unknown>(),
}));

vi.mock("./charts/TradeChartSection", () => ({
  TradeChartSection: () => <div data-testid="trade-chart-stub" />,
}));

import { useTradeDetail } from "../lib/hooks/useTradeDetail";

const mockedDetail = vi.mocked(useTradeDetail);

const TRADE: TradeDetail = {
  id: "t1",
  account_id: "a1",
  symbol: "CL8698",
  instrument_type: "stock",
  direction: "long",
  status: "closed",
  opened_at: "2026-07-14T01:35:00Z",
  closed_at: "2026-07-14T01:35:00Z",
  qty_opened: 5,
  qty_remaining: 0,
  avg_entry_price: 10.5,
  avg_exit_price: 11,
  gross_pnl: 2.5,
  fees_total: 0,
  net_pnl: 2.5,
  pnl_currency: "USD",
  return_pct: 4.76,
  time_in_trade_secs: 0,
  notes: "",
  tags: [],
  fills: [
    {
      id: "f1",
      user_id: "u1",
      account_id: "a1",
      external_id: null,
      symbol: "CL8698",
      instrument_type: "stock",
      side: "buy",
      quantity: 5,
      price: 10.5,
      fees: 0,
      commission: 0,
      executed_at: "2026-07-14T01:35:00Z",
      multiplier: 1,
      details: null,
      import_batch_id: null,
      dedup_hash: "a",
      created_at: "2026-07-14T01:35:00Z",
    },
    {
      id: "f2",
      user_id: "u1",
      account_id: "a1",
      external_id: null,
      symbol: "CL8698",
      instrument_type: "stock",
      side: "sell",
      quantity: 5,
      price: 11,
      fees: 0,
      commission: 0,
      executed_at: "2026-07-14T01:35:00Z",
      multiplier: 1,
      details: null,
      import_batch_id: null,
      dedup_hash: "b",
      created_at: "2026-07-14T01:35:00Z",
    },
  ],
  setup: null,
  initial_risk: null,
  target_price: null,
  stop_price: null,
  r_multiple: null,
  emotional_state: "",
  confidence: null,
  trade_quality: null,
  mae: null,
  mfe: null,
  dividend_total: 0,
  total_pnl: 2.5,
  attachments: [],
};

function wrap(ui: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("TradeDetailSheet", () => {
  beforeEach(() => {
    navigate.mockReset();
    mockedDetail.mockReturnValue({
      data: TRADE,
      isLoading: false,
      isError: false,
    } as never);
  });

  it("shows WIN status, dates, and collapses empty plan dashes", () => {
    wrap(<TradeDetailSheet tradeId="t1" onClose={vi.fn<() => void>()} />);

    expect(screen.getByText("WIN")).toBeInTheDocument();
    // Identity moved into the drawer title: "CL8698 · STK · LONG"
    expect(screen.getByText(/· STK · LONG/)).toBeInTheDocument();
    expect(screen.getByText("+$2.50")).toBeInTheDocument();
    // Status line shows opened → closed dates (Jul 13 or 14 depending on TZ)
    expect(screen.getByText(/Jul 1[34].*→.*Jul 1[34]/)).toBeInTheDocument();
    expect(screen.getByText("Entry")).toBeInTheDocument();
    expect(screen.getByText("Exit")).toBeInTheDocument();
    expect(screen.queryByText("Target")).not.toBeInTheDocument();
    expect(screen.getByText(/Executions \(2\)/i)).toBeInTheDocument();
  });

  it("shows OPEN status with 'still open' and dash exit for open trades", () => {
    mockedDetail.mockReturnValue({
      data: {
        ...TRADE,
        status: "open",
        closed_at: null,
        avg_exit_price: null,
        net_pnl: null,
        gross_pnl: null,
        return_pct: null,
        qty_remaining: 5,
        time_in_trade_secs: null,
      },
      isLoading: false,
      isError: false,
    } as never);
    wrap(<TradeDetailSheet tradeId="t1" onClose={vi.fn<() => void>()} />);

    expect(screen.getByText("OPEN")).toBeInTheDocument();
    expect(screen.getByText(/still open/)).toBeInTheDocument();
    expect(screen.queryByText("+$2.50")).not.toBeInTheDocument();
  });

  it("renders bento hero with fees cell, gross breakdown, and R-multiple", () => {
    mockedDetail.mockReturnValue({
      data: { ...TRADE, fees_total: 0.35, gross_pnl: 2.85, r_multiple: 0.5 },
      isLoading: false,
      isError: false,
    } as never);
    wrap(<TradeDetailSheet tradeId="t1" onClose={vi.fn<() => void>()} />);

    expect(screen.getByText("Fees")).toBeInTheDocument();
    expect(screen.getByText("$0.35")).toBeInTheDocument();
    expect(screen.getByText(/\+\$2\.85 gross/)).toBeInTheDocument();
    expect(screen.getAllByText("+0.50R").length).toBeGreaterThanOrEqual(1);
  });
});
