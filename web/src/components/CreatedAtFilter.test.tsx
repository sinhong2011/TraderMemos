import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { useFilters } from "../lib/filters";
import { CreatedAtFilter } from "./CreatedAtFilter";

describe("CreatedAtFilter", () => {
  beforeEach(() => {
    useFilters.getState().reset();
  });

  it("opens date range panel and clears active range", async () => {
    const user = userEvent.setup();
    useFilters.getState().setRange("2026-01-01T00:00:00Z", "2026-01-31T23:59:59Z");
    render(<CreatedAtFilter />);

    expect(screen.getByText("Created At")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear Created At filter" }));
    expect(useFilters.getState().from).toBeUndefined();
    expect(useFilters.getState().to).toBeUndefined();

    await user.click(screen.getByRole("button", { name: "Created At" }));
    expect(screen.getByLabelText("Date range")).toBeInTheDocument();
  });
});
