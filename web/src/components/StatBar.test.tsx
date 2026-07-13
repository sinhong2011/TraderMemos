import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatBar } from "./StatBar";

describe("StatBar", () => {
	it("renders label, value and sub text", () => {
		render(<StatBar label="WINS" value="2" sub="50%" tone="pos" />);
		expect(screen.getByText("WINS")).toBeInTheDocument();
		expect(screen.getByText("2")).toBeInTheDocument();
		expect(screen.getByText("50%")).toBeInTheDocument();
	});

	it("marks filter buttons as pressed when active", () => {
		render(
			<StatBar
				label="WINS"
				value="2"
				sub="50%"
				tone="pos"
				onClick={() => {}}
				active
			/>,
		);
		expect(screen.getByRole("button", { pressed: true })).toBeInTheDocument();
	});
});
