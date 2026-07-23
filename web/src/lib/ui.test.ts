import { describe, expect, it } from "vite-plus/test";
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
  it("opens setup edit with a draft", () => {
    useUI.getState().openSetupEdit({
      id: "s1",
      name: "ORB",
      thesis: "Breakout",
      symbol: "AAPL",
      direction: "long",
      target: "110",
      stop: "95",
      checklistText: "Above VWAP",
    });
    expect(useUI.getState().modal).toBe("new-setup");
    const draft = useUI.getState().consumeSetupDraft();
    expect(draft?.name).toBe("ORB");
    expect(useUI.getState().setupDraft).toBeNull();
  });
  it("opens note edit with a draft", () => {
    useUI.getState().openNoteEdit({
      id: "n1",
      type: "daily_log",
      occurredAt: "2026-07-23",
      title: "Session",
      body: "## Review\nClean day",
      symbols: [{ symbol: "AAPL", body: "Held VWAP" }],
    });
    expect(useUI.getState().modal).toBe("new-note");
    const draft = useUI.getState().consumeNoteDraft();
    expect(draft?.title).toBe("Session");
    expect(draft?.symbols?.[0]?.symbol).toBe("AAPL");
    expect(useUI.getState().noteDraft).toBeNull();
  });
  it("clears note draft when opening a fresh new-note modal", () => {
    useUI.getState().openNoteEdit({
      id: "n1",
      type: "note",
      occurredAt: "2026-07-23",
      title: "Session",
      body: "x",
      symbols: [],
    });
    useUI.getState().openModal("new-note");
    expect(useUI.getState().modal).toBe("new-note");
    expect(useUI.getState().noteDraft).toBeNull();
  });
  it("clears setup draft when opening a fresh new-setup modal", () => {
    useUI.getState().openSetupEdit({
      id: "s1",
      name: "ORB",
      thesis: "",
      symbol: "",
      direction: "long",
      target: "",
      stop: "",
      checklistText: "",
    });
    useUI.getState().openModal("new-setup");
    expect(useUI.getState().modal).toBe("new-setup");
    expect(useUI.getState().setupDraft).toBeNull();
  });
  it("toggles sidebar", () => {
    const before = useUI.getState().sidebarCollapsed;
    useUI.getState().toggleSidebar();
    expect(useUI.getState().sidebarCollapsed).toBe(!before);
  });
  it("opens command palette and position size modal", () => {
    useUI.getState().openCommandPalette();
    expect(useUI.getState().commandOpen).toBe(true);
    useUI.getState().setCommandOpen(false);
    expect(useUI.getState().commandOpen).toBe(false);
    useUI.getState().openPositionSize();
    expect(useUI.getState().positionSizeOpen).toBe(true);
  });
});
