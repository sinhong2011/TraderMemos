import { useEffect, useMemo, useState } from "react";
import type { BarInterval } from "@/lib/api/market";
import type { TradeDetail } from "@/lib/api/types";
import {
  chartWindowFromTrade,
  defaultBarInterval,
  isChartableSymbol,
  useMarketBars,
} from "@/lib/hooks/useMarketBars";
import { intlLocale } from "@/lib/locale";
import { Modal } from "@/components/Modal";
import { ReplayControls } from "./ReplayControls";
import { ReplayHeartbeat } from "./ReplayHeartbeat";
import {
  computeReplayPnl,
  detectFillBarMismatch,
  formatReplayBarTime,
  replayCutoff,
} from "./replayPnl";
import { TradeChart } from "./TradeChart";
import { useReplayController } from "./useReplayController";

function modalChartHeight(): number {
  if (typeof globalThis.window === "undefined") return 480;
  return Math.min(Math.round(globalThis.window.innerHeight * 0.65), 560);
}

export function TradeChartSection({ trade }: { trade: TradeDetail }) {
  const range = useMemo(
    () => chartWindowFromTrade(trade.opened_at, trade.closed_at),
    [trade.opened_at, trade.closed_at],
  );
  const [interval, setInterval] = useState<BarInterval>(() =>
    defaultBarInterval(range.from, range.to),
  );
  const [expanded, setExpanded] = useState(false);
  const [expandedHeight, setExpandedHeight] = useState(480);

  const chartable = isChartableSymbol(trade.symbol);
  const barsQ = useMarketBars({
    symbol: trade.symbol,
    instrument_type: trade.instrument_type,
    from: range.from,
    to: range.to,
    interval,
    enabled: chartable,
  });

  const showUnavailable = !chartable;
  const showEmpty = chartable && !barsQ.isLoading && (barsQ.data?.bars.length ?? 0) === 0;
  const canExpand = chartable && !showUnavailable;

  const bars = barsQ.data?.bars;
  const replay = useReplayController(bars?.length ?? 0);
  const canReplay = chartable && !showEmpty && (bars?.length ?? 0) > 1;
  const cursorBar = replay.active ? bars?.[replay.cursor] : undefined;
  const replayUpTo = cursorBar && bars ? replayCutoff(bars, replay.cursor, interval) : null;
  const replayPnl = useMemo(
    () =>
      replay.active && bars ? computeReplayPnl(trade.fills, bars, replay.cursor, interval) : null,
    [replay.active, replay.cursor, bars, trade.fills, interval],
  );
  const priceMismatch = useMemo(
    () => (replay.active && bars ? detectFillBarMismatch(trade.fills, bars, interval) : false),
    [replay.active, bars, trade.fills, interval],
  );

  useEffect(() => {
    if (!expanded) return;
    setExpandedHeight(modalChartHeight());
    function onResize() {
      setExpandedHeight(modalChartHeight());
    }
    globalThis.window.addEventListener("resize", onResize);
    return () => globalThis.window.removeEventListener("resize", onResize);
  }, [expanded]);

  const chartProps = {
    symbol: trade.symbol,
    bars,
    fills: trade.fills,
    loading: barsQ.isLoading,
    error: barsQ.isError,
    errorMessage: showUnavailable
      ? "Chart unavailable for this symbol."
      : showEmpty
        ? "No market data for this window."
        : barsQ.error instanceof Error
          ? barsQ.error.message
          : undefined,
    targetPrice: trade.target_price,
    stopPrice: trade.stop_price,
    entryPrice: trade.avg_entry_price,
    interval,
    onIntervalChange: setInterval,
    empty: showUnavailable || showEmpty,
    hideIntervalWhenEmpty: showUnavailable,
    replayUpTo,
    replayActive: replay.active,
    onToggleReplay: canReplay ? () => (replay.active ? replay.exit() : replay.start()) : undefined,
  };

  const replayControls = replay.active && cursorBar && bars && (
    <>
      <ReplayHeartbeat fills={trade.fills} bars={bars} interval={interval} cursor={replay.cursor} />
      <ReplayControls
        controller={replay}
        barCount={bars.length}
        timeLabel={formatReplayBarTime(cursorBar.time, interval, intlLocale())}
        pnl={replayPnl}
        fillTotal={trade.fills.length}
        currency={trade.pnl_currency}
        priceMismatch={priceMismatch}
      />
    </>
  );

  return (
    <div className="flex flex-col gap-3 px-4 pb-4">
      <TradeChart {...chartProps} onExpand={canExpand ? () => setExpanded(true) : undefined} />
      {!expanded && replayControls}
      <Modal
        open={expanded}
        onOpenChange={setExpanded}
        title={`${trade.symbol} chart`}
        className="z-[70] max-h-[min(92vh,920px)] max-w-[min(1100px,96vw)]"
        overlayClassName="z-[60]"
        bodyClassName="p-4"
      >
        <div className="flex flex-col gap-3">
          <TradeChart {...chartProps} height={expandedHeight} hideHeaderLabel />
          {expanded && replayControls}
        </div>
      </Modal>
    </div>
  );
}
