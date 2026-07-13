import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MonthPicker } from "./MonthPicker";

function makeProps() {
	return {
		year: 2026,
		month: 7,
		onPrevMonth: vi.fn(),
		onNextMonth: vi.fn(),
		onToday: vi.fn(),
		onJumpToMonth: vi.fn(),
	};
}

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(new Date(2026, 6, 13));
});

afterEach(() => {
	vi.useRealTimers();
});

describe("MonthPicker", () => {
	it("jumps to a month in the current year from the grid", async () => {
		const props = makeProps();
		render(<MonthPicker {...props} />);

		await userEvent.click(
			screen.getByRole("button", { name: /July 2026, choose month/i }),
		);
		await userEvent.click(screen.getByRole("button", { name: "March 2026" }));

		expect(props.onJumpToMonth).toHaveBeenCalledWith(2026, 3);
	});

	it("steps years and jumps to a month in a previous year", async () => {
		const props = makeProps();
		render(<MonthPicker {...props} />);

		await userEvent.click(
			screen.getByRole("button", { name: /choose month/i }),
		);
		await userEvent.click(
			screen.getByRole("button", { name: "Previous year" }),
		);
		await userEvent.click(
			screen.getByRole("button", { name: "November 2025" }),
		);

		expect(props.onJumpToMonth).toHaveBeenCalledWith(2025, 11);
	});

	it("disables future months and the next-year stepper at the current year", async () => {
		const props = makeProps();
		render(<MonthPicker {...props} />);

		await userEvent.click(
			screen.getByRole("button", { name: /choose month/i }),
		);

		expect(screen.getByRole("button", { name: "August 2026" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "July 2026" })).toBeEnabled();
		expect(screen.getByRole("button", { name: "Next year" })).toBeDisabled();
	});

	it("marks the active month as pressed", async () => {
		const props = makeProps();
		render(<MonthPicker {...props} />);

		await userEvent.click(
			screen.getByRole("button", { name: /choose month/i }),
		);

		expect(screen.getByRole("button", { name: "July 2026" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		expect(screen.getByRole("button", { name: "June 2026" })).toHaveAttribute(
			"aria-pressed",
			"false",
		);
	});

	it("applies quick jumps for this and last month", async () => {
		const props = makeProps();
		render(<MonthPicker {...props} />);

		await userEvent.click(
			screen.getByRole("button", { name: /choose month/i }),
		);
		await userEvent.click(screen.getByRole("button", { name: "Last month" }));

		expect(props.onJumpToMonth).toHaveBeenCalledWith(2026, 6);
	});
});
