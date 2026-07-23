/** Flatten note body (markdown or HTML) for list excerpts. */
export function noteExcerpt(body: string, max = 140): string {
  const plain = body
    .replace(/<img\b[^>]*>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[*_~]+/g, "")
    .replace(/^\s*[-*+]\s+(?:\[[ xX]\]\s+)?/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= max) return plain;
  return `${plain.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

export function isEditorEmpty(markdownOrHtml: string): boolean {
  return noteExcerpt(markdownOrHtml, Number.MAX_SAFE_INTEGER).length === 0;
}
