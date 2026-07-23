import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import { SignalToggle } from "./SignalToggle";

describe("SignalToggle", () => {
  it("toggles pressed state and fires onPressedChange", async () => {
    const onPressedChange = vi.fn<(...args: any[]) => any>();
    render(
      <SignalToggle aria-label="Breakout" pressed={false} onPressedChange={onPressedChange}>
        Breakout
      </SignalToggle>,
    );

    const btn = screen.getByRole("button", { name: "Breakout" });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(btn);
    expect(onPressedChange).toHaveBeenCalledWith(true, expect.anything());
  });

  it("renders pressed accent state", () => {
    render(
      <SignalToggle aria-label="Pullback" pressed tone="accent">
        Pullback · main
      </SignalToggle>,
    );
    expect(screen.getByRole("button", { name: "Pullback" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
