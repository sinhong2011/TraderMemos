import { afterEach, describe, expect, it } from "vite-plus/test";
import { render } from "@testing-library/react";
import { RollingNumber } from "./RollingNumber";
import { armRollingNumbers, resetRollingNumbers } from "@/lib/rollingNumbers";

/** The outgoing copy is the only marker that a roll is running. */
const leavingDigits = () =>
  Array.from(document.querySelectorAll('[data-roll="out"]')).map((node) => node.textContent);

/**
 * The figure is one span per character, so it has no single text node to
 * query — read it back the way a reader would, by concatenating the cells
 * holding the current value.
 */
const shownText = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('[data-roll="in"]'))
    .map((node) => node.textContent)
    .join("");

afterEach(() => resetRollingNumbers());

describe("RollingNumber", () => {
  it("renders its value on mount without animating", () => {
    armRollingNumbers();
    const { container } = render(<RollingNumber value="$1,234.00" />);

    expect(shownText(container)).toBe("$1,234.00");
    expect(leavingDigits()).toHaveLength(0);
  });

  it("swaps silently when the change was not caused by a trade write", () => {
    const view = render(<RollingNumber value="$1,234.00" />);
    view.rerender(<RollingNumber value="$9,999.00" />);

    expect(shownText(view.container)).toBe("$9,999.00");
    expect(leavingDigits()).toHaveLength(0);
  });

  it("rolls only the digits that changed after a trade write", () => {
    const view = render(<RollingNumber value="$1,234.00" />);
    armRollingNumbers();
    view.rerender(<RollingNumber value="$1,534.00" />);

    // Only the hundreds digit moved; the rest of the figure holds still.
    expect(leavingDigits()).toEqual(["2"]);
  });

  it("pairs digits from the units end when the figure gains one", () => {
    const view = render(<RollingNumber value="$9.99" />);
    armRollingNumbers();
    view.rerender(<RollingNumber value="$19.99" />);

    // Right-aligned, "9.99" is unchanged and only the leading "$" is displaced
    // — index-for-index every character would have looked different.
    expect(leavingDigits()).toEqual(["$"]);
  });

  it("stops arming once the window has passed", () => {
    const view = render(<RollingNumber value="1" />);
    armRollingNumbers();
    resetRollingNumbers();
    view.rerender(<RollingNumber value="2" />);

    expect(leavingDigits()).toHaveLength(0);
  });
});
