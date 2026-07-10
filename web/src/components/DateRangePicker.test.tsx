import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { useFilters } from "../lib/filters";
import { DateRangePicker } from "./DateRangePicker";

afterEach(() => useFilters.getState().reset());

describe("DateRangePicker", () => {
	it("keeps the selected preset label after choosing Last 30 days", async () => {
		render(<DateRangePicker />);

		const trigger = screen.getByRole("combobox", { name: "Date range" });
		expect(trigger).toHaveTextContent("All time");

		await userEvent.click(trigger);
		await userEvent.click(screen.getByRole("option", { name: "Last 30 days" }));

		expect(trigger).toHaveTextContent("Last 30 days");
		const { from, to } = useFilters.getState();
		expect(from).toMatch(/T00:00:00Z$/);
		expect(to).toMatch(/T23:59:59Z$/);
		expect(useFilters.getState().toParams().from).toBe(from);
	});
});
