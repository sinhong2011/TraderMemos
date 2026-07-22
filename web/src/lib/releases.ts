import { REPO_URL } from "./version";

export type GitHubRelease = {
  version: string;
  tag: string;
  name: string;
  body: string;
  excerpt: string;
  publishedAt: string;
  url: string;
  prerelease: boolean;
};

/** Compare dotted versions (e.g. `0.1.0` vs `v0.2.0`). Returns negative if a < b. */
export function compareSemver(a: string, b: string): number {
  const parse = (v: string) =>
    v
      .trim()
      .replace(/^v/i, "")
      .split(/[.+-]/)
      .map((part) => {
        const n = Number.parseInt(part, 10);
        return Number.isFinite(n) ? n : 0;
      });
  const aa = parse(a);
  const bb = parse(b);
  const len = Math.max(aa.length, bb.length);
  for (let i = 0; i < len; i++) {
    const d = (aa[i] ?? 0) - (bb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, "");
}

export function isNewerVersion(candidate: string, current: string): boolean {
  return compareSemver(candidate, current) > 0;
}

export function releaseExcerpt(body: string, max = 320): string {
  const plain = body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_[\]`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return "";
  if (plain.length <= max) return plain;
  return `${plain.slice(0, max).trimEnd()}…`;
}

function githubReleasesUrl(): string {
  const match = REPO_URL.match(/github\.com\/([^/]+)\/([^/]+)/i);
  if (!match) return "";
  return `https://api.github.com/repos/${match[1]}/${match[2]}/releases/latest`;
}

export async function fetchLatestRelease(): Promise<GitHubRelease | null> {
  const url = githubReleasesUrl();
  if (!url) return null;
  const res = await fetch(url, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Release check failed (${res.status})`);
  }
  const body = (await res.json()) as {
    tag_name?: string;
    name?: string;
    body?: string;
    html_url?: string;
    published_at?: string;
    prerelease?: boolean;
  };
  const tag = body.tag_name?.trim();
  if (!tag) return null;
  const notes = body.body?.trim() ?? "";
  return {
    version: normalizeVersion(tag),
    tag,
    name: body.name?.trim() || tag,
    body: notes,
    excerpt: releaseExcerpt(notes),
    publishedAt: body.published_at ?? "",
    url: body.html_url || `${REPO_URL}/releases`,
    prerelease: Boolean(body.prerelease),
  };
}
