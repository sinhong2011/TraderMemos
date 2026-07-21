import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import type { BreakGroup } from "../lib/api/types";
import { ReportsExecutionGrade } from "./ReportsExecutionGrade";

function grp(key: string, net: number, pf = 1): BreakGroup {
  return {
    key,
    summary: {
      total_trades: 1,
      wins: net >= 0 ? 1 : 0,
      losses: net < 0 ? 1 : 0,
      breakeven: 0,
      win_rate: net >= 0 ? 1 : 0,
      net_pnl: net,
      gross_profit: net > 0 ? net : 0,
      gross_loss: net < 0 ? -net : 0,
      profit_factor: pf,
      expectancy: net,
      avg_win: 0,
      avg_loss: 0,
      avg_trade: net,
      largest_win: 0,
      largest_loss: 0,
      total_fees: 0,
    },
  };
}

const props = { loading: false, error: false, currency: "USD" };

describe("ReportsExecutionGrade", () => {
  it("orders rows A+ first and Unrated last regardless of input P&L order", () => {
    render(
      <ReportsExecutionGrade
        {...props}
        breakdown={[grp("unrated", 500), grp("1", -100), grp("5", 50)]}
      />,
    );
    const labels = screen.getAllByTestId("exec-grade-label").map((el) => el.textContent);
    expect(labels).toEqual(["A+", "C", "Unrated"]);
  });

  it("maps numeric keys to letter grades", () => {
    render(<ReportsExecutionGrade {...props} breakdown={[grp("3", 10)]} />);
    expect(screen.getByTestId("exec-grade-label").textContent).toBe("A-");
  });

  it("colors net P&L by sign", () => {
    render(<ReportsExecutionGrade {...props} breakdown={[grp("5", 200), grp("1", -100)]} />);
    expect(screen.getByText("+$200.00")).toHaveClass("text-profit");
    expect(screen.getByText("-$100.00")).toHaveClass("text-loss");
  });

  it("sizes each bar proportionally to |net P&L|", () => {
    render(<ReportsExecutionGrade {...props} breakdown={[grp("5", 200), grp("1", -100)]} />);
    const bars = screen.getAllByTestId("exec-grade-bar");
    expect(bars[0].style.width).toBe("100%"); // 200 is the max
    expect(bars[1].style.width).toBe("50%"); // 100 / 200
  });

  it("renders an empty state when there is no data", () => {
    render(<ReportsExecutionGrade {...props} breakdown={[]} />);
    expect(screen.getByText(/no/i)).toBeInTheDocument();
  });
});
