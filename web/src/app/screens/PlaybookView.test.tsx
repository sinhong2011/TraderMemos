import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import type { BreakGroup, Setup } from "@/lib/api/types";
import { useUI } from "@/lib/ui";
import { TooltipProvider } from "@/components/ui/tooltip";
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
    // Name shows on the row and again as the summary's top play.
    expect(screen.getAllByText("ORB").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\$500\.00/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /log trade from orb/i })).toBeInTheDocument();
  });

  it("summarises the traded plays", () => {
    wrap(<PlaybookView {...base} setups={[setup]} breakdown={[group]} />);
    expect(screen.getByText("Plays traded")).toBeInTheDocument();
    expect(screen.getByText("1/1")).toBeInTheDocument();
    expect(screen.getByText("Top play")).toBeInTheDocument();
    expect(screen.getByText("3 of 5 won")).toBeInTheDocument();
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
    expect(screen.getAllByText("ORB").length).toBeGreaterThan(0);
  });

  it("labels metric columns once, as sort controls", () => {
    wrap(<PlaybookView {...base} setups={[setup]} breakdown={[group]} />);
    expect(screen.getByRole("listitem")).toBeInTheDocument();
    for (const label of ["Trades", "Win rate", "Profit factor", "Expectancy", "Net P&L"]) {
      expect(screen.getByRole("button", { name: `Sort by ${label}` })).toBeInTheDocument();
    }
  });

  it("sorts traded plays by a metric column and flips direction on re-click", async () => {
    const second: Setup = { ...setup, id: "s2", name: "Fade", symbol: "MSFT" };
    const secondGroup = {
      ...group,
      key: "Fade",
      summary: { ...group.summary, net_pnl: 900 },
    } as BreakGroup;
    wrap(<PlaybookView {...base} setups={[setup, second]} breakdown={[group, secondGroup]} />);

    const rowNames = () =>
      screen.getAllByRole("listitem").map((li) => li.textContent?.startsWith("Fade") ?? false);

    // Name sort (default) puts Fade first.
    expect(rowNames()[0]).toBe(true);

    // Net P&L descending puts the bigger winner (Fade, +$900) first.
    await userEvent.click(screen.getByRole("button", { name: /sort by net p&l/i }));
    expect(rowNames()[0]).toBe(true);

    // Re-click flips to ascending, so ORB (+$500) leads.
    await userEvent.click(screen.getByRole("button", { name: /sort by net p&l/i }));
    expect(rowNames()[0]).toBe(false);
  });

  it("groups untraded plays into their own section", () => {
    const unused: Setup = { ...setup, id: "s2", name: "Scalp", symbol: "" };
    wrap(<PlaybookView {...base} setups={[setup, unused]} breakdown={[group]} />);
    expect(screen.getByText("Traded in this range")).toBeInTheDocument();
    expect(screen.getByText("Not traded in this range")).toBeInTheDocument();
  });
});
