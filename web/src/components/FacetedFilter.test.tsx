import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import { FacetedFilter } from "./FacetedFilter";

const OPTIONS = [
  { value: "win", label: "Wins" },
  { value: "loss", label: "Losses" },
  { value: "open", label: "Open" },
] as const;

describe("FacetedFilter", () => {
  it("opens options and selects a value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FacetedFilter title="Status" options={OPTIONS} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Status" }));
    await user.click(screen.getByRole("option", { name: /Wins/i }));
    expect(onChange).toHaveBeenCalledWith("win");
  });

  it("shows selected badge and clears", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FacetedFilter title="Status" options={OPTIONS} value="loss" onChange={onChange} />);

    expect(screen.getByText("Losses")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear Status filter" }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
