import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SegmentedControl } from "./SegmentedControl";

const OPTIONS = [
	{ value: "30D", label: "30D" },
	{ value: "90D", label: "90D" },
	{ value: "ALL", label: "ALL" },
];

describe("SegmentedControl", () => {
	it("marks the active option and fires onChange", async () => {
		const onChange = vi.fn();
		render(
			<SegmentedControl options={OPTIONS} value="30D" onChange={onChange} />,
		);
		expect(screen.getByRole("button", { name: "30D" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		await userEvent.click(screen.getByRole("button", { name: "ALL" }));
		expect(onChange).toHaveBeenCalledWith("ALL");
	});
});
