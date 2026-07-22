import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import { Modal } from "./Modal";
import { SignalSelect } from "./SignalSelect";

const OPTIONS = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "all", label: "All time" },
];

describe("SignalSelect", () => {
  it("shows the selected label and fires onValueChange", async () => {
    const onValueChange = vi.fn();
    render(
      <SignalSelect
        value="30d"
        onValueChange={onValueChange}
        options={OPTIONS}
        ariaLabel="Date range"
      />,
    );

    expect(screen.getByRole("combobox", { name: "Date range" })).toHaveTextContent("Last 30 days");

    await userEvent.click(screen.getByRole("combobox", { name: "Date range" }));
    await userEvent.click(await screen.findByRole("option", { name: "All time" }));
    expect(onValueChange).toHaveBeenCalledWith("all");
  });

  it("works inside a modal dialog without blocking option clicks", async () => {
    const onValueChange = vi.fn();
    render(
      <Modal open onOpenChange={() => {}} title="Test modal">
        <SignalSelect
          value="cash"
          onValueChange={onValueChange}
          options={[
            { value: "cash", label: "Cash" },
            { value: "margin", label: "Margin" },
          ]}
          ariaLabel="Market"
        />
      </Modal>,
    );

    await userEvent.click(screen.getByRole("combobox", { name: "Market" }));
    await userEvent.click(await screen.findByRole("option", { name: "Margin" }));
    expect(onValueChange).toHaveBeenCalledWith("margin");
  });
});
