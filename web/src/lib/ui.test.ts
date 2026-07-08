import { describe, expect, it } from "vitest";
import { useUI } from "./ui";

describe("useUI store", () => {
	it("opens and closes drawers", () => {
		useUI.getState().openDrawer("new-trade");
		expect(useUI.getState().drawer).toBe("new-trade");
		useUI.getState().closeDrawer();
		expect(useUI.getState().drawer).toBeNull();
	});
	it("toggles sidebar", () => {
		const before = useUI.getState().sidebarCollapsed;
		useUI.getState().toggleSidebar();
		expect(useUI.getState().sidebarCollapsed).toBe(!before);
	});
});
