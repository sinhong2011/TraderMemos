import { useMemo } from "react";
import type { ColumnDef } from "@/lib/table";
import { cn } from "@/lib/cn";
import { resolveDisplayTimezone, useDisplayPrefs, wallClockToIso } from "@/lib/displayPrefs";
import { intlLocale } from "@/lib/locale";
import { DataTable } from "./DataTable";

type Row = Record<string, string>;

const FIELD_LABELS: Record<string, string> = {
  executed_at: "Executed at",
  symbol: "Symbol",
  side: "Side",
  quantity: "Qty",
  price: "Price",
  fees: "Fees",
  commission: "Commission",
  instrument_type: "Market",
  option_right: "Option right",
  open_time: "Open time",
  open_price: "Open price",
  close_time: "Close time",
  close_price: "Close price",
  swap: "Swap",
};

const TIME_FIELDS = new Set(["executed_at", "open_time", "close_time"]);
const NUMBER_FIELDS = new Set([
  "quantity",
  "price",
  "fees",
  "commission",
  "open_price",
  "close_price",
  "swap",
]);

// `2026-10-01 10:08:13`, `2026-10-01T10:08` — the shape the browser can place
// in a zone. Slash dates depend on the date-order choice; the server reads
// those, so they get no read-back here rather than a wrong one.
const ISO_WALL = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/;
const HAS_OFFSET = /(?:Z|[+-]\d{2}:?\d{2})$/;

/** The instant a file time becomes when its offset-less digits are read in `sourceTz`. */
function readInstant(raw: string, sourceTz: string): Date | null {
  const v = raw.trim();
  const m = ISO_WALL.exec(v);
  if (!m) return null;
  if (HAS_OFFSET.test(v)) {
    // "Times that carry their own offset are unaffected" — same here.
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const iso = wallClockToIso(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] ?? "00"}`, sourceTz);
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function HeaderStack({ title, source, dim }: { title: string; source: string; dim?: boolean }) {
  return (
    <span className={cn("flex flex-col gap-0.5 normal-case", dim && "opacity-60")}>
      <span className="text-[11px] font-semibold tracking-normal text-foreground">{title}</span>
      <span className="text-[10px] font-normal tracking-normal text-muted-foreground">
        {source}
      </span>
    </span>
  );
}

interface ImportSampleTableProps {
  headers: string[];
  rows: Row[];
  /** Field → CSV header (or `=constant` a broker preset pinned). */
  mapping: Record<string, string>;
  /** Mapping fields in display order. */
  fields: readonly string[];
  /** Zone the file's offset-less times are read in — the "Timestamps timezone" choice. */
  sourceTz: string;
  totalRows?: number;
}

/**
 * The CSV's first rows as they will import: one column per mapped field
 * (headed by the field, with the file column it reads underneath), the file
 * columns nothing reads dimmed at the end, and each time shown as the moment
 * it becomes under the chosen timezone. That read-back is the point — a
 * generic CSV read as UTC instead of Eastern looks fine as raw text and lands
 * every fill four or five hours off.
 */
export function ImportSampleTable({
  headers,
  rows,
  mapping,
  fields,
  sourceTz,
  totalRows,
}: ImportSampleTableProps) {
  // Subscribed rather than read at call time: the compiler memoises on what
  // it can see, and a store read inside a formatter isn't that.
  const displayTz = resolveDisplayTimezone(useDisplayPrefs((s) => s.timezone));
  const hour12 = useDisplayPrefs((s) => s.timeFormat) !== "h23";

  const columns = useMemo<ColumnDef<Row>[]>(() => {
    const fmt = new Intl.DateTimeFormat(intlLocale(), {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12,
      timeZone: displayTz,
      timeZoneName: "short",
    });

    // Time first, the way a fill blotter reads; the rest keep mapping order.
    const ordered = [
      ...fields.filter((f) => TIME_FIELDS.has(f)),
      ...fields.filter((f) => !TIME_FIELDS.has(f)),
    ];
    const mapped: ColumnDef<Row>[] = ordered
      .filter((field) => mapping[field])
      .map((field) => {
        const src = mapping[field]!;
        const constant = src.startsWith("=") ? src.slice(1) : null;
        const numeric = NUMBER_FIELDS.has(field);
        return {
          id: field,
          accessorFn: (row) => (constant ?? row[src] ?? "").trim(),
          header: () => (
            <HeaderStack
              title={FIELD_LABELS[field] ?? field.replace(/_/g, " ")}
              source={constant ? `always “${constant}”` : src}
            />
          ),
          enableSorting: false,
          meta: numeric ? { align: "right" } : undefined,
          cell: (info) => {
            const value = info.getValue<string>();
            if (!value) return <span className="text-muted-foreground">-</span>;
            if (TIME_FIELDS.has(field)) {
              const at = readInstant(value, sourceTz);
              return (
                <span className="flex flex-col whitespace-nowrap">
                  <span className="text-foreground">{value}</span>
                  {at ? (
                    <span className="text-[11px] text-muted-foreground">→ {fmt.format(at)}</span>
                  ) : null}
                </span>
              );
            }
            return (
              <span className={cn("text-foreground", numeric && "tabular-nums")}>{value}</span>
            );
          },
        };
      });

    const used = new Set(Object.values(mapping).filter(Boolean));
    const unused: ColumnDef<Row>[] = headers
      .filter((h) => !used.has(h))
      .map((h) => ({
        id: `unmapped:${h}`,
        accessorFn: (row) => row[h] ?? "",
        header: () => <HeaderStack title={h} source="not imported" dim />,
        enableSorting: false,
        cell: (info) => (
          <span className="text-muted-foreground/70">{info.getValue<string>() || "-"}</span>
        ),
      }));

    return [...mapped, ...unused];
  }, [fields, mapping, headers, sourceTz, displayTz, hour12]);

  return (
    <div className="flex flex-col">
      <DataTable columns={columns} data={rows} maxHeight="min(60vh, 520px)" />
      {totalRows != null && totalRows > rows.length ? (
        <p className="m-0 px-4 py-2.5 text-[11px] text-muted-foreground">
          Showing the first {rows.length} of {totalRows} rows.
        </p>
      ) : null}
    </div>
  );
}
