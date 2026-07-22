import { describe, expect, it } from "vite-plus/test";
import { buildStructuredJournalNotes, parseJournalNotes } from "./journalNotes";
import { gradeFromInt, intFromGrade } from "./tradeGrades";

describe("tradeGrades", () => {
  it("maps letter grades to 1–5", () => {
    expect(intFromGrade("A+")).toBe(5);
    expect(intFromGrade("C")).toBe(1);
    expect(gradeFromInt(4)).toBe("A");
    expect(gradeFromInt(null)).toBe("");
  });
});

describe("journalNotes", () => {
  it("round-trips structured sections", () => {
    const raw = buildStructuredJournalNotes({
      session: "New York AM",
      entryReason: "delta flip at VWAP",
      exitReason: "scaled at +45",
      reviewNotes: "clean A+",
    });
    expect(raw).toContain("## Session");
    const parsed = parseJournalNotes(raw);
    expect(parsed.session).toBe("New York AM");
    expect(parsed.entryReason).toBe("delta flip at VWAP");
    expect(parsed.exitReason).toBe("scaled at +45");
    expect(parsed.reviewNotes).toBe("clean A+");
  });

  it("keeps legacy freeform notes", () => {
    const parsed = parseJournalNotes("just a scribbled note");
    expect(parsed.legacy).toBe("just a scribbled note");
    expect(parsed.entryReason).toBe("");
  });
});
