import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { DonutRing } from "./DonutRing";

describe("DonutRing", () => {
  it("sizes each segment proportionally to its value", () => {
    render(
      <DonutRing
        segments={[
          { value: 12, color: "var(--color-profit)" },
          { value: 8, color: "var(--color-loss)" },
        ]}
      />,
    );
    const segs = screen.getAllByTestId("donut-seg");
    expect(segs).toHaveLength(2);
    expect(segs[0].getAttribute("stroke-dasharray")).toBe("60 40");
    expect(segs[1].getAttribute("stroke-dasharray")).toBe("40 60");
  });

  it("renders no segments when the total is zero", () => {
    render(<DonutRing segments={[{ value: 0, color: "var(--color-profit)" }]} />);
    expect(screen.queryAllByTestId("donut-seg")).toHaveLength(0);
  });

  it("renders centered children in the hole", () => {
    render(
      <DonutRing segments={[{ value: 1, color: "var(--color-profit)" }]}>
        <span>60%</span>
      </DonutRing>,
    );
    expect(screen.getByText("60%")).toBeInTheDocument();
  });
});
