import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatCard } from "./StatCard";

describe("StatCard", () => {
	it("renders label and value", () => {
		render(<StatCard label="Net P&L" value="+$4,182.00" />);
		expect(screen.getByText("Net P&L")).toBeInTheDocument();
		expect(screen.getByText("+$4,182.00")).toBeInTheDocument();
	});
});
