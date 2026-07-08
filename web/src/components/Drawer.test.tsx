import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Drawer, DrawerBanner } from "./Drawer";

describe("Drawer", () => {
	it("renders title, children and footer when open", () => {
		render(
			<Drawer
				open
				onOpenChange={vi.fn()}
				title="New Trade"
				footer={<button type="button">Save</button>}
			>
				<DrawerBanner>Log any trade.</DrawerBanner>
				<p>Body</p>
			</Drawer>,
		);
		expect(screen.getByText("New Trade")).toBeInTheDocument();
		expect(screen.getByText("Log any trade.")).toBeInTheDocument();
		expect(screen.getByText("Body")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
	});
	it("renders nothing when closed", () => {
		render(
			<Drawer open={false} onOpenChange={vi.fn()} title="Hidden">
				<p>Body</p>
			</Drawer>,
		);
		expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
	});
});
