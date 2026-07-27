import { Card } from "@/components/Card";
import { cn } from "@/lib/cn";

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
    <Card title={heroLabel}>
      <p className="m-0 text-[32px] font-semibold leading-none tracking-tight tabular-nums text-foreground">
        {heroValue}
        {heroUnit ? (
          <span className="ml-1.5 text-base font-medium text-muted-foreground">{heroUnit}</span>
        ) : null}
      </p>
      <dl className="mt-5 grid gap-2.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3">
            <dt className="text-[13px] text-muted-foreground">{row.label}</dt>
            <dd
              className={cn(
                "m-0 text-[13px] font-medium tabular-nums",
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
    </Card>
  );
}
