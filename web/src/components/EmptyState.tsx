import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "./ui/empty";

interface EmptyStateProps {
  title: string;
  hint?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function EmptyState({ title, hint, icon, actions, className }: EmptyStateProps) {
  return (
    <Empty className={cn("border-none p-8 py-16", className)}>
      <EmptyHeader className="gap-1.5">
        {icon && <EmptyMedia variant="icon">{icon}</EmptyMedia>}
        <EmptyTitle>{title}</EmptyTitle>
        {hint && <EmptyDescription>{hint}</EmptyDescription>}
      </EmptyHeader>
      {actions ? (
        <EmptyContent>
          <div className="flex flex-wrap items-center justify-center gap-2">{actions}</div>
        </EmptyContent>
      ) : null}
    </Empty>
  );
}
