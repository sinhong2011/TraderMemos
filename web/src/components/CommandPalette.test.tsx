import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CommandPalette } from "./CommandPalette";
import { useUI } from "../lib/ui";

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => vi.fn(),
}));

vi.mock("../lib/useToolRunner", () => ({
	useToolRunner: () => vi.fn(),
}));

describe("CommandPalette", () => {
	it("renders grouped commands when open", () => {
		useUI.setState({ commandOpen: true });
		render(<CommandPalette />);
		expect(screen.getByPlaceholderText(/Pages, tools/i)).toBeInTheDocument();
		expect(screen.getByText("Navigate")).toBeInTheDocument();
		expect(screen.getByText("Dashboard")).toBeInTheDocument();
		expect(screen.getByText("New Trade")).toBeInTheDocument();
		expect(screen.getByText("Position size")).toBeInTheDocument();
	});

	it("filters commands by query", async () => {
		const user = userEvent.setup();
		useUI.setState({ commandOpen: true });
		render(<CommandPalette />);
		await user.type(
			screen.getByPlaceholderText(/Pages, tools/i),
			"position",
		);
		expect(screen.getByText("Position size")).toBeInTheDocument();
		expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
	});
});
