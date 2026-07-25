import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { Kbd, KbdGroup } from "./kbd";

describe("Kbd", () => {
  it("renders a keycap", () => {
    render(<Kbd>⌘K</Kbd>);
    const el = screen.getByText("⌘K");
    expect(el.tagName).toBe("KBD");
    expect(el).toHaveAttribute("data-slot", "kbd");
  });

  it("groups adjacent keycaps", () => {
    render(
      <KbdGroup>
        <Kbd>G</Kbd>
        <Kbd>D</Kbd>
      </KbdGroup>,
    );
    expect(screen.getByText("G")).toBeInTheDocument();
    expect(screen.getByText("D")).toBeInTheDocument();
    expect(screen.getByText("G").closest("[data-slot=kbd-group]")).toBeTruthy();
  });
});
