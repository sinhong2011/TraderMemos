import { describe, expect, it } from "vite-plus/test";
import { inferOptionRightFromSymbol, resolveTradeDirection } from "./tradeDirection";

describe("inferOptionRightFromSymbol", () => {
  it("parses OCC-style symbols", () => {
    expect(inferOptionRightFromSymbol("AAPL 240119C00150000")).toBe("call");
    expect(inferOptionRightFromSymbol("TSLA240321P00250000")).toBe("put");
    expect(inferOptionRightFromSymbol("TSLA")).toBe("");
  });
});

describe("resolveTradeDirection", () => {
  it("returns muted long/short for equities", () => {
    expect(resolveTradeDirection({ direction: "long", instrumentType: "stock" })).toMatchObject({
      tag: null,
      arrowUp: true,
      label: "Long",
      sortKey: "long",
    });
    expect(resolveTradeDirection({ direction: "short", instrumentType: "stock" })).toMatchObject({
      tag: null,
      arrowUp: false,
      label: "Short",
      sortKey: "short",
    });
  });

  it("tags option legs as LC/LP/SC/SP", () => {
    expect(
      resolveTradeDirection({
        direction: "long",
        instrumentType: "option",
        optionRight: "call",
      }),
    ).toMatchObject({ tag: "LC", tone: "profit", arrowUp: true, label: "Long Call" });

    expect(
      resolveTradeDirection({
        direction: "long",
        instrumentType: "option",
        optionRight: "put",
      }),
    ).toMatchObject({ tag: "LP", tone: "loss", arrowUp: false, label: "Long Put" });

    expect(
      resolveTradeDirection({
        direction: "short",
        instrumentType: "option",
        optionRight: "call",
      }),
    ).toMatchObject({ tag: "SC", tone: "loss", arrowUp: false, label: "Short Call" });
  });

  it("infers right from symbol when needed", () => {
    expect(
      resolveTradeDirection({
        direction: "long",
        instrumentType: "option",
        symbol: "TSLA 240119C00200000",
      }).tag,
    ).toBe("LC");
  });

  it("marks missing option right when requested", () => {
    expect(
      resolveTradeDirection({
        direction: "long",
        instrumentType: "option",
        markMissingOptionRight: true,
      }),
    ).toMatchObject({ tag: "?", tone: "signal", label: "Option — call/put missing" });
  });
});
