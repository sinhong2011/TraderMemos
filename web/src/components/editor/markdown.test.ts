import { describe, expect, it } from "vite-plus/test";
import { isEditorEmpty, noteExcerpt } from "./markdown";

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
