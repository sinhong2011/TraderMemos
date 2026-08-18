import { describe, expect, it } from "vite-plus/test";
import { BROKERS, findBroker, KIND_ORDER, searchBrokers } from "./brokers";

/**
 * The keys of `importer.brokerPresets` in api/internal/importer/brokers.go,
 * plus the MetaTrader statement parser. A card marked `recognised` promises
 * the server pre-fills its column mapping — this list is what makes that
 * promise checkable when either side changes.
 */
const SERVER_PRESET_KEYS = [
  "ibkr",
  "thinkorswim",
  "webull",
  "schwab",
  "tradovate",
  "ctrader",
  "dxtrade",
  "matchtrader",
  "ninjatrader",
  "metatrader",
];

describe("broker catalogue", () => {
  it("has unique keys", () => {
    const keys = BROKERS.map((b) => b.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("only claims recognition for brokers the server has a preset for", () => {
    const claimed = BROKERS.filter((b) => b.recognised)
      .map((b) => b.key)
      .sort();
    expect(claimed).toEqual([...SERVER_PRESET_KEYS].sort());
  });

  it("gives every broker export steps and a monogram", () => {
    for (const broker of BROKERS) {
      expect(broker.steps.length, broker.key).toBeGreaterThan(0);
      expect(broker.monogram, broker.key).not.toBe("");
      expect(broker.brand, broker.key).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("covers every connect kind so no picker group is empty", () => {
    for (const kind of KIND_ORDER) {
      expect(
        BROKERS.some((b) => b.kind === kind),
        kind,
      ).toBe(true);
    }
  });

  it("keeps an escape hatch for unlisted brokers", () => {
    expect(findBroker("generic")?.kind).toBe("file");
    expect(findBroker("manual")?.kind).toBe("manual");
  });
});

describe("findBroker", () => {
  it("returns undefined for unknown and empty keys", () => {
    expect(findBroker("not-a-broker")).toBeUndefined();
    expect(findBroker("")).toBeUndefined();
    expect(findBroker(undefined)).toBeUndefined();
  });
});

describe("searchBrokers", () => {
  it("returns everything for an empty query", () => {
    expect(searchBrokers("   ")).toHaveLength(BROKERS.length);
  });

  it("matches on the display name, case-insensitively", () => {
    expect(searchBrokers("webull").map((b) => b.key)).toEqual(["webull"]);
    expect(searchBrokers("WEBULL").map((b) => b.key)).toEqual(["webull"]);
  });

  it("matches aliases, so old and parent names still find the card", () => {
    expect(searchBrokers("ameritrade").map((b) => b.key)).toContain("thinkorswim");
    expect(searchBrokers("mt5").map((b) => b.key)).toContain("metatrader");
    expect(searchBrokers("futu").map((b) => b.key)).toContain("moomoo");
  });

  it("groups prop-firm platforms under a shared alias", () => {
    const keys = searchBrokers("prop").map((b) => b.key);
    expect(keys).toEqual(expect.arrayContaining(["ctrader", "dxtrade", "matchtrader"]));
  });

  it("returns nothing for a miss, so the picker can say so", () => {
    expect(searchBrokers("zzzzz")).toHaveLength(0);
  });
});
