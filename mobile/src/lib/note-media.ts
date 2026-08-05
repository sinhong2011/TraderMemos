/**
 * Images inside a note body.
 *
 * A note's body is the same markdown the web editor round-trips, and an image
 * lives in it as a reference to an uploaded `/media` row rather than a URL:
 * `![alt](tm-media:<id>)`. The indirection is what makes the reference survive
 * a server move — the note stores the id, the client resolves it against
 * whatever base URL the session is signed in to. Keep this in step with
 * `web/src/lib/api/media.ts`, which defines the same prefix for TipTap.
 */
export const MEDIA_SRC_PREFIX = 'tm-media:';

export function mediaSrc(id: string): string {
  return `${MEDIA_SRC_PREFIX}${id}`;
}

export function parseMediaId(src: string | null | undefined): string | null {
  if (!src?.startsWith(MEDIA_SRC_PREFIX)) return null;
  return src.slice(MEDIA_SRC_PREFIX.length).trim() || null;
}

// Notes written on the web before the markdown switch round-trip as HTML, so
// both spellings have to be recognised — same reason `noteExcerpt` matches both.
const MARKDOWN_IMAGE = /!\[[^\]]*\]\(\s*tm-media:([A-Za-z0-9._-]+)\s*\)/g;
const HTML_IMAGE = /<img\b[^>]*\bsrc=["']tm-media:([A-Za-z0-9._-]+)["'][^>]*>/gi;

/** Every media id referenced by the body, in the order it appears, deduped. */
export function noteMediaIds(body: string): string[] {
  const ids: string[] = [];
  for (const pattern of [MARKDOWN_IMAGE, HTML_IMAGE]) {
    // Fresh lastIndex per call — these are module-level /g regexes.
    pattern.lastIndex = 0;
    let match = pattern.exec(body);
    while (match) {
      if (match[1] && !ids.includes(match[1])) ids.push(match[1]);
      match = pattern.exec(body);
    }
  }
  return ids;
}

/**
 * Appends an image at the end of the body. Deliberately not "at the cursor":
 * the body is a plain text field here, and splicing markdown into the middle of
 * a sentence you are still typing is worse than a predictable place to find it.
 */
export function appendNoteImage(body: string, id: string, alt = ''): string {
  const image = `![${alt}](${mediaSrc(id)})`;
  if (!body.trim()) return image;
  return `${body.replace(/\s+$/, '')}\n\n${image}`;
}

/** Drops every reference to `id`, then collapses the blank lines it left. */
export function removeNoteImage(body: string, id: string): string {
  const escaped = id.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
  return body
    .replace(new RegExp(`!\\[[^\\]]*\\]\\(\\s*tm-media:${escaped}\\s*\\)`, 'g'), '')
    .replace(new RegExp(`<img\\b[^>]*\\bsrc=["']tm-media:${escaped}["'][^>]*>`, 'gi'), '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
