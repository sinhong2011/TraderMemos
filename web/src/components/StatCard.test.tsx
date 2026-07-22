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

  it('defaults to a bordered panel background for variant "panel"', () => {
    render(<StatCard label="Avg Win" value="$45.95" />);
    const cell = screen.getByText("Avg Win").parentElement as HTMLElement;
    expect(cell.style.border).toBe("1px solid var(--color-border)");
  });

  it('uses an elevated, borderless background for variant="bento"', () => {
    render(<StatCard label="P&L" value="+$61.19" variant="bento" />);
    const cell = screen.getByText("P&L").parentElement as HTMLElement;
    expect(cell.style.background).toBe("var(--color-surface-bento)");
    expect(cell.style.border).toBe("");
  });

  it('reduces cell padding for size="sm"', () => {
    render(<StatCard label="Breakeven" value="0" size="sm" />);
    const cell = screen.getByText("Breakeven").parentElement as HTMLElement;
    expect(cell).toHaveClass("py-2");
  });

  it('keeps the panel border-radius for variant="bento"', () => {
    render(<StatCard label="P&L" value="+$61.19" variant="bento" />);
    const cell = screen.getByText("P&L").parentElement as HTMLElement;
    expect(cell.style.borderRadius).toBe("var(--radius-panel)");
  });

  it('centers content for align="center" without forcing a square', () => {
    render(<StatCard label="Expectancy" value="+$2.35" align="center" variant="bento" />);
    const cell = screen.getByText("Expectancy").parentElement as HTMLElement;
    expect(cell).toHaveClass("items-center", "text-center");
    expect(cell).not.toHaveClass("aspect-square");
  });
});
