import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import { Button } from "./button";

describe("Button", () => {
  it("renders default variant and forwards clicks", async () => {
    const onClick = vi.fn();
    render(
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
    render(
      <Button type="button" variant="outline" size="icon" aria-label="Expand">
        +
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Expand" })).toBeInTheDocument();
  });

  it("honors disabled", () => {
    render(
      <Button type="button" disabled>
        Busy
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Busy" })).toBeDisabled();
  });
});
