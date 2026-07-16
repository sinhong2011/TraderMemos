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
});
