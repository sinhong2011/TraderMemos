import {
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  Eye,
  EyeOff,
  ListFilter,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Item, ItemActions, ItemGroup, ItemTitle } from "@/components/Item";
import { Page } from "@/components/Page";
import { Pill } from "@/components/Pill";
import { ListSkeleton } from "@/components/skeletons/list-skeleton";
import { pnlColor } from "@/components/theme-tokens";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { BreakGroup, Setup } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { usePrivacyMode } from "@/lib/displayPrefs";
import { fmtPct, fmtSignedMoney } from "@/lib/format";
import { useMoneyFx } from "@/lib/hooks/useMoneyFx";
import { intlLocale } from "@/lib/locale";
import { useUI, type SetupDraft } from "@/lib/ui";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlaybookViewProps {
  setups: Setup[];
  setupsLoading: boolean;
  setupsError: boolean;
  breakdown: BreakGroup[];
  breakdownLoading: boolean;
  currency: string;
  onDelete: (id: string) => Promise<void>;
}

type SortKey = "name" | "trades" | "winRate" | "pf" | "exp" | "pnl";
type SortDir = "asc" | "desc";

interface SetupRowModel {
  setup: Setup;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  netPnl: number;
  pf: number;
  exp: number;
  hasData: boolean;
}

/**
 * Shared grid template for the traded-plays header and its rows so metric
 * labels line up over their values. Below `xl` rows collapse to a stacked
 * card-ish layout with a compact meta line instead of columns.
 */
const PLAY_GRID = cn(
  "xl:grid xl:items-center xl:gap-x-4",
  "xl:grid-cols-[minmax(9rem,1fr)_5rem_5.5rem_6.75rem_6.5rem_7rem_7.5rem]",
);

const METRIC_COLUMNS: { key: SortKey; label: string }[] = [
  { key: "trades", label: "Trades" },
  { key: "winRate", label: "Win rate" },
  { key: "pf", label: "Profit factor" },
  { key: "exp", label: "Expectancy" },
  { key: "pnl", label: "Net P&L" },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  ...METRIC_COLUMNS,
];

/** Metric sorts read best high-to-low; names read A→Z. */
const DEFAULT_DIR: Record<SortKey, SortDir> = {
  name: "asc",
  trades: "desc",
  winRate: "desc",
  pf: "desc",
  exp: "desc",
  pnl: "desc",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toSetupDraft(setup: Setup): SetupDraft {
  return {
    id: setup.id,
    name: setup.name,
    thesis: setup.thesis || setup.description || "",
    symbol: setup.symbol || "",
    direction: setup.direction === "short" ? "short" : "long",
    target: setup.target_price != null ? String(setup.target_price) : "",
    stop: setup.stop_price != null ? String(setup.stop_price) : "",
    checklistText: (setup.checklist ?? []).join("\n"),
  };
}

function buildRows(setups: Setup[], breakdown: BreakGroup[]): SetupRowModel[] {
  const summaries = new Map(breakdown.map((g) => [g.key, g.summary]));
  return setups.map((setup) => {
    const sum = summaries.get(setup.name);
    const trades = sum?.total_trades ?? 0;
    return {
      setup,
      trades,
      wins: sum?.wins ?? 0,
      losses: sum?.losses ?? 0,
      winRate: sum?.win_rate ?? 0,
      netPnl: sum?.net_pnl ?? 0,
      pf: sum?.profit_factor ?? 0,
      exp: sum?.expectancy ?? 0,
      hasData: trades > 0,
    };
  });
}

const SORT_VALUE: Record<SortKey, (row: SetupRowModel) => number | string> = {
  name: (r) => r.setup.name.toLowerCase(),
  trades: (r) => r.trades,
  winRate: (r) => r.winRate,
  pf: (r) => r.pf,
  exp: (r) => r.exp,
  pnl: (r) => r.netPnl,
};

function sortRows(rows: SetupRowModel[], key: SortKey, dir: SortDir): SetupRowModel[] {
  const read = SORT_VALUE[key];
  return [...rows].sort((a, b) => {
    const av = read(a);
    const bv = read(b);
    const primary = typeof av === "string" ? av.localeCompare(bv as string) : av - (bv as number);
    if (primary !== 0) return dir === "asc" ? primary : -primary;
    return a.setup.name.localeCompare(b.setup.name);
  });
}

/** Levels and checklist size — the plan detail worth showing when space allows. */
function planBits(setup: Setup): string[] {
  const checks = setup.checklist ?? [];
  return [
    setup.target_price != null ? `T ${setup.target_price}` : null,
    setup.stop_price != null ? `S ${setup.stop_price}` : null,
    checks.length > 0 ? `${checks.length} check${checks.length === 1 ? "" : "s"}` : null,
  ].filter((bit): bit is string => bit != null);
}

function setupSubline(setup: Setup): string {
  return setup.thesis || setup.description || planBits(setup).join(" · ");
}

// ---------------------------------------------------------------------------
// Row pieces
// ---------------------------------------------------------------------------

function PlayIcon({
  setup,
  tone,
  /** Bare glyph for chips, where a tinted tile would out-shout the name. */
  chip = false,
}: {
  setup: Setup;
  tone: "pos" | "neg" | "muted";
  chip?: boolean;
}) {
  const Icon = setup.direction
    ? setup.direction === "short"
      ? ArrowDownRight
      : ArrowUpRight
    : BookOpen;

  if (chip) {
    return (
      <Icon
        size={13}
        strokeWidth={setup.direction ? 2 : 1.75}
        aria-hidden
        className="shrink-0 text-muted-foreground"
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-md",
        tone === "pos"
          ? "bg-profit/10 text-profit"
          : tone === "neg"
            ? "bg-destructive/10 text-destructive"
            : "bg-accent text-muted-foreground",
      )}
    >
      <Icon size={16} strokeWidth={setup.direction ? 2 : 1.75} />
    </span>
  );
}

function MetricCell({
  value,
  valueClass,
  /** 0–1 ratio rendered as a hairline bar under the value (win rate). */
  ratio,
  title,
}: {
  value: string;
  valueClass?: string;
  ratio?: number;
  title?: string;
}) {
  return (
    <div className="flex flex-col items-end gap-1" title={title}>
      <span
        className={cn(
          "text-[13px] font-semibold tabular-nums text-foreground",
          value === "—" && "font-medium text-muted-foreground",
          valueClass,
        )}
      >
        {value}
      </span>
      {/* Slot is reserved in every cell so values keep one baseline across columns. */}
      <span
        className={cn(
          "flex h-[3px] w-full overflow-hidden rounded-full",
          ratio != null && "bg-accent",
        )}
        aria-hidden
      >
        {ratio != null ? (
          <span
            className="h-full rounded-full bg-profit"
            style={{ width: `${Math.round(Math.min(Math.max(ratio, 0), 1) * 100)}%` }}
          />
        ) : null}
      </span>
    </div>
  );
}

interface RowActions {
  onEdit: (setup: Setup) => void;
  onDelete: (setup: Setup) => void;
  onConvert: (setup: Setup) => void;
}

interface SetupActionsProps extends RowActions {
  setup: Setup;
}

/**
 * Trade, edit and delete stay visible on every play. Delete swaps in a compact
 * ✓/✕ confirm in place so the cluster keeps its width. Renders bare buttons —
 * the caller supplies the container (`ItemActions` on chips, the grid's last
 * column on traded rows).
 */
function SetupActions({ setup, onEdit, onDelete, onConvert }: SetupActionsProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        aria-label={`Log trade from ${setup.name}`}
        onClick={() => onConvert(setup)}
        className="text-muted-foreground hover:text-foreground"
      >
        Trade
      </Button>
      {confirmDelete ? (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`Confirm delete ${setup.name}`}
            onClick={() => {
              setConfirmDelete(false);
              onDelete(setup);
            }}
            className="text-destructive hover:text-destructive"
          >
            <Check size={13} strokeWidth={2} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Cancel delete"
            onClick={() => setConfirmDelete(false)}
            className="text-muted-foreground"
          >
            <X size={13} strokeWidth={2} />
          </Button>
        </>
      ) : (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`Edit ${setup.name}`}
            onClick={() => onEdit(setup)}
            className="text-muted-foreground hover:text-primary"
          >
            <Pencil size={13} strokeWidth={1.5} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`Delete ${setup.name}`}
            onClick={() => setConfirmDelete(true)}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 size={13} strokeWidth={1.5} />
          </Button>
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

interface PlayRowProps extends RowActions {
  row: SetupRowModel;
  currency: string;
  fxRate: number;
}

function TradedPlayRow({ row, currency, fxRate, ...actions }: PlayRowProps) {
  const locale = intlLocale();
  const { setup, trades, wins, losses, winRate, netPnl, pf, exp } = row;
  const subline = setupSubline(setup);
  const money = (v: number) => fmtSignedMoney(v * fxRate, currency, locale);

  return (
    <div
      role="listitem"
      onClick={(e) => {
        // Whole-row click opens the editor; inner buttons keep their own actions.
        if ((e.target as HTMLElement).closest("button")) return;
        actions.onEdit(setup);
      }}
      className={cn(
        "group/play flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5",
        "transition-colors duration-100 hover:bg-accent motion-reduce:transition-none",
        PLAY_GRID,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <PlayIcon setup={setup} tone={netPnl < 0 ? "neg" : "pos"} />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => actions.onEdit(setup)}
              className={cn(
                "cursor-pointer truncate rounded-sm text-left text-[14px] font-semibold tracking-tight text-foreground",
                "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              )}
            >
              {setup.name}
            </button>
            {setup.symbol ? (
              <Pill tone="accent" className="px-1.5 py-0 text-[10px]">
                {setup.symbol}
                {setup.direction ? ` · ${setup.direction.toUpperCase()}` : ""}
              </Pill>
            ) : null}
          </div>
          {subline ? (
            <p className="mt-0.5 truncate text-[12px] leading-relaxed text-muted-foreground">
              {subline}
            </p>
          ) : null}
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[11px] tabular-nums whitespace-nowrap text-muted-foreground xl:hidden">
            <span>
              {trades} trade{trades === 1 ? "" : "s"}
            </span>
            <span aria-hidden>·</span>
            <span>{fmtPct(winRate, locale)} WR</span>
            <span aria-hidden>·</span>
            <span className={cn("font-semibold", pnlColor(netPnl))}>{money(netPnl)}</span>
          </p>
        </div>
      </div>

      <div className="hidden xl:contents">
        <MetricCell value={String(trades)} />
        <MetricCell
          value={fmtPct(winRate, locale)}
          ratio={winRate}
          title={`${wins} win${wins === 1 ? "" : "s"} · ${losses} loss${losses === 1 ? "" : "es"}`}
        />
        <MetricCell value={pf > 0 ? pf.toFixed(2) : "—"} />
        <MetricCell value={money(exp)} valueClass={pnlColor(exp)} />
        <MetricCell value={money(netPnl)} valueClass={cn("text-[14px]", pnlColor(netPnl))} />
      </div>

      <ItemActions className="gap-0.5 xl:justify-end">
        <SetupActions setup={setup} {...actions} />
      </ItemActions>
    </div>
  );
}

/**
 * Idle plays are chips sized to their own name rather than cells in a stretched
 * grid: name and actions stay adjacent, so nothing floats in a column of gutter.
 * `ItemContent` is deliberately skipped — its `flex-1` is what would stretch the
 * name away from the buttons. Detail (thesis, levels, checklist) lives in the
 * editor these chips open.
 */
function UnusedPlayChip({ row, ...actions }: { row: SetupRowModel } & RowActions) {
  const { setup } = row;

  return (
    <Item
      variant="muted"
      size="sm"
      onClick={(e) => {
        // Chip surface opens the editor; the trade/edit/delete buttons stay their own targets.
        if ((e.target as HTMLElement).closest("button")) return;
        actions.onEdit(setup);
      }}
      className="w-fit cursor-pointer gap-2 py-1 pr-1 pl-2.5 hover:bg-accent"
      title={setupSubline(setup) || undefined}
    >
      <PlayIcon setup={setup} tone="muted" chip />
      <ItemTitle className="gap-1.5 text-[13px] tracking-tight">
        <span className="max-w-[14rem] truncate">{setup.name}</span>
        {setup.symbol ? (
          <span className="shrink-0 text-[11px] tracking-wide text-primary">{setup.symbol}</span>
        ) : null}
      </ItemTitle>
      <ItemActions className="gap-0.5">
        <SetupActions setup={setup} {...actions} />
      </ItemActions>
    </Item>
  );
}

// ---------------------------------------------------------------------------
// Header pieces
// ---------------------------------------------------------------------------

function ColumnSortButton({
  label,
  sortKey,
  active,
  dir,
  onSort,
  align = "end",
}: {
  label: string;
  sortKey: SortKey;
  active: boolean;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  align?: "start" | "end";
}) {
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      aria-label={`Sort by ${label}`}
      className={cn(
        "group/col flex cursor-pointer items-center gap-1 rounded-sm outline-none",
        align === "start" ? "justify-self-start" : "justify-end",
        "text-[10px] font-medium tracking-[0.08em] uppercase",
        "transition-colors duration-150 hover:text-foreground motion-reduce:transition-none",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        active ? "text-foreground" : "text-muted-foreground",
      )}
    >
      {label}
      {active ? (
        dir === "asc" ? (
          <ChevronUp size={11} strokeWidth={2} aria-hidden />
        ) : (
          <ChevronDown size={11} strokeWidth={2} aria-hidden />
        )
      ) : (
        <ChevronsUpDown
          size={11}
          strokeWidth={2}
          aria-hidden
          className="opacity-0 transition-opacity group-hover/col:opacity-60"
        />
      )}
    </button>
  );
}

function SummaryStat({
  label,
  value,
  valueClass,
  sub,
}: {
  label: string;
  value: string;
  valueClass?: string;
  sub?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[10px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </span>
      <span
        className={cn(
          "truncate text-[17px] leading-none font-semibold tracking-tight tabular-nums text-foreground",
          valueClass,
        )}
      >
        {value}
      </span>
      {sub ? <span className="truncate text-[11px] text-muted-foreground">{sub}</span> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function PlaybookView({
  setups,
  setupsLoading,
  setupsError,
  breakdown,
  currency,
  onDelete,
}: PlaybookViewProps) {
  usePrivacyMode();
  const locale = intlLocale();
  const { currency: displayCurrency, rate } = useMoneyFx(currency);
  const fxRate = rate ?? 1;
  const openModal = useUI((s) => s.openModal);
  const openSetupEdit = useUI((s) => s.openSetupEdit);
  const openTradeFromSetup = useUI((s) => s.openTradeFromSetup);
  const [sort, setSort] = useState<SortKey>("name");
  const [dir, setDir] = useState<SortDir>("asc");
  const [hideUnused, setHideUnused] = useState(false);

  const rows = useMemo(() => buildRows(setups, breakdown), [setups, breakdown]);
  const traded = useMemo(
    () =>
      sortRows(
        rows.filter((r) => r.hasData),
        sort,
        dir,
      ),
    [rows, sort, dir],
  );
  const unused = useMemo(
    () =>
      sortRows(
        rows.filter((r) => !r.hasData),
        "name",
        "asc",
      ),
    [rows],
  );

  const totals = useMemo(() => {
    const trades = traded.reduce((n, r) => n + r.trades, 0);
    const wins = traded.reduce((n, r) => n + r.wins, 0);
    const netPnl = traded.reduce((n, r) => n + r.netPnl, 0);
    const best = traded.reduce<SetupRowModel | null>(
      (top, r) => (top == null || r.netPnl > top.netPnl ? r : top),
      null,
    );
    return { trades, wins, netPnl, winRate: trades > 0 ? wins / trades : 0, best };
  }, [traded]);

  function sortBy(key: SortKey) {
    if (key === sort) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSort(key);
    setDir(DEFAULT_DIR[key]);
  }

  function convertSetup(setup: Setup) {
    openTradeFromSetup({
      setupId: setup.id,
      symbol: setup.symbol || undefined,
      side: setup.direction === "short" ? "short" : setup.direction === "long" ? "long" : undefined,
      target: setup.target_price != null ? String(setup.target_price) : undefined,
      stop: setup.stop_price != null ? String(setup.stop_price) : undefined,
      notes: setup.thesis || setup.description || undefined,
    });
  }

  const rowActions = {
    onEdit: (s: Setup) => openSetupEdit(toSetupDraft(s)),
    onConvert: convertSetup,
    onDelete: async (s: Setup) => {
      await onDelete(s.id);
    },
  };

  const subtitle = () => {
    if (setups.length === 0) return "Define your plays once, then log trades straight from them.";
    const plays = `${setups.length} play${setups.length === 1 ? "" : "s"}`;
    if (traded.length === 0) return `${plays} · none traded in this range`;
    return `${plays} · ${traded.length} traded in this range`;
  };

  const header = (
    <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight text-foreground">Playbook</h2>
        <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{subtitle()}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {traded.length > 0 ? (
          <span className="relative inline-flex items-center xl:hidden">
            <ListFilter
              size={14}
              strokeWidth={1.75}
              className="pointer-events-none absolute left-2.5 z-10 text-muted-foreground"
              aria-hidden
            />
            <NativeSelect
              size="sm"
              aria-label="Sort plays"
              value={sort}
              onChange={(e) => {
                const key = e.target.value as SortKey;
                setSort(key);
                setDir(DEFAULT_DIR[key]);
              }}
              className="h-8 min-w-[8.25rem] pr-7 pl-8 text-[12px]"
            >
              {SORT_OPTIONS.map((opt) => (
                <NativeSelectOption key={opt.key} value={opt.key}>
                  {opt.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </span>
        ) : null}
        {unused.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setHideUnused((v) => !v)}
            aria-pressed={hideUnused}
            className={cn(
              "text-muted-foreground hover:text-foreground",
              hideUnused && "text-foreground",
            )}
          >
            {hideUnused ? (
              <Eye size={14} strokeWidth={1.75} />
            ) : (
              <EyeOff size={14} strokeWidth={1.75} />
            )}
            {hideUnused ? "Show unused" : "Hide unused"}
            <span className="tabular-nums opacity-70">{unused.length}</span>
          </Button>
        ) : null}
        <Button type="button" onClick={() => openModal("new-setup")}>
          <Plus size={14} strokeWidth={1.75} />
          New setup
        </Button>
      </div>
    </header>
  );

  const summaryCard = (
    <Card>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
        <SummaryStat
          label="Plays traded"
          value={`${traded.length}/${setups.length}`}
          sub={unused.length > 0 ? `${unused.length} idle` : "All plays in use"}
        />
        <SummaryStat label="Trades" value={String(totals.trades)} />
        <SummaryStat
          label="Win rate"
          value={fmtPct(totals.winRate, locale)}
          sub={`${totals.wins} of ${totals.trades} won`}
        />
        <SummaryStat
          label="Net"
          value={fmtSignedMoney(totals.netPnl * fxRate, currency, locale)}
          valueClass={pnlColor(totals.netPnl)}
        />
        {totals.best ? (
          <SummaryStat
            label="Top play"
            value={totals.best.setup.name}
            valueClass="tracking-tight"
            sub={fmtSignedMoney(totals.best.netPnl * fxRate, currency, locale)}
          />
        ) : null}
      </div>
    </Card>
  );

  const tradedCard = (
    <Card flush className="pt-3 pb-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4">
        <h3 className="text-xs font-medium text-muted-foreground">Traded in this range</h3>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {traded.length} play{traded.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className={cn("hidden px-4 pt-3 pb-1", PLAY_GRID)}>
        {/* Offset by the row icon (size-9 + gap-3) so the label sits over the names. */}
        <span className="pl-12">
          <ColumnSortButton
            label="Play"
            sortKey="name"
            active={sort === "name"}
            dir={dir}
            onSort={sortBy}
            align="start"
          />
        </span>
        {METRIC_COLUMNS.map((col) => (
          <ColumnSortButton
            key={col.key}
            label={col.label}
            sortKey={col.key}
            active={sort === col.key}
            dir={dir}
            onSort={sortBy}
          />
        ))}
        <span />
      </div>

      <ItemGroup className="mt-1 gap-0.5 px-2">
        {traded.map((row) => (
          <TradedPlayRow
            key={row.setup.id}
            row={row}
            currency={displayCurrency}
            fxRate={fxRate}
            {...rowActions}
          />
        ))}
      </ItemGroup>
    </Card>
  );

  const unusedCard = (
    <Card flush className="pt-3 pb-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4">
        <h3 className="text-xs font-medium text-muted-foreground">Not traded in this range</h3>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {unused.length} play{unused.length === 1 ? "" : "s"}
        </span>
      </div>
      <ItemGroup className="mt-3 flex-row flex-wrap gap-2 px-4">
        {unused.map((row) => (
          <UnusedPlayChip key={row.setup.id} row={row} {...rowActions} />
        ))}
      </ItemGroup>
    </Card>
  );

  const renderContent = () => {
    if (setupsLoading) return <ListSkeleton rows={4} />;

    if (setupsError) {
      return <EmptyState title="Could not load setups" hint="Try refreshing the page." />;
    }

    if (setups.length === 0) {
      return (
        <EmptyState
          title="No setups yet"
          hint="Define your edge — thesis, levels, and checklist — then log trades from each play."
          icon={<BookOpen size={28} strokeWidth={1.5} />}
          actions={
            <Button type="button" onClick={() => openModal("new-setup")}>
              <Plus size={14} strokeWidth={1.75} />
              New setup
            </Button>
          }
        />
      );
    }

    if (traded.length === 0 && hideUnused) {
      return (
        <EmptyState
          title="No traded plays"
          hint="Every play is still unused in this date range. Log a trade or show unused plays."
          icon={<BookOpen size={28} strokeWidth={1.5} />}
          actions={
            <Button type="button" variant="outline" onClick={() => setHideUnused(false)}>
              Show unused
            </Button>
          }
        />
      );
    }

    return (
      <>
        {traded.length > 0 ? summaryCard : null}
        {traded.length > 0 ? tradedCard : null}
        {unused.length > 0 && !hideUnused ? unusedCard : null}
      </>
    );
  };

  return (
    <Page>
      {header}
      {renderContent()}
    </Page>
  );
}
