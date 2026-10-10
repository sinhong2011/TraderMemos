import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import type { Setup, SetupScore, SetupScorecard } from "@/lib/api/types";
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
  scorecardLoading: false,
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
const score: SetupScore = {
  setup_id: "s1",
  name: "ORB",
  trades: 5,
  wins: 3,
  losses: 2,
  win_rate: 0.6,
  net_pnl: 500,
  expectancy: 100,
  profit_factor: 3.5,
  r_trades: 5,
  r_coverage: 1,
  expectancy_r: 0.8,
  avg_win_r: 1.8,
  avg_loss_r: -0.7,
  distribution: [],
  basis: "r",
  mean: 0.8,
  ci_low: -0.3,
  ci_high: 1.9,
  clean_trades: 5,
  clean_mean: 0.8,
  verdict: "unproven",
  stale: false,
  last_trade_at: "2026-09-30T14:00:00Z",
};

const card = (...setups: SetupScore[]): SetupScorecard => ({ setups, none: null });

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
    wrap(<PlaybookView {...base} setups={[setup]} scorecard={card(score)} />);
    // Name shows on the row and again as the summary's top play.
    expect(screen.getAllByText("ORB").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\$500\.00/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /log trade from orb/i })).toBeInTheDocument();
  });

  it("summarises the traded plays", () => {
    wrap(<PlaybookView {...base} setups={[setup]} scorecard={card(score)} />);
    expect(screen.getByText("Plays traded")).toBeInTheDocument();
    expect(screen.getByText("1/1")).toBeInTheDocument();
    expect(screen.getByText("Top play")).toBeInTheDocument();
    expect(screen.getByText("3 of 5 won")).toBeInTheDocument();
  });

  it("shows an empty state with no setups", () => {
    wrap(<PlaybookView {...base} setups={[]} scorecard={card()} />);
    expect(screen.getByText("No setups yet")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /new setup/i }).length).toBeGreaterThanOrEqual(1);
  });

  it("opens the new-setup modal from the header action", async () => {
    useUI.setState({ modal: null, setupDraft: null });
    wrap(<PlaybookView {...base} setups={[setup]} scorecard={card(score)} />);
    await userEvent.click(screen.getByRole("button", { name: /new setup/i }));
    expect(useUI.getState().modal).toBe("new-setup");
    expect(useUI.getState().setupDraft).toBeNull();
  });

  it("opens edit draft when editing a setup", async () => {
    useUI.setState({ modal: null, setupDraft: null });
    wrap(<PlaybookView {...base} setups={[setup]} scorecard={card(score)} />);
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
    wrap(<PlaybookView {...base} setups={[setup, unused]} scorecard={card(score)} />);
    expect(screen.getByText("Scalp")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /hide unused/i }));
    expect(screen.queryByText("Scalp")).not.toBeInTheDocument();
    expect(screen.getAllByText("ORB").length).toBeGreaterThan(0);
  });

  it("labels metric columns once, as sort controls", () => {
    wrap(<PlaybookView {...base} setups={[setup]} scorecard={card(score)} />);
    expect(screen.getByRole("listitem")).toBeInTheDocument();
    for (const label of ["Edge", "Trades", "Win rate", "Expectancy", "Net P&L"]) {
      expect(screen.getByRole("button", { name: `Sort by ${label}` })).toBeInTheDocument();
    }
  });

  it("sorts traded plays by a metric column and flips direction on re-click", async () => {
    const second: Setup = { ...setup, id: "s2", name: "Fade", symbol: "MSFT" };
    const secondScore: SetupScore = { ...score, setup_id: "s2", name: "Fade", net_pnl: 900 };
    wrap(<PlaybookView {...base} setups={[setup, second]} scorecard={card(score, secondScore)} />);

    const rowNames = () =>
      screen.getAllByRole("listitem").map((li) => li.textContent?.startsWith("Fade") ?? false);

    // Verdict sort (default) keeps the scorecard's order, so ORB leads.
    expect(rowNames()[0]).toBe(false);

    // Net P&L descending puts the bigger winner (Fade, +$900) first.
    await userEvent.click(screen.getByRole("button", { name: /sort by net p&l/i }));
    expect(rowNames()[0]).toBe(true);

    // Re-click flips to ascending, so ORB (+$500) leads.
    await userEvent.click(screen.getByRole("button", { name: /sort by net p&l/i }));
    expect(rowNames()[0]).toBe(false);
  });

  it("groups untraded plays into their own section", () => {
    const unused: Setup = { ...setup, id: "s2", name: "Scalp", symbol: "" };
    wrap(<PlaybookView {...base} setups={[setup, unused]} scorecard={card(score)} />);
    expect(screen.getByText("Traded in this range")).toBeInTheDocument();
    expect(screen.getByText("Not traded in this range")).toBeInTheDocument();
  });

  it("shows each play's verdict and expectancy in R", () => {
    wrap(<PlaybookView {...base} setups={[setup]} scorecard={card(score)} />);
    expect(screen.getByText("Too early · 5/10")).toBeInTheDocument();
    expect(screen.getAllByText("+0.80R").length).toBeGreaterThan(0);
  });

  it("counts proven edges and bleeding plays in the summary", () => {
    const second: Setup = { ...setup, id: "s2", name: "Fade" };
    wrap(
      <PlaybookView
        {...base}
        setups={[setup, second]}
        scorecard={card(
          { ...score, verdict: "edge" },
          { ...score, setup_id: "s2", name: "Fade", verdict: "bleeding" },
        )}
      />,
    );
    expect(screen.getByText("Proven edge")).toBeInTheDocument();
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
    expect(screen.getByText("1 bleeding")).toBeInTheDocument();
  });

  it("calls out a play that pays when the mistakes are left out", () => {
    wrap(
      <PlaybookView
        {...base}
        setups={[setup]}
        scorecard={card({
          ...score,
          mean: -0.2,
          verdict: "execution",
          clean_trades: 3,
          clean_mean: 0.9,
        })}
      />,
    );
    expect(screen.getByText("Execution leak")).toBeInTheDocument();
    expect(screen.getByText(/Without mistakes: \+0\.90R/)).toBeInTheDocument();
  });

  it("summarises trades logged without a setup", () => {
    wrap(
      <PlaybookView
        {...base}
        setups={[setup]}
        scorecard={{
          setups: [score],
          none: {
            ...score,
            setup_id: "",
            name: "",
            trades: 4,
            basis: "currency",
            expectancy: -25,
            net_pnl: -100,
          },
        }}
      />,
    );
    expect(screen.getByText("No setup")).toBeInTheDocument();
    expect(screen.getByText("4 trades")).toBeInTheDocument();
  });
});
