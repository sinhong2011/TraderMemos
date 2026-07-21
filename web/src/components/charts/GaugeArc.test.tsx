import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { GaugeArc } from "./GaugeArc";

describe("GaugeArc", () => {
  it("fills half the arc for value 0.5", () => {
    render(<GaugeArc value={0.5} />);
    const fill = screen.getByTestId("gauge-fill");
    expect(fill.getAttribute("stroke-dashoffset")).toBe("50");
  });

  it("shows an empty arc for value 0 and a full arc for value 1", () => {
    const { rerender } = render(<GaugeArc value={0} />);
    expect(screen.getByTestId("gauge-fill").getAttribute("stroke-dashoffset")).toBe("100");
    rerender(<GaugeArc value={1} />);
    expect(screen.getByTestId("gauge-fill").getAttribute("stroke-dashoffset")).toBe("0");
  });

  it("clamps out-of-range values", () => {
    const { rerender } = render(<GaugeArc value={-2} />);
    expect(screen.getByTestId("gauge-fill").getAttribute("stroke-dashoffset")).toBe("100");
    rerender(<GaugeArc value={5} />);
    expect(screen.getByTestId("gauge-fill").getAttribute("stroke-dashoffset")).toBe("0");
  });

  it("renders centered children", () => {
    render(<GaugeArc value={0.5}>1.71</GaugeArc>);
    expect(screen.getByText("1.71")).toBeInTheDocument();
  });
});
