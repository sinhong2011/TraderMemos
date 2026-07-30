import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import type { SortingState } from "@tanstack/react-table";
import { describe, expect, it, vi } from "vite-plus/test";
import { SortList } from "./SortList";

vi.mock("./OptionsSelect", () => ({
  OptionsSelect: ({
    value,
    onValueChange,
    ariaLabel,
    options,
  }: {
    value: string;
    onValueChange: (v: string) => void;
    ariaLabel?: string;
    options: { value: string; label: string }[];
  }) => (
    <select aria-label={ariaLabel} value={value} onChange={(e) => onValueChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));

const COLUMNS = [
  { id: "opened_at", label: "Created At" },
  { id: "symbol", label: "Symbol" },
];

function Harness({ initial = [] as SortingState }) {
  const [sorting, setSorting] = useState<SortingState>(initial);
  return <SortList sorting={sorting} onSortingChange={setSorting} columns={COLUMNS} />;
}

describe("SortList", () => {
  it("adds and resets sorts", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Sort" }));
    await user.click(screen.getByRole("button", { name: "Add sort" }));
    expect(screen.getByLabelText("Sort column")).toHaveValue("opened_at");
    expect(screen.getByText("1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reset sorting" }));
    expect(screen.getByText("No sorting applied")).toBeInTheDocument();
  });
});
