import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AnimatedHeight } from "./AnimatedHeight";

describe("AnimatedHeight", () => {
	it("renders children inside a height wrapper", () => {
		const ro = vi.fn();
		class MockResizeObserver {
			observe = ro;
			disconnect = vi.fn();
		}
		vi.stubGlobal("ResizeObserver", MockResizeObserver);

		const { container } = render(
			<AnimatedHeight>
				<p>Panel content</p>
			</AnimatedHeight>,
		);

		expect(screen.getByText("Panel content")).toBeInTheDocument();
		expect(container.firstElementChild).toHaveClass("overflow-hidden");
	});
});
