import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import type { VisibilityState } from "@tanstack/react-table";
import { describe, expect, it } from "vite-plus/test";
import { ViewOptions } from "./ViewOptions";

function Harness() {
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  return (
    <ViewOptions
      columns={[
        { id: "symbol", label: "Symbol" },
        { id: "net_pnl", label: "P&L" },
      ]}
      columnVisibility={columnVisibility}
      onColumnVisibilityChange={setColumnVisibility}
    />
  );
}

describe("ViewOptions", () => {
  it("toggles column visibility", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Toggle columns" }));
    const symbol = await screen.findByRole("menuitemcheckbox", { name: /Symbol/i });
    expect(symbol).toHaveAttribute("aria-checked", "true");
    await user.click(symbol);
    expect(symbol).toHaveAttribute("aria-checked", "false");
  });
});
