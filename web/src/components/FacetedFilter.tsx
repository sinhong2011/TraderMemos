import { Check, PlusCircle, XCircle } from "lucide-react";
import { useState, type MouseEvent } from "react";
import { cn } from "@/lib/cn";
import { buttonVariants } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

export type FacetedFilterOption = {
  value: string;
  label: string;
  /** Optional count badge on the right of the option row */
  count?: number;
};

/**
 * tablecn-style faceted filter — dashed outline trigger + option popover.
 * Single-select by default; set `multiple` for multi-value filters.
 */
export function FacetedFilter({
  title,
  options,
  value,
  onChange,
  multiple = false,
  className,
}: {
  title: string;
  options: readonly FacetedFilterOption[];
  value?: string | string[];
  onChange: (next: string | string[] | undefined) => void;
  multiple?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const selected = new Set(
    Array.isArray(value) ? value : value != null && value !== "" ? [value] : [],
  );
  const selectedOptions = options.filter((o) => selected.has(o.value));

  function selectOption(option: FacetedFilterOption, isSelected: boolean) {
    if (multiple) {
      const next = new Set(selected);
      if (isSelected) next.delete(option.value);
      else next.add(option.value);
      const values = Array.from(next);
      onChange(values.length ? values : undefined);
      return;
    }
    onChange(isSelected ? undefined : option.value);
    setOpen(false);
  }

  function clear(e?: MouseEvent) {
    e?.preventDefault();
    e?.stopPropagation();
    onChange(undefined);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "h-8 border-border !bg-transparent font-normal hover:!bg-transparent aria-expanded:!bg-transparent",
          className,
        )}
      >
        {selected.size > 0 ? (
          <span
            role="button"
            tabIndex={0}
            aria-label={`Clear ${title} filter`}
            onClick={clear}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onChange(undefined);
              }
            }}
            className="inline-flex text-muted-foreground transition-opacity hover:text-foreground"
          >
            <XCircle size={14} strokeWidth={1.75} />
          </span>
        ) : (
          <PlusCircle size={14} strokeWidth={1.75} className="text-muted-foreground" aria-hidden />
        )}
        <span>{title}</span>
        {selected.size > 0 ? (
          <>
            <span aria-hidden className="mx-0.5 h-4 w-px shrink-0 bg-border" />
            <span className="hidden items-center gap-1 lg:flex">
              {selected.size > 2 ? (
                <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                  {selected.size} selected
                </span>
              ) : (
                selectedOptions.map((o) => (
                  <span
                    key={o.value}
                    className="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                  >
                    {o.label}
                  </span>
                ))
              )}
            </span>
            <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground lg:hidden">
              {selected.size}
            </span>
          </>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[11.5rem] p-0">
        <div className="flex max-h-72 flex-col p-1" role="listbox" aria-label={title}>
          {options.map((option) => {
            const isSelected = selected.has(option.value);
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => selectOption(option, isSelected)}
                className={cn(
                  "flex min-h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-left text-[12px] text-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
                  isSelected && "bg-primary/10 text-primary hover:bg-primary/10",
                )}
              >
                <span
                  className={cn(
                    "flex size-3.5 shrink-0 items-center justify-center rounded-md border border-border",
                    isSelected && "border-primary bg-primary text-background",
                  )}
                >
                  {isSelected ? <Check size={10} strokeWidth={2.5} /> : null}
                </span>
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.count != null ? (
                  <span className="tabular-nums text-[10px] text-muted-foreground">
                    {option.count}
                  </span>
                ) : null}
              </button>
            );
          })}
          {selected.size > 0 ? (
            <>
              <div className="my-1 h-px bg-border" />
              <button
                type="button"
                onClick={() => clear()}
                className="flex min-h-8 cursor-pointer items-center justify-center rounded-md px-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
              >
                Clear filters
              </button>
            </>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
