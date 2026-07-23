import { describe, expect, it } from "vite-plus/test";
import { mediaSrc, parseMediaId } from "./media";

describe("media refs", () => {
  it("builds and parses tm-media ids", () => {
    const id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    expect(mediaSrc(id)).toBe(`tm-media:${id}`);
    expect(parseMediaId(mediaSrc(id))).toBe(id);
  });

  it("ignores non-media srcs", () => {
    expect(parseMediaId("data:image/png;base64,abc")).toBeNull();
    expect(parseMediaId("https://example.com/x.png")).toBeNull();
    expect(parseMediaId("")).toBeNull();
  });
});
