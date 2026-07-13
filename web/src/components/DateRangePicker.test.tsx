import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { useFilters } from "../lib/filters";
import { DateRangePicker } from "./DateRangePicker";

afterEach(() => useFilters.getState().reset());

describe("DateRangePicker", () => {
	it("applies Last 30 days preset from the popover", async () => {
		render(<DateRangePicker />);

		const trigger = screen.getByRole("button", { name: "Date range" });
		expect(trigger).toHaveTextContent("All time");

		await userEvent.click(trigger);
		await userEvent.click(screen.getByRole("button", { name: "Last 30 days" }));

		expect(trigger).toHaveTextContent("Last 30 days");
		const { from, to } = useFilters.getState();
		expect(from).toMatch(/T00:00:00Z$/);
		expect(to).toMatch(/T23:59:59Z$/);
		expect(useFilters.getState().toParams().from).toBe(from);
	});

	it("applies a custom range after clicking two dates", async () => {
		render(<DateRangePicker />);

		const trigger = screen.getByRole("button", { name: "Date range" });
		await userEvent.click(trigger);

		const [startDay, endDay] = [
			screen.getByRole("button", { name: /July 6th, 2026/ }),
			screen.getByRole("button", { name: /July 10th, 2026/ }),
		];

		await userEvent.click(startDay);
		// First click holds a pending start instead of applying a 1-day range.
		expect(screen.getByText("Select end date")).toBeInTheDocument();
		expect(useFilters.getState().from).toBeUndefined();

		await userEvent.click(endDay);
		const { from, to } = useFilters.getState();
		expect(from).toBe("2026-07-06");
		expect(to).toBe("2026-07-10");
	});

	it("applies a one-day range when the same date is clicked twice", async () => {
		render(<DateRangePicker />);

		await userEvent.click(screen.getByRole("button", { name: "Date range" }));
		const day = screen.getByRole("button", { name: /July 6th, 2026/ });
		await userEvent.click(day);
		await userEvent.click(day);

		const { from, to } = useFilters.getState();
		expect(from).toBe("2026-07-06");
		expect(to).toBe("2026-07-06");
	});

	it("opens calendar popover with preset shortcuts", async () => {
		render(<DateRangePicker />);
		await userEvent.click(screen.getByRole("button", { name: "Date range" }));
		expect(screen.getByRole("grid")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Last 7 days" }),
		).toBeInTheDocument();
	});
});
