import { describe, expect, it } from "vite-plus/test";
import { resolveToastVariant, toastRootClass } from "./toast-styles";

describe("resolveToastVariant", () => {
  it("respects explicit type", () => {
    expect(resolveToastVariant("error", "Saved")).toBe("error");
    expect(resolveToastVariant("success", "Failed")).toBe("success");
  });

  it("infers success and error from title", () => {
    expect(resolveToastVariant(undefined, "Journal saved")).toBe("success");
    expect(resolveToastVariant(undefined, "Could not save journal")).toBe("error");
    expect(resolveToastVariant(undefined, "Import finished with errors")).toBe("warning");
  });
});

describe("toastRootClass", () => {
  it("uses panel surface without stripe tint", () => {
    const cls = toastRootClass("success");
    expect(cls).toContain("rounded-lg");
    expect(cls).toContain("bg-card");
    expect(cls).not.toContain("border-l-[3px]");
    expect(cls).toContain("shadow-md");
  });
});
