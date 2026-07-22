import { useEffect, useMemo, useState } from "react";
import type { BarInterval } from "../../lib/api/market";
import type { TradeDetail } from "../../lib/api/types";
import {
  chartWindowFromTrade,
  defaultBarInterval,
  isChartableSymbol,
  useMarketBars,
} from "../../lib/hooks/useMarketBars";
import { Modal } from "../Modal";
import { TradeChart } from "./TradeChart";

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
    bars: barsQ.data?.bars,
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
  };

  return (
    <div className="px-4 pb-4">
      <TradeChart {...chartProps} onExpand={canExpand ? () => setExpanded(true) : undefined} />
      <Modal
        open={expanded}
        onOpenChange={setExpanded}
        title={`${trade.symbol} chart`}
        className="z-[70] max-h-[min(92vh,920px)] max-w-[min(1100px,96vw)]"
        overlayClassName="z-[60]"
        bodyClassName="p-4"
      >
        <TradeChart {...chartProps} height={expandedHeight} hideHeaderLabel />
      </Modal>
    </div>
  );
}
