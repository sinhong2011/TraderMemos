import type { ReactNode } from "react";
import { Skeleton } from "@/components/Skeleton";
import { cn } from "@/lib/cn";

/** Borderless elevated block — About-page section surface. */
export function AboutCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-xl bg-card", className)}>{children}</div>;
}

/** Compact stat: uppercase label on top, prominent value, optional subline. */
export function StatTile({
  label,
  value,
  sub,
  tone = "default",
  loading,
}: {
  label: string;
  value?: ReactNode;
  sub?: ReactNode;
  tone?: "default" | "warn" | "destructive";
  loading?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg bg-sidebar/60 px-4 py-3.5">
      <p className="m-0 text-2xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      {loading ? (
        <Skeleton height="20px" width="4.5rem" className="mt-1.5" />
      ) : (
        <p
          className={cn(
            "m-0 mt-1 truncate text-[17px] font-semibold tabular-nums tracking-tight",
            tone === "warn"
              ? "text-chart-3"
              : tone === "destructive"
                ? "text-destructive"
                : "text-foreground",
          )}
        >
          {value}
        </p>
      )}
      {sub ? <p className="m-0 mt-0.5 truncate text-[11px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}
