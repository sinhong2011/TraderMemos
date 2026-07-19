import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { StatCard } from "./StatCard";

describe("StatCard", () => {
  it("renders label and value", () => {
    render(<StatCard label="Net P&L" value="+$4,182.00" />);
    expect(screen.getByText("Net P&L")).toBeInTheDocument();
    expect(screen.getByText("+$4,182.00")).toBeInTheDocument();
  });

  it("defaults to the existing medium type scale", () => {
    render(<StatCard label="Avg Win" value="$45.95" />);
    expect(screen.getByText("$45.95")).toHaveClass("text-xl");
  });

  it('applies a larger type scale for size="lg"', () => {
    render(<StatCard label="P&L" value="+$61.19" size="lg" />);
    expect(screen.getByText("+$61.19")).toHaveClass("text-[26px]");
  });

  it('applies a smaller type scale for size="sm"', () => {
    render(<StatCard label="Breakeven" value="0" size="sm" />);
    expect(screen.getByText("0")).toHaveClass("text-[15px]");
  });
});
