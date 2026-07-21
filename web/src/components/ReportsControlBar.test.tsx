import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import { ReportsControlBar } from "./ReportsControlBar";

const base = {
  side: "all" as const,
  duration: "all" as const,
  onSideChange: vi.fn(),
  onDurationChange: vi.fn(),
};

describe("ReportsControlBar", () => {
  it("renders the side and duration options", () => {
    render(<ReportsControlBar {...base} />);
    expect(screen.getByRole("tab", { name: "Long" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Short" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Scalp" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Swing" })).toBeInTheDocument();
  });

  it("calls onSideChange when a side is picked", () => {
    const onSideChange = vi.fn();
    render(<ReportsControlBar {...base} onSideChange={onSideChange} />);
    screen.getByRole("tab", { name: "Long" }).click();
    expect(onSideChange).toHaveBeenCalledWith("long");
  });

  it("calls onDurationChange when a duration is picked", () => {
    const onDurationChange = vi.fn();
    render(<ReportsControlBar {...base} onDurationChange={onDurationChange} />);
    screen.getByRole("tab", { name: "Swing" }).click();
    expect(onDurationChange).toHaveBeenCalledWith("swing");
  });
});
