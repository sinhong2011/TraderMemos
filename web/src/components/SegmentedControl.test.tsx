import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import { SegmentedControl } from "./SegmentedControl";

const OPTIONS = [
  { value: "30D", label: "30D" },
  { value: "90D", label: "90D" },
  { value: "ALL", label: "ALL" },
];

describe("SegmentedControl", () => {
  it("marks the active option and fires onChange", async () => {
    const onChange = vi.fn();
    render(<SegmentedControl options={OPTIONS} value="30D" onChange={onChange} />);
    expect(screen.getByRole("tab", { name: "30D" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(screen.getByRole("tab", { name: "ALL" }));
    expect(onChange).toHaveBeenCalledWith("ALL");
  });

  it("stretches equal-width segments when fullWidth", () => {
    render(
      <SegmentedControl
        options={OPTIONS}
        value="30D"
        onChange={() => {}}
        fullWidth
        size="md"
        ariaLabel="Range"
      />,
    );
    const list = screen.getByRole("tablist", { name: "Range" });
    expect(list.className).toMatch(/flex/);
    expect(list.className).toMatch(/w-full/);
    expect(screen.getByRole("tab", { name: "30D" }).className).toMatch(/flex-1/);
  });

  it("applies semantic tone classes for long/short", () => {
    const { rerender } = render(
      <SegmentedControl
        options={[
          { value: "long", label: "LONG" },
          { value: "short", label: "SHORT" },
        ]}
        tones={{ long: "pos", short: "neg" }}
        value="long"
        onChange={() => {}}
        ariaLabel="Side"
      />,
    );
    const list = screen.getByRole("tablist", { name: "Side" });
    const indicator = list.querySelector("[class*=bg-profit]");
    expect(indicator).toBeTruthy();
    expect(screen.getByRole("tab", { name: "LONG" }).className).toMatch(/text-profit/);

    rerender(
      <SegmentedControl
        options={[
          { value: "long", label: "LONG" },
          { value: "short", label: "SHORT" },
        ]}
        tones={{ long: "pos", short: "neg" }}
        value="short"
        onChange={() => {}}
        ariaLabel="Side"
      />,
    );
    expect(list.querySelector("[class*=bg-loss]")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "SHORT" }).className).toMatch(/text-loss/);
  });
});
