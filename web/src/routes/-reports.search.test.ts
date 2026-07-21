import { describe, expect, it } from "vite-plus/test";
import { validateReportsSearch } from "./reports";

describe("validateReportsSearch", () => {
  it("passes through a valid tab", () => {
    expect(validateReportsSearch({ tab: "detailed" })).toEqual({ tab: "detailed" });
  });

  it("defaults to overview when tab is missing", () => {
    expect(validateReportsSearch({})).toEqual({ tab: "overview" });
  });

  it("coerces an unknown tab to overview", () => {
    expect(validateReportsSearch({ tab: "bogus" })).toEqual({ tab: "overview" });
  });
});
