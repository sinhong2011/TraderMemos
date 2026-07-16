import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import {
  formatDatetimeLocal,
  parseDatetimeLocal,
  SignalDateTimePicker,
} from "./SignalDateTimePicker";

describe("parseDatetimeLocal / formatDatetimeLocal", () => {
  it("round-trips YYYY-MM-DDTHH:mm:ss", () => {
    const parsed = parseDatetimeLocal("2026-07-15T22:31:39");
    expect(parsed).not.toBeNull();
    expect(parsed!.hours).toBe(22);
    expect(parsed!.minutes).toBe(31);
    expect(parsed!.seconds).toBe(39);
    expect(formatDatetimeLocal(parsed!.date, parsed!.hours, parsed!.minutes, parsed!.seconds)).toBe(
      "2026-07-15T22:31:39",
    );
  });

  it("defaults missing seconds to 0", () => {
    const parsed = parseDatetimeLocal("2026-07-15T22:31");
    expect(parsed?.seconds).toBe(0);
  });

  it("rejects garbage", () => {
    expect(parseDatetimeLocal("")).toBeNull();
    expect(parseDatetimeLocal("not-a-date")).toBeNull();
  });
});

describe("SignalDateTimePicker", () => {
  it("opens panel with calendar and time columns", async () => {
    const onChange = vi.fn();
    render(
      <SignalDateTimePicker
        aria-label="Fill datetime"
        value="2026-07-15T22:31:39"
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Fill datetime" }));
    expect(screen.getByRole("grid")).toBeInTheDocument();
    expect(screen.getByRole("listbox", { name: "Hours" })).toBeInTheDocument();
    expect(screen.getByRole("listbox", { name: "Minutes" })).toBeInTheDocument();
    expect(screen.getByRole("listbox", { name: "Seconds" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Now" })).toBeInTheDocument();
  });

  it("applies selected hour, minute, and second", async () => {
    const onChange = vi.fn();
    render(
      <SignalDateTimePicker
        aria-label="Fill datetime"
        value="2026-07-15T10:00:00"
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Fill datetime" }));
    const hours = screen.getByRole("listbox", { name: "Hours" });
    const minutes = screen.getByRole("listbox", { name: "Minutes" });
    const seconds = screen.getByRole("listbox", { name: "Seconds" });
    await userEvent.click(within(hours).getByRole("option", { name: "14" }));
    await userEvent.click(within(minutes).getByRole("option", { name: "45" }));
    await userEvent.click(within(seconds).getByRole("option", { name: "12" }));
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(onChange).toHaveBeenCalledWith("2026-07-15T14:45:12");
  });
});
