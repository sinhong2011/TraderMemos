import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import { ChartCard } from "./ChartCard";

describe("ChartCard", () => {
  it("renders title, per-card controls and the shared range pills", () => {
    const onRangeChange = vi.fn();
    render(
      <ChartCard
        title="Rolling Win Rate"
        controls={<span>window control</span>}
        range="all"
        onRangeChange={onRangeChange}
      >
        {() => <div>chart body</div>}
      </ChartCard>,
    );

    expect(screen.getByText("Rolling Win Rate")).toBeInTheDocument();
    expect(screen.getByText("window control")).toBeInTheDocument();
    expect(screen.getByText("chart body")).toBeInTheDocument();
    for (const label of ["1M", "3M", "6M", "1Y", "All"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }

    fireEvent.click(screen.getByRole("button", { name: "3M" }));
    expect(onRangeChange).toHaveBeenCalledWith("3m");
  });

  it("omits the range pills for expand-only cards", () => {
    render(<ChartCard title="Win / Loss by Time">{() => <div>bars</div>}</ChartCard>);
    expect(screen.queryByRole("button", { name: "3M" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand chart" })).toBeInTheDocument();
  });

  it("opens the fullscreen dialog with a sized render of the same chart", () => {
    render(
      <ChartCard title="Duration vs P&L">
        {({ expanded, height }) => (
          <div data-testid={expanded ? "chart-expanded" : "chart-inline"}>
            {expanded ? `h=${height}` : "inline"}
          </div>
        )}
      </ChartCard>,
    );

    expect(screen.getByTestId("chart-inline")).toBeInTheDocument();
    expect(screen.queryByTestId("chart-expanded")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expand chart" }));
    expect(screen.getByTestId("chart-expanded")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
