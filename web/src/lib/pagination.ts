/** Build a compact page list with ellipsis gaps (1 … 4 5 6 … 20). */
export function pageItems(
  page: number,
  pageCount: number,
  siblingCount = 1,
): Array<number | "ellipsis"> {
  if (pageCount <= 0) return [];
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }

  const current = Math.min(Math.max(1, page), pageCount);
  const left = Math.max(2, current - siblingCount);
  const right = Math.min(pageCount - 1, current + siblingCount);

  const items: Array<number | "ellipsis"> = [1];
  if (left > 2) items.push("ellipsis");
  for (let i = left; i <= right; i++) items.push(i);
  if (right < pageCount - 1) items.push("ellipsis");
  items.push(pageCount);
  return items;
}

export function clampPage(page: number, pageCount: number): number {
  if (pageCount <= 0) return 1;
  return Math.min(Math.max(1, page), pageCount);
}

export function pageCountFor(total: number, pageSize: number): number {
  if (total <= 0 || pageSize <= 0) return 0;
  return Math.ceil(total / pageSize);
}

export function slicePage<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (Math.max(1, page) - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function pageRangeLabel(page: number, pageSize: number, total: number): string {
  if (total <= 0) return "0 of 0";
  const start = (Math.max(1, page) - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return `${start}–${end} of ${total}`;
}
