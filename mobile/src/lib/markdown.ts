/**
 * Note-body helpers ported verbatim from web/src/components/editor/markdown.ts
 * — keep the two in sync. Bodies are markdown on mobile, but older notes
 * round-trip TipTap HTML, so both syntaxes are handled.
 */

/** Flatten note body (markdown or HTML) for list excerpts. */
export function noteExcerpt(body: string, max = 140): string {
  const plain = body
    .replace(/<img\b[^>]*>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/[*_~]+/g, '')
    .replace(/^\s*[-*+]\s+(?:\[[ xX]\]\s+)?/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= max) return plain;
  return `${plain.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

export function isEditorEmpty(markdownOrHtml: string): boolean {
  return noteExcerpt(markdownOrHtml, Number.MAX_SAFE_INTEGER).length === 0;
}

/** Checked / total task items in a note body, or `null` when it has no checklist. */
export function checklistProgress(body: string): { done: number; total: number } | null {
  const markdown = body.match(/^\s*[-*+]\s+\[[ xX]\]/gm) ?? [];
  // TipTap task lists round-trip as HTML in older notes.
  const html = body.match(/<li[^>]*\bdata-checked="(?:true|false)"/gi) ?? [];
  const total = markdown.length + html.length;
  if (total === 0) return null;
  const done =
    markdown.filter((m) => /\[[xX]\]/.test(m)).length +
    html.filter((m) => /"true"/i.test(m)).length;
  return { done, total };
}
