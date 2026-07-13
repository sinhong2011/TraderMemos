import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { ImportStepIndicator } from "./ImportStepIndicator";

describe("ImportStepIndicator", () => {
  it("marks the active step", () => {
    const { container } = render(<ImportStepIndicator current={1} />);
    expect(container.querySelector("[aria-current='step']")).toHaveTextContent("1");
  });

  it("shows checkmarks for completed steps", () => {
    const { container } = render(<ImportStepIndicator current={3} />);
    expect(container.querySelectorAll("svg")).toHaveLength(2);
    expect(container.querySelector("[aria-current='step']")).toHaveTextContent("3");
  });

  it("uses Review label for journal format on step 2", () => {
    render(<ImportStepIndicator current={2} format="journal_trades" />);
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.queryByText("Map columns")).not.toBeInTheDocument();
  });
});
