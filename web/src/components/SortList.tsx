import type { OnChangeFn, SortingState } from "@tanstack/react-table";
import { ArrowDownUp, Trash2 } from "lucide-react";
import { useState } from "react";
import { cn } from "../lib/cn";
import { SignalSelect } from "./SignalSelect";
import { Button, buttonVariants } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

export type SortColumnOption = {
  id: string;
  label: string;
};

/**
 * tablecn-style Sort control — outline trigger + multi-sort popover.
 */
export function SortList({
  sorting,
  onSortingChange,
  columns,
  className,
}: {
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  columns: readonly SortColumnOption[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const usedIds = new Set(sorting.map((s) => s.id));
  const available = columns.filter((c) => !usedIds.has(c.id));
  const labelById = new Map(columns.map((c) => [c.id, c.label]));

  function addSort() {
    const first = available[0];
    if (!first) return;
    onSortingChange((prev) => [...prev, { id: first.id, desc: false }]);
  }

  function updateSort(sortId: string, updates: { id?: string; desc?: boolean }) {
    onSortingChange((prev) => prev.map((s) => (s.id === sortId ? { ...s, ...updates } : s)));
  }

  function removeSort(sortId: string) {
    onSortingChange((prev) => prev.filter((s) => s.id !== sortId));
  }

  function reset() {
    onSortingChange([]);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "h-8 !bg-transparent hover:!bg-transparent aria-expanded:!bg-transparent",
          className,
        )}
        aria-label="Sort"
      >
        <ArrowDownUp size={14} strokeWidth={1.75} />
        Sort
        {sorting.length > 0 ? (
          <span className="rounded-control bg-bg-hover px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-text-muted">
            {sorting.length}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[22rem] max-w-[calc(100vw-2rem)] p-0 shadow-[0_16px_40px_rgba(18,18,24,0.65)]"
      >
        <div className="flex flex-col gap-3 p-3">
          <div>
            <p className="m-0 text-[12px] font-medium text-text">
              {sorting.length > 0 ? "Sort by" : "No sorting applied"}
            </p>
            <p className="m-0 mt-0.5 text-[11px] text-text-dim">
              {sorting.length > 0
                ? "Modify sorting to organize your rows."
                : "Add sorting to organize your rows."}
            </p>
          </div>

          {sorting.length > 0 ? (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {sorting.map((sort) => {
                const columnOptions = [
                  { value: sort.id, label: labelById.get(sort.id) ?? sort.id },
                  ...available.map((c) => ({ value: c.id, label: c.label })),
                ];
                return (
                  <li key={sort.id} className="flex items-center gap-1.5">
                    <SignalSelect
                      value={sort.id}
                      onValueChange={(id) => updateSort(sort.id, { id })}
                      options={columnOptions}
                      ariaLabel="Sort column"
                      className="min-w-0 flex-1"
                      triggerClassName="h-8"
                    />
                    <SignalSelect
                      value={sort.desc ? "desc" : "asc"}
                      onValueChange={(dir) => updateSort(sort.id, { desc: dir === "desc" })}
                      options={[
                        { value: "asc", label: "Asc" },
                        { value: "desc", label: "Desc" },
                      ]}
                      ariaLabel="Sort direction"
                      className="w-[5.5rem] shrink-0"
                      triggerClassName="h-8"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${labelById.get(sort.id) ?? sort.id} sort`}
                      onClick={() => removeSort(sort.id)}
                      className="shrink-0 text-text-dim hover:text-text"
                    >
                      <Trash2 size={14} strokeWidth={1.75} />
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addSort}
              disabled={available.length === 0}
              className="h-8"
            >
              Add sort
            </Button>
            {sorting.length > 0 ? (
              <Button type="button" variant="outline" size="sm" onClick={reset} className="h-8">
                Reset sorting
              </Button>
            ) : null}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
