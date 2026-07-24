import { cn } from "../../../lib/cn";

export type TradeTicketRow = {
  label: string;
  value: string;
  tone?: "profit" | "loss";
};

export function TradeTicket({
  heroLabel,
  heroValue,
  heroUnit,
  rows,
}: {
  heroLabel: string;
  heroValue: string;
  heroUnit?: string;
  rows: TradeTicketRow[];
}) {
  return (
    <div className="rounded-lg bg-card p-4">
      <div className="mb-4">
        <p className="m-0 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {heroLabel}
        </p>
        <p className="m-0 mt-1 text-[28px] font-semibold leading-none tracking-tight tabular-nums text-foreground">
          {heroValue}
          {heroUnit ? (
            <span className="ml-1.5 text-[14px] font-medium text-muted-foreground">{heroUnit}</span>
          ) : null}
        </p>
      </div>
      <dl className="grid gap-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-2">
            <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {row.label}
            </dt>
            <dd
              className={cn(
                "m-0 text-xs font-semibold tabular-nums",
                row.tone === "profit" && "text-profit",
                row.tone === "loss" && "text-destructive",
                !row.tone && "text-foreground",
              )}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
