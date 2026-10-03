import { describe, expect, it } from "vite-plus/test";
import { formatCountdown, returnRuleLabel, triggerSentence } from "./cooldown";

describe("formatCountdown", () => {
  it("formats minutes and seconds", () => {
    expect(formatCountdown(0)).toBe("0:00");
    expect(formatCountdown(59)).toBe("0:59");
    expect(formatCountdown(125)).toBe("2:05");
    expect(formatCountdown(899)).toBe("14:59");
  });

  it("adds an hour field past sixty minutes", () => {
    expect(formatCountdown(3600)).toBe("1:00:00");
    expect(formatCountdown(3725)).toBe("1:02:05");
  });

  it("clamps negatives to zero", () => {
    expect(formatCountdown(-5)).toBe("0:00");
  });
});

describe("labels", () => {
  it("names every trigger", () => {
    expect(triggerSentence("loss_streak")).toMatch(/loss streak/);
    expect(triggerSentence("daily_loss")).toMatch(/daily loss/);
    expect(triggerSentence("trade_limit")).toMatch(/cap/);
    expect(triggerSentence("manual")).toMatch(/step away/);
  });

  it("falls back to the raw key for unknown rules", () => {
    expect(returnRuleLabel("one_trade")).toBe("One trade");
    expect(returnRuleLabel("mystery")).toBe("mystery");
  });
});
