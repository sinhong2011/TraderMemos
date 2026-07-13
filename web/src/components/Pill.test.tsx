import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { Pill } from "./Pill";

describe("Pill", () => {
  it("renders children", () => {
    render(<Pill tone="pos">WIN</Pill>);
    expect(screen.getByText("WIN")).toBeInTheDocument();
  });
  it("defaults to muted tone without crashing", () => {
    render(<Pill>BE</Pill>);
    expect(screen.getByText("BE")).toBeInTheDocument();
  });
});
