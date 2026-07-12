import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card } from "./Card";

describe("Card", () => {
	it("renders title and children", () => {
		render(
			<Card title="Accounts" description="Broker accounts">
				<p>Body</p>
			</Card>,
		);
		expect(screen.getByRole("heading", { name: "Accounts" })).toBeInTheDocument();
		expect(screen.getByText("Broker accounts")).toBeInTheDocument();
		expect(screen.getByText("Body")).toBeInTheDocument();
	});
});
