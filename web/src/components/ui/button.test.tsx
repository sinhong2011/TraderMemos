import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import { Button } from "./button";
import { TooltipProvider } from "./tooltip";

function wrap(ui: React.ReactNode) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

describe("Button", () => {
  it("renders default variant and forwards clicks", async () => {
    const onClick = vi.fn<(...args: any[]) => any>();
    wrap(
      <Button type="button" onClick={onClick}>
        Save
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn).toHaveAttribute("data-slot", "button");
    btn.click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("supports outline and icon sizes", () => {
    wrap(
      <Button type="button" variant="outline" size="icon" aria-label="Expand">
        +
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Expand" })).toBeInTheDocument();
  });

  it("honors disabled", () => {
    wrap(
      <Button type="button" disabled>
        Busy
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Busy" })).toBeDisabled();
  });

  it("can disable icon tooltips", () => {
    wrap(
      <Button type="button" size="icon" aria-label="Page 1" tooltip={false}>
        1
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Page 1" })).toBeInTheDocument();
  });
});
