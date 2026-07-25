import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import { DatePicker } from "./DatePicker";

describe("DatePicker", () => {
  it("opens calendar and selects a date", async () => {
    const onChange = vi.fn<(...args: any[]) => any>();
    render(<DatePicker aria-label="Trade date" value="2026-07-01" onChange={onChange} />);

    expect(screen.getByRole("button", { name: "Trade date" })).toHaveTextContent("Jul 1, 2026");

    await userEvent.click(screen.getByRole("button", { name: "Trade date" }));
    expect(screen.getByRole("grid")).toBeInTheDocument();
  });
});
