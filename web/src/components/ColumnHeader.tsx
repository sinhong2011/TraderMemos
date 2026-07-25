import type { Column } from "@tanstack/react-table";
import { ChevronDown, ChevronsUpDown, ChevronUp, EyeOff, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/menu";

/**
 * tablecn-style column header — dropdown with Asc / Desc / Reset / Hide.
 */
export function ColumnHeader<TData, TValue>({
  column,
  title,
  titleAttr,
  className,
  alignRight = false,
  comfortable = false,
}: {
  column: Column<TData, TValue>;
  title: ReactNode;
  titleAttr?: string;
  className?: string;
  alignRight?: boolean;
  comfortable?: boolean;
}) {
  const canSort = column.getCanSort();
  const canHide = column.getCanHide();
  const sorted = column.getIsSorted();

  if (!canSort && !canHide) {
    return (
      <span
        title={titleAttr}
        className={cn("flex items-center gap-1", alignRight && "justify-end", className)}
      >
        {title}
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            title={titleAttr}
            className={cn(
              "h-auto w-full gap-1 rounded-md px-0 text-[length:inherit] font-medium",
              "hover:bg-transparent hover:text-foreground",
              "aria-expanded:bg-transparent data-popup-open:bg-transparent data-popup-open:text-foreground",
              comfortable ? "tracking-wide" : "tracking-widest",
              alignRight ? "justify-end" : "justify-start",
              className,
            )}
          />
        }
      >
        {title}
        {canSort ? (
          <span className="ml-0.5 text-muted-foreground">
            {sorted === "asc" ? (
              <ChevronUp size={12} strokeWidth={1.5} aria-hidden />
            ) : sorted === "desc" ? (
              <ChevronDown size={12} strokeWidth={1.5} aria-hidden />
            ) : (
              <ChevronsUpDown size={12} strokeWidth={1.5} aria-hidden />
            )}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={alignRight ? "end" : "start"} className="w-36">
        {canSort ? (
          <>
            <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
              <ChevronUp
                size={14}
                strokeWidth={1.75}
                className="text-muted-foreground"
                aria-hidden
              />
              Asc
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
              <ChevronDown
                size={14}
                strokeWidth={1.75}
                className="text-muted-foreground"
                aria-hidden
              />
              Desc
            </DropdownMenuItem>
            {sorted ? (
              <DropdownMenuItem onClick={() => column.clearSorting()}>
                <X size={14} strokeWidth={1.75} className="text-muted-foreground" aria-hidden />
                Reset
              </DropdownMenuItem>
            ) : null}
          </>
        ) : null}
        {canSort && canHide ? <DropdownMenuSeparator /> : null}
        {canHide ? (
          <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
            <EyeOff size={14} strokeWidth={1.75} className="text-muted-foreground" aria-hidden />
            Hide
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
