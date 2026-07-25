import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import { ToneToggle } from "./ToneToggle";

describe("ToneToggle", () => {
  it("toggles pressed state and fires onPressedChange", async () => {
    const onPressedChange = vi.fn<(...args: any[]) => any>();
    render(
      <ToneToggle aria-label="Breakout" pressed={false} onPressedChange={onPressedChange}>
        Breakout
      </ToneToggle>,
    );

    const btn = screen.getByRole("button", { name: "Breakout" });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(btn);
    expect(onPressedChange).toHaveBeenCalledWith(true, expect.anything());
  });

  it("renders pressed accent state", () => {
    render(
      <ToneToggle aria-label="Pullback" pressed tone="accent">
        Pullback · main
      </ToneToggle>,
    );
    expect(screen.getByRole("button", { name: "Pullback" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
