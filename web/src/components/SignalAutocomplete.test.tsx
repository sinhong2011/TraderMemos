import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import { ModelAutocomplete, SignalAutocomplete } from "./SignalAutocomplete";

describe("SignalAutocomplete", () => {
  it("filters and selects an item", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <SignalAutocomplete
        value=""
        onValueChange={onValueChange}
        items={["gpt-4o-mini", "gpt-4o", "o4-mini"]}
        ariaLabel="Model"
      />,
    );

    const input = screen.getByRole("combobox", { name: "Model" });
    await user.type(input, "4o-m");
    await user.click(await screen.findByRole("option", { name: "gpt-4o-mini" }));
    expect(onValueChange).toHaveBeenLastCalledWith("gpt-4o-mini");
  });
});

describe("ModelAutocomplete", () => {
  it("exposes a fetch models control on the right", async () => {
    const user = userEvent.setup();
    const onFetch = vi.fn();
    render(
      <ModelAutocomplete
        value="gpt-4o-mini"
        onValueChange={() => {}}
        onFetchModels={onFetch}
        fetchLabel="Fetch models"
        ariaLabel="Model"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Fetch models" }));
    expect(onFetch).toHaveBeenCalledTimes(1);
  });

  it("shows spinner while fetching", async () => {
    render(
      <ModelAutocomplete
        value="gpt-4o-mini"
        onValueChange={() => {}}
        onFetchModels={() => {}}
        fetching
        fetchLabel="Fetch models"
        ariaLabel="Model"
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Fetch models" })).toBeDisabled();
    });
  });

  it("clears the model value", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <ModelAutocomplete value="gpt-4o-mini" onValueChange={onValueChange} ariaLabel="Model" />,
    );

    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(onValueChange).toHaveBeenCalledWith("");
  });
});
