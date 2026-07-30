import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import { ReportsControlBar } from "./ReportsControlBar";

const base = {
  side: "all" as const,
  duration: "all" as const,
  onSideChange: vi.fn<(...args: any[]) => any>(),
  onDurationChange: vi.fn<(...args: any[]) => any>(),
  pnlMode: "net" as const,
  unitMode: "abs" as const,
  onPnlModeChange: vi.fn<(...args: any[]) => any>(),
  onUnitModeChange: vi.fn<(...args: any[]) => any>(),
  pctEnabled: true,
};

describe("ReportsControlBar", () => {
  it("renders the side and duration options", () => {
    render(<ReportsControlBar {...base} />);
    expect(screen.getByRole("button", { name: "Long" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Short" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Scalp" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Swing" })).toBeInTheDocument();
  });

  it("calls onSideChange when a side is picked", () => {
    const onSideChange = vi.fn<(...args: any[]) => any>();
    render(<ReportsControlBar {...base} onSideChange={onSideChange} />);
    screen.getByRole("button", { name: "Long" }).click();
    expect(onSideChange).toHaveBeenCalledWith("long");
  });

  it("calls onDurationChange when a duration is picked", () => {
    const onDurationChange = vi.fn<(...args: any[]) => any>();
    render(<ReportsControlBar {...base} onDurationChange={onDurationChange} />);
    screen.getByRole("button", { name: "Swing" }).click();
    expect(onDurationChange).toHaveBeenCalledWith("swing");
  });

  it("renders the Net/Gross and $/% toggles", () => {
    render(<ReportsControlBar {...base} />);
    expect(screen.getByRole("button", { name: "Net" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gross" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "$" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "%" })).toBeInTheDocument();
  });

  it("calls onPnlModeChange and onUnitModeChange", () => {
    const onPnlModeChange = vi.fn<(...args: any[]) => any>();
    const onUnitModeChange = vi.fn<(...args: any[]) => any>();
    render(
      <ReportsControlBar
        {...base}
        onPnlModeChange={onPnlModeChange}
        onUnitModeChange={onUnitModeChange}
      />,
    );
    screen.getByRole("button", { name: "Gross" }).click();
    expect(onPnlModeChange).toHaveBeenCalledWith("gross");
    screen.getByRole("button", { name: "%" }).click();
    expect(onUnitModeChange).toHaveBeenCalledWith("pct");
  });
});
