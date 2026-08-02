import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import { DailyLossCard } from "./DailyLossCard";

const rulesMock = vi.hoisted(() => ({ current: { max_daily_loss: 500 as number | null } }));

vi.mock("../lib/hooks/useRiskRules", () => ({
  useRiskRules: () => ({ data: rulesMock.current, isLoading: false, isError: false }),
}));

describe("DailyLossCard", () => {
  it("renders nothing without a configured limit", () => {
    rulesMock.current = { max_daily_loss: null };
    const { container } = render(<DailyLossCard todayNetPnl={-100} currency="USD" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows remaining loss budget while under the limit", () => {
    rulesMock.current = { max_daily_loss: 500 };
    render(<DailyLossCard todayNetPnl={-200} currency="USD" />);
    expect(screen.getByText("Daily loss limit")).toBeInTheDocument();
    expect(screen.getByText(/\$300\.00 of loss budget left today/)).toBeInTheDocument();
  });

  it("flags a breached limit", () => {
    rulesMock.current = { max_daily_loss: 500 };
    render(<DailyLossCard todayNetPnl={-650} currency="USD" />);
    expect(screen.getByText(/Daily loss limit hit/)).toBeInTheDocument();
  });

  it("reports an untouched budget on green days", () => {
    rulesMock.current = { max_daily_loss: 500 };
    render(<DailyLossCard todayNetPnl={340} currency="USD" />);
    expect(screen.getByText(/Loss budget untouched today/)).toBeInTheDocument();
  });
});
