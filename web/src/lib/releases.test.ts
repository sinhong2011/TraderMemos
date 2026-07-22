import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  compareSemver,
  fetchLatestRelease,
  isNewerVersion,
  normalizeVersion,
  releaseExcerpt,
} from "./releases";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("compareSemver", () => {
  it("orders dotted versions", () => {
    expect(compareSemver("0.1.0", "0.1.0")).toBe(0);
    expect(compareSemver("0.1.0", "0.2.0")).toBeLessThan(0);
    expect(compareSemver("v0.2.0", "0.1.9")).toBeGreaterThan(0);
    expect(isNewerVersion("0.2.0", "0.1.0")).toBe(true);
    expect(isNewerVersion("0.1.0", "0.1.0")).toBe(false);
  });

  it("normalizes leading v", () => {
    expect(normalizeVersion("v1.2.3")).toBe("1.2.3");
  });
});

describe("releaseExcerpt", () => {
  it("strips markdown and truncates", () => {
    const body = "## Highlights\n\n- **Fix** something\n\n```go\nfmt.Println()\n```";
    const excerpt = releaseExcerpt(body, 40);
    expect(excerpt).not.toContain("```");
    expect(excerpt.length).toBeLessThanOrEqual(41);
  });
});

describe("fetchLatestRelease", () => {
  it("parses GitHub latest release payload", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          tag_name: "v0.2.0",
          name: "TraderMemos 0.2.0",
          body: "Bug fixes and polish.",
          html_url: "https://example.com/r",
          published_at: "2026-07-01T12:00:00Z",
          prerelease: false,
        }),
        { status: 200 },
      ),
    );
    await expect(fetchLatestRelease()).resolves.toEqual({
      version: "0.2.0",
      tag: "v0.2.0",
      name: "TraderMemos 0.2.0",
      body: "Bug fixes and polish.",
      excerpt: "Bug fixes and polish.",
      publishedAt: "2026-07-01T12:00:00Z",
      url: "https://example.com/r",
      prerelease: false,
    });
  });

  it("returns null when no releases exist", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 404 }));
    await expect(fetchLatestRelease()).resolves.toBeNull();
  });
});
