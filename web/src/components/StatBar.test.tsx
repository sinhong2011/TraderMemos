import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatBar } from "./StatBar";

describe("StatBar", () => {
	it("renders label, value and right text", () => {
		render(<StatBar label="WINS" value="2" right="50%" pct={0.5} tone="pos" />);
		expect(screen.getByText(/WINS/)).toBeInTheDocument();
		expect(screen.getByText("2")).toBeInTheDocument();
		expect(screen.getByText("50%")).toBeInTheDocument();
	});
	it("clamps pct into 0..1", () => {
		render(<StatBar label="X" value="1" pct={4} tone="neg" />);
		const fill = screen.getByTestId("statbar-fill");
		expect(fill.style.width).toBe("100%");
	});
});
