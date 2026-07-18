import type { Column } from "@tanstack/react-table";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import { ColumnHeader } from "./ColumnHeader";

function mockColumn(over: {
  canSort?: boolean;
  canHide?: boolean;
  sorted?: false | "asc" | "desc";
}): Column<unknown, unknown> {
  return {
    getCanSort: () => over.canSort ?? true,
    getCanHide: () => over.canHide ?? true,
    getIsSorted: () => over.sorted ?? false,
    toggleSorting: vi.fn(),
    clearSorting: vi.fn(),
    toggleVisibility: vi.fn(),
  } as unknown as Column<unknown, unknown>;
}

describe("ColumnHeader", () => {
  it("opens sort menu with Asc Desc Hide", async () => {
    const user = userEvent.setup();
    const column = mockColumn({});
    render(<ColumnHeader column={column} title="DATE" />);

    await user.click(screen.getByRole("button", { name: /DATE/i }));
    expect(await screen.findByRole("menuitem", { name: /Asc/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Desc/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Hide/i })).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: /Asc/i }));
    expect(column.toggleSorting).toHaveBeenCalledWith(false);
  });

  it("shows Reset when sorted and clears sorting", async () => {
    const user = userEvent.setup();
    const column = mockColumn({ sorted: "asc" });
    render(<ColumnHeader column={column} title="SYMBOL" />);

    await user.click(screen.getByRole("button", { name: /SYMBOL/i }));
    await user.click(await screen.findByRole("menuitem", { name: /Reset/i }));
    expect(column.clearSorting).toHaveBeenCalled();
  });

  it("hides column from menu", async () => {
    const user = userEvent.setup();
    const column = mockColumn({ canSort: false, canHide: true });
    render(<ColumnHeader column={column} title="STATUS" />);

    await user.click(screen.getByRole("button", { name: /STATUS/i }));
    await user.click(await screen.findByRole("menuitem", { name: /Hide/i }));
    expect(column.toggleVisibility).toHaveBeenCalledWith(false);
  });
});
