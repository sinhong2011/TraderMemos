import { describe, expect, it } from "vite-plus/test";
import { validateReportsSearch } from "./reports";

describe("validateReportsSearch", () => {
  it("passes through a valid tab", () => {
    expect(validateReportsSearch({ tab: "detailed" })).toEqual({
      tab: "detailed",
      side: "all",
      dur: "all",
    });
  });

  it("defaults to overview when tab is missing", () => {
    expect(validateReportsSearch({})).toEqual({ tab: "overview", side: "all", dur: "all" });
  });

  it("coerces an unknown tab to overview", () => {
    expect(validateReportsSearch({ tab: "bogus" })).toEqual({
      tab: "overview",
      side: "all",
      dur: "all",
    });
  });

  it("defaults side and dur to all", () => {
    expect(validateReportsSearch({})).toEqual({ tab: "overview", side: "all", dur: "all" });
  });

  it("passes through valid side and dur and coerces unknowns", () => {
    expect(validateReportsSearch({ side: "long", dur: "swing" })).toEqual({
      tab: "overview",
      side: "long",
      dur: "swing",
    });
    expect(validateReportsSearch({ side: "bogus", dur: "nope" })).toEqual({
      tab: "overview",
      side: "all",
      dur: "all",
    });
  });
});
