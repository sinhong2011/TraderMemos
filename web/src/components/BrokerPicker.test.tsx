import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import { BrokerPicker } from "./BrokerPicker";

describe("BrokerPicker", () => {
  it("groups brokers by how the data arrives", () => {
    render(<BrokerPicker onSelect={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Auto-sync" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "File import" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Manual" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Interactive Brokers/ })).toBeInTheDocument();
  });

  it("filters on aliases, not just the display name", async () => {
    const user = userEvent.setup();
    render(<BrokerPicker onSelect={vi.fn()} />);

    await user.type(screen.getByLabelText("Search brokers"), "ameritrade");

    expect(screen.getByRole("button", { name: /thinkorswim/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Interactive Brokers/ })).not.toBeInTheDocument();
  });

  it("points a miss at the escape hatches instead of an empty page", async () => {
    const user = userEvent.setup();
    render(<BrokerPicker onSelect={vi.fn()} />);

    await user.type(screen.getByLabelText("Search brokers"), "zzzz");

    expect(screen.getByText(/No broker matches/)).toBeInTheDocument();
    expect(screen.getByText(/Other broker/)).toBeInTheDocument();
  });

  it("reports the chosen broker by key", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<BrokerPicker onSelect={onSelect} />);

    await user.click(screen.getByRole("button", { name: /Webull/ }));

    expect(onSelect).toHaveBeenCalledWith("webull");
  });
});
