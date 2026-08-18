import { Link } from "@tanstack/react-router";
import { History, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { ReplayHeartbeat } from "@/components/charts/ReplayHeartbeat";
import { TradeChart } from "@/components/charts/TradeChart";
import { formatReplayBarTime } from "@/components/charts/replayPnl";
import { useBacktestReplay } from "@/components/charts/useBacktestReplay";
import { REPLAY_SPEEDS, type ReplaySpeed } from "@/components/charts/useReplayController";
import { BAR_INTERVALS } from "@/components/charts/tradeChartTheme";
import { Card } from "@/components/Card";
import { DatePicker } from "@/components/DatePicker";
import { EmptyState } from "@/components/EmptyState";
import { fieldInputClass } from "@/components/field-styles";
import { Page } from "@/components/Page";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Button } from "@/components/ui/button";
import type { BarInterval } from "@/lib/api/market";
import { cn } from "@/lib/cn";
import { localDateString } from "@/lib/dateRangePresets";
import { fmtSignedMoney } from "@/lib/format";
import { useAccounts, useCreateAccount } from "@/lib/hooks/useAccounts";
import { useCreateExecutions } from "@/lib/hooks/useExecutions";
import { snapChartTime, useMarketBars } from "@/lib/hooks/useMarketBars";
import { intlLocale } from "@/lib/locale";

const SYMBOL_RE = /^[A-Z0-9./-]{1,15}$/;
const BACKTEST_CURRENCY = "USD";

export interface ReplayViewProps {
  symbol: string;
  interval: BarInterval;
  from?: string;
  to?: string;
  onSetupChange: (next: { symbol?: string; iv?: BarInterval; from?: string; to?: string }) => void;
}

interface SessionSpec {
  symbol: string;
  interval: BarInterval;
  /** YYYY-MM-DD inclusive day range. */
  from: string;
  to: string;
}

function defaultFrom(): string {
  return localDateString(new Date(Date.now() - 60 * 86_400_000));
}

/** Bar replay backtester: pick a window, step blind, trade the closes. */
export function ReplayView({ symbol, interval, from, to, onSetupChange }: ReplayViewProps) {
  const [session, setSession] = useState<SessionSpec | null>(null);

  return (
    <Page>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[20px] font-bold tracking-[-0.02em] text-foreground">Replay</h1>
          {session && (
            <Button variant="ghost" onClick={() => setSession(null)}>
              End session
            </Button>
          )}
        </div>
        {session ? (
          <ReplaySession spec={session} onExit={() => setSession(null)} />
        ) : (
          <SetupCard
            symbol={symbol}
            interval={interval}
            from={from ?? defaultFrom()}
            to={to ?? localDateString(new Date())}
            onStart={(spec) => {
              onSetupChange({
                symbol: spec.symbol,
                iv: spec.interval,
                from: spec.from,
                to: spec.to,
              });
              setSession(spec);
            }}
          />
        )}
      </div>
    </Page>
  );
}

function SetupCard({
  symbol,
  interval,
  from,
  to,
  onStart,
}: {
  symbol: string;
  interval: BarInterval;
  from: string;
  to: string;
  onStart: (spec: SessionSpec) => void;
}) {
  const [input, setInput] = useState(symbol);
  const [iv, setIv] = useState<BarInterval>(interval);
  const [fromDay, setFromDay] = useState(from);
  const [toDay, setToDay] = useState(to);

  const sym = input.trim().toUpperCase();
  const valid = SYMBOL_RE.test(sym) && fromDay <= toDay;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    onStart({ symbol: sym, interval: iv, from: fromDay, to: toDay });
  }

  return (
    <Card
      title="Session"
      description="Replay any symbol bar by bar — the chart reveals nothing ahead of you. Orders fill at the current bar's close and save into a separate backtest account that stays out of your real stats."
    >
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Symbol
            <input
              className={`${fieldInputClass} w-36 uppercase`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="AAPL"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            From
            <DatePicker aria-label="Replay start day" value={fromDay} onChange={setFromDay} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            To
            <DatePicker aria-label="Replay end day" value={toDay} onChange={setToDay} />
          </label>
          <div className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Interval
            <SegmentedControl
              ariaLabel="Bar interval"
              size="sm"
              value={iv}
              onChange={(v) => setIv(v as BarInterval)}
              options={BAR_INTERVALS}
            />
          </div>
          <Button type="submit" disabled={!valid}>
            Start replay
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Intraday history is limited by the data provider — minute bars reach back roughly a month,
          hourly about two. Daily bars replay any year.
        </p>
      </form>
    </Card>
  );
}

function ReplaySession({ spec, onExit }: { spec: SessionSpec; onExit: () => void }) {
  const range = useMemo(
    () => ({
      from: snapChartTime(`${spec.from}T00:00:00.000Z`),
      to: snapChartTime(`${spec.to}T23:59:00.000Z`),
    }),
    [spec],
  );
  const barsQ = useMarketBars({
    symbol: spec.symbol,
    instrument_type: "stock",
    from: range.from,
    to: range.to,
    interval: spec.interval,
  });
  const bars = barsQ.data?.bars;
  const replay = useBacktestReplay(bars, spec.interval);
  const [qty, setQty] = useState("100");
  const quantity = Number.parseFloat(qty);
  const canOrder = replay.atFrontier && Number.isFinite(quantity) && quantity > 0;

  if (!barsQ.isLoading && (!bars || bars.length < 2)) {
    return (
      <EmptyState
        title={barsQ.isError ? "Chart data unavailable" : "No bars for this window"}
        hint={
          barsQ.isError
            ? "The market data request failed — check the symbol and try again."
            : "The provider returned no data — try a coarser interval or a more recent range."
        }
        icon={<History aria-hidden />}
        actions={
          <Button variant="soft" onClick={onExit}>
            Change setup
          </Button>
        }
      />
    );
  }

  const bar = bars?.[replay.cursor];
  const timeLabel = bar ? formatReplayBarTime(bar.time, spec.interval, intlLocale()) : "";

  return (
    <>
      <Card
        title={`${spec.symbol} · ${BAR_INTERVALS.find((i) => i.value === spec.interval)?.label}`}
        description={`Bar ${replay.cursor + 1} of ${bars?.length ?? 0} · ${timeLabel}`}
      >
        <div className="flex flex-col gap-3">
          <TradeChart
            symbol={spec.symbol}
            bars={bars}
            fills={replay.fills}
            loading={barsQ.isLoading}
            error={barsQ.isError}
            interval={spec.interval}
            height={420}
            hideHeaderLabel
            replayUpTo={replay.cutoff}
          />
          {/* The session's heartbeat: running net P&L up to the cursor. Only
              once a fill exists — before the first order it is a flat zero. */}
          {bars && replay.fills.length > 0 && (
            <ReplayHeartbeat
              fills={replay.fills}
              bars={bars}
              interval={spec.interval}
              cursor={replay.cursor}
            />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Step back"
                onClick={replay.stepBack}
              >
                <SkipBack size={14} strokeWidth={1.5} aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={replay.playing ? "Pause" : "Play"}
                onClick={replay.toggle}
              >
                {replay.playing ? (
                  <Pause size={14} strokeWidth={1.5} aria-hidden />
                ) : (
                  <Play size={14} strokeWidth={1.5} aria-hidden />
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Step forward"
                onClick={replay.stepForward}
                disabled={replay.atEnd}
              >
                <SkipForward size={14} strokeWidth={1.5} aria-hidden />
              </Button>
            </div>
            <SegmentedControl
              ariaLabel="Replay speed"
              size="xs"
              value={replay.speed}
              onChange={(v) => replay.setSpeed(v as ReplaySpeed)}
              options={REPLAY_SPEEDS}
            />
            {!replay.atFrontier && (
              <Button type="button" variant="ghost" size="sm" onClick={replay.seekToFrontier}>
                Back to live bar
              </Button>
            )}
            <ReplayReadout replay={replay} />
          </div>
        </div>
      </Card>

      <Card title="Order entry" description="Orders fill at the current bar's close.">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Quantity
              <input
                className={`${fieldInputClass} w-28`}
                inputMode="decimal"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </label>
            <Button
              type="button"
              disabled={!canOrder}
              onClick={() => replay.placeOrder("buy", quantity)}
            >
              Buy
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!canOrder}
              onClick={() => replay.placeOrder("sell", quantity)}
            >
              Sell
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!replay.atFrontier || !replay.pnl || replay.pnl.position === 0}
              onClick={replay.closePosition}
            >
              Close position
            </Button>
          </div>
          {!replay.atFrontier && (
            <p className="text-xs text-muted-foreground">
              You're reviewing an earlier bar — orders fill only at the live bar.
            </p>
          )}
          {replay.fills.length > 0 && <FillsList replay={replay} interval={spec.interval} />}
        </div>
      </Card>

      <SaveCard replay={replay} spec={spec} />
    </>
  );
}

function ReplayReadout({ replay }: { replay: ReturnType<typeof useBacktestReplay> }) {
  const pnl = replay.pnl;
  const net = pnl?.net ?? 0;
  return (
    <div className="ml-auto flex items-center gap-3 text-xs tabular-nums">
      {pnl && (
        <>
          <span className="text-muted-foreground">
            {pnl.position > 0
              ? `Long ${pnl.position}`
              : pnl.position < 0
                ? `Short ${Math.abs(pnl.position)}`
                : "Flat"}
          </span>
          <span
            className={cn(
              "font-medium",
              net > 0 ? "text-profit" : net < 0 ? "text-loss" : "text-muted-foreground",
            )}
          >
            {fmtSignedMoney(net, BACKTEST_CURRENCY, intlLocale())}
          </span>
        </>
      )}
    </div>
  );
}

function FillsList({
  replay,
  interval,
}: {
  replay: ReturnType<typeof useBacktestReplay>;
  interval: BarInterval;
}) {
  return (
    <ul className="flex flex-col text-xs tabular-nums">
      {replay.fills.map((f) => (
        <li
          key={`${f.executed_at}-${f.side}`}
          className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent"
        >
          <span className={cn("w-8 font-medium", f.side === "buy" ? "text-profit" : "text-loss")}>
            {f.side === "buy" ? "Buy" : "Sell"}
          </span>
          <span className="w-16 text-right">{f.quantity}</span>
          <span className="w-20 text-right">
            @{" "}
            {f.price.toLocaleString(intlLocale(), {
              minimumFractionDigits: 2,
              maximumFractionDigits: 4,
            })}
          </span>
          <span className="ml-auto text-muted-foreground">
            {formatReplayBarTime(
              Math.floor(new Date(f.executed_at).getTime() / 1000),
              interval,
              intlLocale(),
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

function SaveCard({
  replay,
  spec,
}: {
  replay: ReturnType<typeof useBacktestReplay>;
  spec: SessionSpec;
}) {
  const accounts = useAccounts();
  const createAccount = useCreateAccount();
  const createExecutions = useCreateExecutions();
  const [saved, setSaved] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saving = createAccount.isPending || createExecutions.isPending;

  async function save() {
    setError(null);
    try {
      const existing = accounts.data?.find((a) => a.account_type === "backtest");
      const account =
        existing ??
        (await createAccount.mutateAsync({
          name: "Backtest",
          broker: "",
          account_type: "backtest",
          base_currency: BACKTEST_CURRENCY,
          starting_balance: 0,
        }));
      const rows = [...replay.fills]
        .sort((a, b) => a.executed_at.localeCompare(b.executed_at))
        .map((f) => ({
          symbol: spec.symbol,
          instrument_type: "stock",
          side: f.side === "buy" ? ("buy" as const) : ("sell" as const),
          quantity: f.quantity,
          price: f.price,
          fees: 0,
          executed_at: f.executed_at,
          multiplier: 1,
        }));
      const res = await createExecutions.mutateAsync({ accountIds: [account.id], rows });
      setSaved(res.tradeIds);
      replay.reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the session.");
    }
  }

  if (saved) {
    return (
      <Card title="Saved">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted-foreground">
            The session is in your Backtest account — select it in the account switcher to see its
            analytics.
          </span>
          {saved.map((id) => (
            <Link
              key={id}
              to="/trades/$id"
              params={{ id }}
              className="font-medium text-primary hover:underline"
            >
              View trade →
            </Link>
          ))}
          <Button variant="soft" size="sm" onClick={() => setSaved(null)}>
            Keep replaying
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="Save session"
      description="Writes the fills into your Backtest paper account. Backtest trades never mix into your real stats — select the account explicitly to analyze them."
    >
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={replay.fills.length === 0 || saving}
          onClick={() => void save()}
        >
          {saving
            ? "Saving…"
            : replay.fills.length === 0
              ? "Save session"
              : replay.fills.length === 1
                ? "Save 1 fill"
                : `Save ${replay.fills.length} fills`}
        </Button>
        {replay.pnl && replay.pnl.position !== 0 && (
          <span className="text-xs text-muted-foreground">
            Your position is still open — it will be saved as an open trade unless you close it
            first.
          </span>
        )}
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    </Card>
  );
}
