import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import type { BreakGroup, Setup } from "../../lib/api/types";
import { useUI } from "../../lib/ui";
import { TooltipProvider } from "../../components/ui/tooltip";
import { PlaybookView } from "./PlaybookView";

vi.mock("../../lib/hooks/useMoneyFx", () => ({
  useMoneyFx: (currency: string) => ({ currency, rate: 1 }),
}));

const noop = async () => {};
const base = {
  setupsLoading: false,
  setupsError: false,
  breakdownLoading: false,
  currency: "USD",
  onDelete: vi.fn<(...args: any[]) => any>(noop),
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

function wrap(ui: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>{ui}</TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("PlaybookView", () => {
  it("renders a setup with its breakdown stats", () => {
    wrap(<PlaybookView {...base} setups={[setup]} breakdown={[group]} />);
    expect(screen.getByText("ORB")).toBeInTheDocument();
    expect(screen.getAllByText(/\$500\.00/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /log trade from orb/i })).toBeInTheDocument();
  });

  it("shows an empty state with no setups", () => {
    wrap(<PlaybookView {...base} setups={[]} breakdown={[]} />);
    expect(screen.getByText("No setups yet")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /new setup/i }).length).toBeGreaterThanOrEqual(1);
  });

  it("opens the new-setup modal from the header action", async () => {
    useUI.setState({ modal: null, setupDraft: null });
    wrap(<PlaybookView {...base} setups={[setup]} breakdown={[group]} />);
    await userEvent.click(screen.getByRole("button", { name: /new setup/i }));
    expect(useUI.getState().modal).toBe("new-setup");
    expect(useUI.getState().setupDraft).toBeNull();
  });

  it("opens edit draft when editing a setup", async () => {
    useUI.setState({ modal: null, setupDraft: null });
    wrap(<PlaybookView {...base} setups={[setup]} breakdown={[group]} />);
    await userEvent.click(screen.getByRole("button", { name: /edit orb/i }));
    expect(useUI.getState().modal).toBe("new-setup");
    expect(useUI.getState().setupDraft).toMatchObject({
      id: "s1",
      name: "ORB",
      symbol: "AAPL",
      direction: "long",
    });
  });

  it("can hide unused setups", async () => {
    const unused: Setup = {
      ...setup,
      id: "s2",
      name: "Scalp",
      symbol: "",
      checklist: [],
    };
    wrap(<PlaybookView {...base} setups={[setup, unused]} breakdown={[group]} />);
    expect(screen.getByText("Scalp")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /hide unused/i }));
    expect(screen.queryByText("Scalp")).not.toBeInTheDocument();
    expect(screen.getByText("ORB")).toBeInTheDocument();
  });

  it("renders setup metrics in an item footer", () => {
    wrap(<PlaybookView {...base} setups={[setup]} breakdown={[group]} />);
    expect(screen.getByRole("listitem")).toBeInTheDocument();
    expect(screen.getByText("Expectancy")).toBeInTheDocument();
    expect(screen.getByText("Profit factor")).toBeInTheDocument();
  });
});
