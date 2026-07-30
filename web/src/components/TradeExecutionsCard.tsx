import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { Card } from "./Card";
import { DataTable } from "./DataTable";
import { Item, ItemContent, ItemGroup } from "./Item";
import { Pill } from "./Pill";
import { outlineSurfaceClass } from "./surface-styles";
import type { Execution, TradeDetail } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { usePrivacyMode } from "@/lib/displayPrefs";
import { fmtDate, fmtMoney, fmtTime } from "@/lib/format";
import { COMPACT_VIEWPORT, useMediaQuery } from "@/lib/hooks/use-mobile";
import { intlLocale } from "@/lib/locale";

/** Same calendar day → a row only needs a clock time, not a full date. */
function sameDay(a: string, b: string): boolean {
  return a.slice(0, 10) === b.slice(0, 10);
}

function fmtQty(qty: number): string {
  return qty.toFixed(qty % 1 === 0 ? 0 : 2);
}

/** A fill plus the position it left behind. */
interface FillRow {
  fill: Execution;
  position: number;
}

/** Position held after each fill, signed by the trade's own direction. */
function fillRows(fills: readonly Execution[], direction: string): FillRow[] {
  const longTrade = direction === "long";
  let pos = 0;
  return fills.map((fill) => {
    const opening = longTrade ? fill.side === "buy" : fill.side === "sell";
    pos += opening ? fill.quantity : -fill.quantity;
    return { fill, position: pos };
  });
}

/**
 * How the position was actually built and taken off.
 *
 * Runs on the shared `DataTable` rather than a bespoke list, so it inherits the
 * trade log's chrome — bordered container, hairline header and row rules, the
 * `bg-accent` row hover, right-aligned numerics — instead of inventing a second
 * table style for one card. The running position column is the part the log
 * can't show: three adds before the exit reads as averaging down.
 */
export function TradeExecutionsCard({ trade }: { trade: TradeDetail }) {
  usePrivacyMode();
  const locale = intlLocale();
  const currency = trade.pnl_currency;
  // Same split the trade log uses: phone gets Item rows, wider gets the table.
  const compact = useMediaQuery(COMPACT_VIEWPORT);

  const fills = useMemo(
    () => [...trade.fills].sort((a, b) => a.executed_at.localeCompare(b.executed_at)),
    [trade.fills],
  );
  const rows = useMemo(() => fillRows(fills, trade.direction), [fills, trade.direction]);
  const singleDay =
    fills.length > 0 && fills.every((f) => sameDay(f.executed_at, fills[0]!.executed_at));
  const totalFees = fills.reduce((sum, f) => sum + f.fees + f.commission, 0);
  // Running position only tells a story on a scaled trade — on a plain in-and-out
  // it prints the size then zero, which nobody needs a column for.
  const scaled = fills.length > 2;

  const columns = useMemo<ColumnDef<FillRow>[]>(() => {
    const defs: ColumnDef<FillRow>[] = [
      {
        id: "side",
        header: "Side",
        cell: ({ row }) => (
          <Pill tone={row.original.fill.side === "buy" ? "pos" : "neg"}>
            {row.original.fill.side === "buy" ? "BUY" : "SELL"}
          </Pill>
        ),
        meta: { minWidth: 72 },
      },
      {
        id: "qty",
        header: "Qty",
        cell: ({ row }) => fmtQty(row.original.fill.quantity),
        meta: { align: "right", minWidth: 64 },
      },
      {
        id: "price",
        header: "Price",
        cell: ({ row }) => fmtMoney(row.original.fill.price, currency, locale),
        meta: { align: "right", headerTitle: "Fill price", minWidth: 80 },
      },
      {
        id: "value",
        header: "Value",
        cell: ({ row }) => {
          const f = row.original.fill;
          return fmtMoney(f.quantity * f.price * (f.multiplier || 1), currency, locale);
        },
        meta: {
          align: "right",
          headerTitle: "Qty × price × contract multiplier",
          minWidth: 96,
        },
      },
      {
        id: "fees",
        header: "Fees",
        cell: ({ row }) => {
          const fee = row.original.fill.fees + row.original.fill.commission;
          return fee > 0 ? (
            fmtMoney(fee, currency, locale)
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
        meta: { align: "right", minWidth: 80 },
      },
    ];

    if (scaled) {
      defs.push({
        id: "position",
        header: "Pos",
        cell: ({ row }) => fmtQty(row.original.position),
        meta: { align: "right", headerTitle: "Position held after this fill", minWidth: 64 },
      });
    }

    defs.push({
      id: "time",
      header: singleDay ? "Time" : "Executed",
      cell: ({ row }) =>
        singleDay
          ? fmtTime(row.original.fill.executed_at)
          : `${fmtDate(row.original.fill.executed_at, locale)} ${fmtTime(row.original.fill.executed_at)}`,
      meta: { align: "right", minWidth: singleDay ? 88 : 152 },
    });

    return defs;
  }, [currency, locale, scaled, singleDay]);

  return (
    <Card
      title={`Executions (${fills.length})`}
      action={
        fills.length > 0 ? (
          <p className="m-0 text-[12px] tabular-nums text-muted-foreground">
            {totalFees > 0 ? `${fmtMoney(totalFees, currency, locale)} fees` : null}
            {totalFees > 0 && singleDay && fills[0] ? " · " : null}
            {singleDay && fills[0] ? fmtDate(fills[0].executed_at, locale) : null}
          </p>
        ) : undefined
      }
    >
      {fills.length === 0 ? (
        <p className="m-0 text-[13px] text-muted-foreground">No fills recorded.</p>
      ) : compact ? (
        <ItemGroup className="gap-2">
          {rows.map(({ fill, position }) => {
            const fee = fill.fees + fill.commission;
            return (
              <Item
                key={fill.id}
                variant="outline"
                size="sm"
                className={cn("items-stretch gap-2 rounded-lg", outlineSurfaceClass)}
              >
                <ItemContent className="gap-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <Pill tone={fill.side === "buy" ? "pos" : "neg"}>
                        {fill.side === "buy" ? "BUY" : "SELL"}
                      </Pill>
                      <span className="text-[15px] font-semibold tabular-nums text-foreground">
                        {fmtQty(fill.quantity)} @ {fmtMoney(fill.price, currency, locale)}
                      </span>
                    </span>
                    <span className="shrink-0 text-[13px] tabular-nums whitespace-nowrap text-muted-foreground">
                      {singleDay
                        ? fmtTime(fill.executed_at)
                        : `${fmtDate(fill.executed_at, locale)} ${fmtTime(fill.executed_at)}`}
                    </span>
                  </div>
                  <p className="m-0 text-[12px] tabular-nums text-muted-foreground">
                    {fmtMoney(
                      fill.quantity * fill.price * (fill.multiplier || 1),
                      currency,
                      locale,
                    )}
                    {fee > 0 ? ` · ${fmtMoney(fee, currency, locale)} fee` : ""}
                    {scaled ? ` · ${fmtQty(position)} held` : ""}
                  </p>
                </ItemContent>
              </Item>
            );
          })}
        </ItemGroup>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <DataTable
            columns={columns}
            data={rows}
            lined
            headerClassName="bg-card"
            maxHeight={320}
          />
        </div>
      )}
    </Card>
  );
}
