import { describe, expect, it } from "vite-plus/test";
import { checklistProgress, isEditorEmpty, noteExcerpt } from "./markdown";

describe("noteExcerpt", () => {
  it("strips markdown noise for list previews", () => {
    expect(noteExcerpt("## Session\n\nClean **break** of highs\n- [x] Plan")).toContain(
      "Clean break of highs",
    );
  });

  it("strips html image tags", () => {
    expect(
      noteExcerpt('<p>Hello</p><img src="data:image/png;base64,abc" alt="x" /><p>World</p>'),
    ).toBe("Hello World");
  });
});

describe("isEditorEmpty", () => {
  it("treats empty paragraph html as empty", () => {
    expect(isEditorEmpty("<p></p>")).toBe(true);
    expect(isEditorEmpty("<p>hi</p>")).toBe(false);
  });
});

describe("checklistProgress", () => {
  it("counts markdown task items", () => {
    expect(checklistProgress("- [x] Plan\n- [ ] Journal\n- [X] Review")).toEqual({
      done: 2,
      total: 3,
    });
  });

  it("counts legacy tiptap html task items", () => {
    expect(
      checklistProgress('<ul><li data-checked="true">a</li><li data-checked="false">b</li></ul>'),
    ).toEqual({ done: 1, total: 2 });
  });

  it("returns null without a checklist", () => {
    expect(checklistProgress("- plain bullet\n\nsome text")).toBeNull();
  });
});
