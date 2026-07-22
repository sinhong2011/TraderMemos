import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

const items = [
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "All time", value: "all" },
];

describe("Select", () => {
  it("renders trigger with data-slot and selected label", () => {
    render(
      <Select items={items} value="30d" onValueChange={() => {}}>
        <SelectTrigger aria-label="Date range">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>,
    );

    const trigger = screen.getByRole("combobox", { name: "Date range" });
    expect(trigger).toHaveAttribute("data-slot", "select-trigger");
    expect(trigger).toHaveTextContent("Last 30 days");
  });

  it("fires onValueChange when an option is chosen", async () => {
    const onValueChange = vi.fn<(value: string | null) => void>();
    render(
      <Select items={items} value="30d" onValueChange={onValueChange} modal={false}>
        <SelectTrigger aria-label="Date range">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>,
    );

    await userEvent.click(screen.getByRole("combobox", { name: "Date range" }));
    await userEvent.click(await screen.findByRole("option", { name: "All time" }));
    expect(onValueChange).toHaveBeenCalledWith("all", expect.anything());
  });

  it("supports ghost and sm trigger variants", () => {
    render(
      <Select items={items} value="7d" onValueChange={() => {}}>
        <SelectTrigger aria-label="Compact" variant="ghost" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>,
    );

    const trigger = screen.getByRole("combobox", { name: "Compact" });
    expect(trigger).toHaveAttribute("data-variant", "ghost");
    expect(trigger).toHaveAttribute("data-size", "sm");
  });
});
