import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { pageItems, pageRangeLabel } from "@/lib/pagination";
import { Button } from "./ui/button";
import { NativeSelect, NativeSelectOption } from "./ui/native-select";

const DEFAULT_PAGE_SIZES = [10, 20, 30, 40, 50, 100] as const;

export interface PaginationProps {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: readonly number[];
  className?: string;
  /** Keep the footer visible even when everything fits on one page. */
  alwaysShow?: boolean;
}

function NavButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="text-muted-foreground disabled:opacity-35"
    >
      {children}
    </Button>
  );
}

function PageButton({
  page,
  active,
  onClick,
}: {
  page: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={active ? "soft" : "ghost"}
      size="icon"
      aria-label={`Page ${page}`}
      aria-current={active ? "page" : undefined}
      tooltip={false}
      onClick={onClick}
      className={cn("min-w-8 text-[11px] tabular-nums", active && "ring-1 ring-primary/25")}
    >
      {page}
    </Button>
  );
}

/**
 * Compact shadcn pagination — range label, page pills, optional page-size.
 * Borderless footer chrome; accent active page.
 */
export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  className,
  alwaysShow = false,
}: PaginationProps) {
  if (total <= 0) return null;
  if (!alwaysShow && pageCount <= 1 && !onPageSizeChange) return null;

  const items = pageItems(page, Math.max(pageCount, 1));
  const canPrev = page > 1;
  const canNext = page < pageCount;
  const showPager = pageCount > 1;

  return (
    <nav
      aria-label="Pagination"
      className={cn("flex flex-wrap items-center justify-between gap-3 px-4 py-2.5", className)}
    >
      <p className="text-[11px] tabular-nums text-muted-foreground">
        <span className="text-muted-foreground">Showing </span>
        {pageRangeLabel(page, pageSize, total)}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {onPageSizeChange ? (
          <div className="flex items-center gap-1.5">
            <span className="hidden text-[10px] font-medium uppercase tracking-widest text-muted-foreground sm:inline">
              Rows
            </span>
            <NativeSelect
              variant="ghost"
              size="sm"
              aria-label="Rows per page"
              value={String(pageSize)}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 w-[4.25rem] px-2 pr-6 text-center text-[11px] tabular-nums"
            >
              {pageSizeOptions.map((n) => (
                <NativeSelectOption key={n} value={String(n)}>
                  {n}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        ) : null}

        {showPager ? (
          <div className="flex items-center gap-0.5 rounded-md bg-muted/60 p-0.5">
            <NavButton
              label="Previous page"
              disabled={!canPrev}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft size={14} strokeWidth={1.75} />
            </NavButton>

            <ul className="flex items-center gap-0.5">
              {items.map((item, i) =>
                item === "ellipsis" ? (
                  <li key={`e-${i}`} className="flex h-8 w-7 items-center justify-center">
                    <MoreHorizontal
                      size={14}
                      strokeWidth={1.5}
                      className="text-muted-foreground"
                      aria-hidden
                    />
                    <span className="sr-only">More pages</span>
                  </li>
                ) : (
                  <li key={item}>
                    <PageButton
                      page={item}
                      active={item === page}
                      onClick={() => onPageChange(item)}
                    />
                  </li>
                ),
              )}
            </ul>

            <NavButton label="Next page" disabled={!canNext} onClick={() => onPageChange(page + 1)}>
              <ChevronRight size={14} strokeWidth={1.75} />
            </NavButton>
          </div>
        ) : null}
      </div>
    </nav>
  );
}
