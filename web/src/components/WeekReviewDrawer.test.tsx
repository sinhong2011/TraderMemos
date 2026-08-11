import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { WeekDetail } from "@/lib/calendar";
import { WeekReviewDrawer } from "./WeekReviewDrawer";

vi.mock("../lib/displayPrefs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/displayPrefs")>();
  return {
    ...actual,
    usePrivacyMode: () => false,
  };
});

function mockChartLayout() {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      if (this.id === "recharts_measurement_span") {
        const width = (this.textContent ?? "").length * 6;
        return {
          width,
          height: 12,
          top: 0,
          left: 0,
          bottom: 12,
          right: width,
          x: 0,
          y: 0,
          toJSON: () => {},
        } as DOMRect;
      }
      return {
        width: 600,
        height: 200,
        top: 0,
        left: 0,
        bottom: 200,
        right: 600,
        x: 0,
        y: 0,
        toJSON: () => {},
      } as DOMRect;
    },
  );
}

const WEEK = [
  null,
  null,
  null,
  { date: "2026-07-01", pnl: -20.03 },
  { date: "2026-07-02", pnl: -41.76 },
  { date: "2026-07-03", pnl: null },
  { date: "2026-07-04", pnl: null },
] as const;

const DETAIL: WeekDetail = {
  pnl: -61.79,
  pct: -0.006,
  startBalance: 10000,
  endBalance: 9938.21,
  deposits: 0,
  fees: 0,
  trades: 3,
  winRate: 0.333,
  profitFactor: 0.53,
  expectancy: -20.6,
  tradingDays: 2,
  bestDay: { date: "2026-07-01", pnl: -20.03 },
  worstDay: { date: "2026-07-02", pnl: -41.76 },
};

const BASE = {
  weekReviewIndex: 0,
  onClose: vi.fn<() => void>(),
  week: [...WEEK],
  weekSummary: {
    pnl: -61.79,
    wins: 1,
    losses: 2,
    hasData: true,
    daysWithTrades: 2,
    firstDate: "2026-07-01",
    lastDate: "2026-07-04",
    weekNumber: 1,
  },
  detail: DETAIL,
  records: {
    "2026-07-01": { wins: 0, losses: 1 },
    "2026-07-02": { wins: 1, losses: 1 },
  },
  currency: "USD",
  fxRate: 1,
  onSelectDay: vi.fn<(day: string) => void>(),
};

describe("WeekReviewDrawer", () => {
  beforeEach(() => {
    mockChartLayout();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the chart region for a week with trades", () => {
    render(<WeekReviewDrawer {...BASE} />);
    expect(screen.getByTestId("week-review-chart-region")).toBeInTheDocument();
    expect(screen.getByTestId("week-review-cumulative-chart")).toBeInTheDocument();
    expect(screen.getByTestId("week-review-daily-bars")).toBeInTheDocument();
    expect(screen.getByTestId("week-review-stat-grid")).toBeInTheDocument();
    expect(screen.getByText("Trading days")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("clicking a daily bar hands off to the day drawer", async () => {
    const onSelectDay = vi.fn<(day: string) => void>();
    render(<WeekReviewDrawer {...BASE} onSelectDay={onSelectDay} />);

    await userEvent.click(await screen.findByTestId("week-bar-2026-07-02"));

    expect(onSelectDay).toHaveBeenCalledWith("2026-07-02");
  });

  it("renders an empty state instead of charts when the week has no trades", () => {
    render(
      <WeekReviewDrawer
        {...BASE}
        weekReviewIndex={0}
        week={[
          null,
          null,
          null,
          { date: "2026-07-01", pnl: null },
          { date: "2026-07-02", pnl: null },
          { date: "2026-07-03", pnl: null },
          { date: "2026-07-04", pnl: null },
        ]}
        weekSummary={{
          ...BASE.weekSummary,
          pnl: 0,
          hasData: false,
          daysWithTrades: 0,
        }}
        detail={undefined}
      />,
    );

    expect(screen.getByTestId("week-review-empty")).toHaveTextContent("No trades");
    expect(screen.queryByTestId("week-review-chart-region")).not.toBeInTheDocument();
  });
});
