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
    const onChange = vi.fn<(...args: any[]) => any>();
    render(<SegmentedControl options={OPTIONS} value="30D" onChange={onChange} />);
    expect(screen.getByRole("button", { name: "30D" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "ALL" })).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(screen.getByRole("button", { name: "ALL" }));
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
    const group = screen.getByRole("group", { name: "Range" });
    expect(group.className).toMatch(/w-full/);
    expect(group.className).toMatch(/bg-muted/);
    expect(screen.getByRole("button", { name: "30D" }).className).toMatch(/flex-1/);
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
    const long = screen.getByRole("button", { name: "LONG" });
    expect(long.className).toMatch(/text-profit/);
    expect(long.querySelector("[class*=bg-profit]")).toBeTruthy();

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
    const short = screen.getByRole("button", { name: "SHORT" });
    expect(short.className).toMatch(/text-destructive/);
    expect(short.querySelector("[class*=bg-destructive]")).toBeTruthy();
  });

  it("uses a raised pill for the default active segment", () => {
    render(
      <SegmentedControl options={OPTIONS} value="30D" onChange={() => {}} ariaLabel="Range" />,
    );
    const active = screen.getByRole("button", { name: "30D" });
    const pill = active.querySelector("[class*=rounded-md]");
    expect(pill?.className).toMatch(/bg-background/);
    expect(pill?.className).toMatch(/dark:bg-input/);
  });
});
