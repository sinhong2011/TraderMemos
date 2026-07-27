import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import { formatDatetimeLocal, parseDatetimeLocal, DateTimePicker } from "./DateTimePicker";

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

describe("DateTimePicker", () => {
  it("shows yyyy-MM-dd HH:mm:ss on the closed trigger", () => {
    render(
      <DateTimePicker
        aria-label="Fill datetime"
        value="2026-07-15T22:31:39"
        onChange={vi.fn<(...args: any[]) => any>()}
      />,
    );
    const trigger = screen.getByRole("button", { name: "Fill datetime" });
    expect(trigger).toHaveTextContent("2026-07-15 22:31:39");
  });

  it("opens panel with calendar and hh:mm:ss segments", async () => {
    const onChange = vi.fn<(...args: any[]) => any>();
    render(
      <DateTimePicker aria-label="Fill datetime" value="2026-07-15T22:31:39" onChange={onChange} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Fill datetime" }));
    expect(screen.getByRole("grid")).toBeInTheDocument();
    const time = screen.getByRole("group", { name: "Time" });
    expect(within(time).getByRole("combobox", { name: "Hours" })).toHaveValue("22");
    expect(within(time).getByRole("combobox", { name: "Minutes" })).toHaveValue("31");
    expect(within(time).getByRole("combobox", { name: "Seconds" })).toHaveValue("39");
    expect(screen.getByRole("button", { name: "Apply" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Now" })).toBeInTheDocument();
  });

  it("applies the hour, minute, and second picked in each slot", async () => {
    const onChange = vi.fn<(...args: any[]) => any>();
    render(
      <DateTimePicker aria-label="Fill datetime" value="2026-07-15T10:00:00" onChange={onChange} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Fill datetime" }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Hours" }), "14");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Minutes" }), "45");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Seconds" }), "12");
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(onChange).toHaveBeenCalledWith("2026-07-15T14:45:12");
  });

  it("offers every in-range value and nothing outside it", async () => {
    render(
      <DateTimePicker
        aria-label="Fill datetime"
        value="2026-07-15T10:00:00"
        onChange={vi.fn<(...args: any[]) => any>()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Fill datetime" }));
    const hours = within(screen.getByRole("combobox", { name: "Hours" }));
    expect(hours.getAllByRole("option")).toHaveLength(24);
    expect(hours.getByRole("option", { name: "23" })).toBeInTheDocument();
    expect(hours.queryByRole("option", { name: "24" })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("combobox", { name: "Seconds" })).getAllByRole("option"),
    ).toHaveLength(60);
  });

  it("keeps the calendar day when only the time changes", async () => {
    const onChange = vi.fn<(...args: any[]) => any>();
    render(
      <DateTimePicker aria-label="Fill datetime" value="2026-07-15T00:00:00" onChange={onChange} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Fill datetime" }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Hours" }), "21");
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(onChange).toHaveBeenCalledWith("2026-07-15T21:00:00");
  });
});
