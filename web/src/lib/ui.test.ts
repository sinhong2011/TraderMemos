import { describe, expect, it } from "vitest";
import { useUI } from "./ui";

describe("useUI store", () => {
	it("opens and closes modals", () => {
		useUI.getState().openModal("new-trade");
		expect(useUI.getState().modal).toBe("new-trade");
		useUI.getState().closeModal();
		expect(useUI.getState().modal).toBeNull();
	});
	it("opens trade from setup with a draft", () => {
		useUI.getState().openTradeFromSetup({
			setupId: "s1",
			symbol: "AAPL",
			side: "long",
		});
		expect(useUI.getState().modal).toBe("new-trade");
		const draft = useUI.getState().consumeTradeDraft();
		expect(draft?.symbol).toBe("AAPL");
		expect(useUI.getState().tradeDraft).toBeNull();
	});
	it("toggles sidebar", () => {
		const before = useUI.getState().sidebarCollapsed;
		useUI.getState().toggleSidebar();
		expect(useUI.getState().sidebarCollapsed).toBe(!before);
	});
});
