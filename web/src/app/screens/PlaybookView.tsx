import {
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  Eye,
  EyeOff,
  ListFilter,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState } from "../../components/EmptyState";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "../../components/Item";
import { Page } from "../../components/Page";
import { Skeleton } from "../../components/Skeleton";
import { pnlColor } from "../../components/theme-tokens";
import { Button } from "../../components/ui/button";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select";
import type { BreakGroup, Setup } from "../../lib/api/types";
import { cn } from "../../lib/cn";
import { usePrivacyMode } from "../../lib/displayPrefs";
import { fmtPct, fmtSignedMoney } from "../../lib/format";
import { useMoneyFx } from "../../lib/hooks/useMoneyFx";
import { intlLocale } from "../../lib/locale";
import { useUI, type SetupDraft } from "../../lib/ui";

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

type SortKey = "name" | "pnl" | "winRate" | "trades";

interface SetupRowModel {
  setup: Setup;
  group: BreakGroup | undefined;
  trades: number;
  winRate: number;
  netPnl: number;
  pf: number;
  exp: number;
  hasData: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGroupForSetup(breakdown: BreakGroup[], setupName: string): BreakGroup | undefined {
  return breakdown.find((g) => g.key === setupName);
}

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
  return setups.map((setup) => {
    const group = getGroupForSetup(breakdown, setup.name);
    const sum = group?.summary;
    const trades = sum?.total_trades ?? 0;
    return {
      setup,
      group,
      trades,
      winRate: sum?.win_rate ?? 0,
      netPnl: sum?.net_pnl ?? 0,
      pf: sum?.profit_factor ?? 0,
      exp: sum?.expectancy ?? 0,
      hasData: trades > 0,
    };
  });
}

function sortRows(rows: SetupRowModel[], sort: SortKey): SetupRowModel[] {
  const next = [...rows];
  next.sort((a, b) => {
    switch (sort) {
      case "pnl":
        return b.netPnl - a.netPnl || a.setup.name.localeCompare(b.setup.name);
      case "winRate":
        return b.winRate - a.winRate || a.setup.name.localeCompare(b.setup.name);
      case "trades":
        return b.trades - a.trades || a.setup.name.localeCompare(b.setup.name);
      case "name":
      default:
        return a.setup.name.localeCompare(b.setup.name);
    }
  });
  return next;
}

// ---------------------------------------------------------------------------
// Setup item
// ---------------------------------------------------------------------------

interface SetupItemProps {
  row: SetupRowModel;
  currency: string;
  fxRate: number;
  onEdit: (setup: Setup) => void;
  onDelete: (setup: Setup) => void;
  onConvert: (setup: Setup) => void;
}

function SetupItem({ row, currency, fxRate, onEdit, onDelete, onConvert }: SetupItemProps) {
  usePrivacyMode();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { setup, trades, winRate, netPnl, pf, exp, hasData } = row;
  const thesis = setup.thesis || setup.description;
  const checklist = setup.checklist ?? [];
  const locale = intlLocale();
  const isShort = setup.direction === "short";
  const DirIcon = isShort ? ArrowDownRight : ArrowUpRight;

  const metaBits = [
    setup.target_price != null ? `T ${setup.target_price}` : null,
    setup.stop_price != null ? `S ${setup.stop_price}` : null,
    checklist.length > 0 ? `${checklist.length} check${checklist.length === 1 ? "" : "s"}` : null,
  ].filter(Boolean);

  return (
    <Item
      variant="default"
      size="default"
      className={cn(
        "w-full gap-3 border-transparent bg-bg-hover px-3.5 py-3",
        "hover:bg-bg-panel",
        !hasData && "opacity-75",
      )}
    >
      <ItemMedia
        variant="icon"
        aria-hidden
        className={cn(
          "size-9 self-center",
          hasData
            ? isShort
              ? "bg-tint-neg text-loss"
              : "bg-tint-pos text-profit"
            : "bg-bg-panel text-text-dim",
        )}
      >
        {setup.direction ? (
          <DirIcon size={16} strokeWidth={2} />
        ) : (
          <BookOpen size={16} strokeWidth={1.75} />
        )}
      </ItemMedia>

      <ItemContent className="gap-1.5">
        <ItemTitle className="gap-2 text-[15px]">
          <span className="font-semibold tracking-tight text-text">{setup.name}</span>
          {setup.symbol ? (
            <span className="text-[12px] font-medium tracking-wide text-accent">
              {setup.symbol}
              {setup.direction ? ` · ${setup.direction.toUpperCase()}` : ""}
            </span>
          ) : null}
        </ItemTitle>
        {thesis ? (
          <ItemDescription className="line-clamp-1 text-[13px]">{thesis}</ItemDescription>
        ) : metaBits.length > 0 ? (
          <ItemDescription className="text-[12px] text-text-dim">
            {metaBits.join(" · ")}
          </ItemDescription>
        ) : !hasData ? (
          <ItemDescription className="text-[12px] text-text-dim">
            No trades in this range
          </ItemDescription>
        ) : null}

        {hasData ? (
          <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
            <SetupMetric label="Trades" value={String(trades)} />
            <SetupMetric label="Win rate" value={fmtPct(winRate, locale)} />
            <SetupMetric
              label="Net P&L"
              value={fmtSignedMoney(netPnl * fxRate, currency, locale)}
              valueClass={pnlColor(netPnl)}
            />
            <SetupMetric label="Profit factor" value={pf > 0 ? pf.toFixed(2) : "—"} />
            <SetupMetric
              label="Expectancy"
              value={fmtSignedMoney(exp * fxRate, currency, locale)}
              valueClass={pnlColor(exp)}
            />
          </div>
        ) : null}
      </ItemContent>

      {hasData ? (
        <ItemContent className="hidden min-w-[7.5rem] flex-none items-end gap-0.5 self-center text-right sm:flex">
          <ItemTitle className={cn("text-[15px] font-semibold tabular-nums", pnlColor(netPnl))}>
            {fmtSignedMoney(netPnl * fxRate, currency, locale)}
          </ItemTitle>
          <ItemDescription className="text-[12px] tabular-nums">
            {trades} trade{trades === 1 ? "" : "s"} · {fmtPct(winRate, locale)} WR
          </ItemDescription>
        </ItemContent>
      ) : null}

      <ItemActions className="self-center">
        <Button
          type="button"
          variant="outline"
          size="xs"
          aria-label={`Log trade from ${setup.name}`}
          onClick={() => onConvert(setup)}
        >
          Trade
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Edit ${setup.name}`}
          onClick={() => onEdit(setup)}
          className="text-text-dim hover:text-accent"
        >
          <Pencil size={13} strokeWidth={1.5} />
        </Button>
        {confirmDelete ? (
          <span className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              aria-label="Confirm delete"
              onClick={() => {
                setConfirmDelete(false);
                onDelete(setup);
              }}
              className="text-loss hover:text-loss"
            >
              Delete
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              aria-label="Cancel delete"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </Button>
          </span>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`Delete ${setup.name}`}
            onClick={() => setConfirmDelete(true)}
            className="text-text-dim hover:text-loss"
          >
            <Trash2 size={13} strokeWidth={1.5} />
          </Button>
        )}
      </ItemActions>
    </Item>
  );
}

function SetupMetric({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[10px] font-medium tracking-[0.08em] text-text-dim uppercase">
        {label}
      </span>
      <span
        className={cn(
          "text-[13px] font-semibold tabular-nums",
          valueClass ?? "text-text",
          value === "—" && "font-medium text-text-dim",
        )}
      >
        {value}
      </span>
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
  const { currency: displayCurrency, rate } = useMoneyFx(currency);
  const fxRate = rate ?? 1;
  const openModal = useUI((s) => s.openModal);
  const openSetupEdit = useUI((s) => s.openSetupEdit);
  const openTradeFromSetup = useUI((s) => s.openTradeFromSetup);
  const [sort, setSort] = useState<SortKey>("name");
  const [hideUnused, setHideUnused] = useState(false);

  const rows = useMemo(() => {
    const built = buildRows(setups, breakdown);
    const filtered = hideUnused ? built.filter((r) => r.hasData) : built;
    return sortRows(filtered, sort);
  }, [setups, breakdown, hideUnused, sort]);

  const unusedCount = useMemo(
    () => buildRows(setups, breakdown).filter((r) => !r.hasData).length,
    [setups, breakdown],
  );

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

  const toolbarIconClass = cn(
    "size-8 pointer-coarse:size-11",
    "border-transparent !bg-transparent hover:!bg-bg-hover",
  );

  const toolbar = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      {setups.length > 0 ? (
        <span className="relative inline-flex items-center">
          <ListFilter
            size={14}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-2.5 z-10 text-text-dim"
            aria-hidden
          />
          <NativeSelect
            size="sm"
            aria-label="Sort setups"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className={cn(
              "min-w-[8.25rem] border-border !bg-transparent hover:border-border-strong hover:!bg-transparent",
              "h-8 pr-7 pl-8 text-[12px]",
            )}
          >
            <NativeSelectOption value="name">Name</NativeSelectOption>
            <NativeSelectOption value="pnl">Net P&L</NativeSelectOption>
            <NativeSelectOption value="winRate">Win rate</NativeSelectOption>
            <NativeSelectOption value="trades">Trades</NativeSelectOption>
          </NativeSelect>
        </span>
      ) : (
        <span />
      )}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {setups.length > 0 && unusedCount > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setHideUnused((v) => !v)}
            aria-pressed={hideUnused}
            aria-label={hideUnused ? "Show unused setups" : "Hide unused setups"}
            className={cn(
              toolbarIconClass,
              hideUnused && "!bg-accent-bg text-accent hover:!bg-accent-bg",
            )}
          >
            {hideUnused ? (
              <Eye size={14} strokeWidth={1.75} />
            ) : (
              <EyeOff size={14} strokeWidth={1.75} />
            )}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => openModal("new-setup")}
          aria-label="New setup"
          className={toolbarIconClass}
        >
          <Plus size={14} strokeWidth={1.75} />
        </Button>
      </div>
    </div>
  );

  const renderContent = () => {
    if (setupsLoading) {
      return (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height="88px" className="rounded-control" />
          ))}
        </div>
      );
    }

    if (setupsError) {
      return <p className="text-xs text-loss">Failed to load setups.</p>;
    }

    if (setups.length === 0) {
      return (
        <EmptyState
          title="No setups yet"
          hint="Define your edge — thesis, levels, and checklist — then log trades from each play."
          icon={<BookOpen size={32} strokeWidth={1.5} />}
          actions={
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => openModal("new-setup")}
            >
              <Plus size={13} strokeWidth={1.5} />
              New setup
            </Button>
          }
        />
      );
    }

    if (rows.length === 0) {
      return (
        <EmptyState
          title="No traded setups"
          hint="Every setup is still unused in this date range. Log a trade or show unused setups."
          actions={
            <Button type="button" variant="outline" size="sm" onClick={() => setHideUnused(false)}>
              Show unused
            </Button>
          }
        />
      );
    }

    return (
      <ItemGroup className="gap-2">
        {rows.map((row) => (
          <SetupItem
            key={row.setup.id}
            row={row}
            currency={displayCurrency}
            fxRate={fxRate}
            onEdit={(s) => openSetupEdit(toSetupDraft(s))}
            onConvert={convertSetup}
            onDelete={async (s) => {
              await onDelete(s.id);
            }}
          />
        ))}
      </ItemGroup>
    );
  };

  return (
    <Page>
      {toolbar}
      {renderContent()}
    </Page>
  );
}
