import {
  Button as UIButton,
  Image as UIImage,
  Menu,
} from '@expo/ui/swift-ui';
import { accessibilityLabel, buttonStyle, tint as tintModifier } from '@expo/ui/swift-ui/modifiers';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { File as FsFile } from 'expo-file-system';
import { type SFSymbol } from 'expo-symbols';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Icon } from '@/components/icon';
import { queryKeys, useAccounts, useApiRaw, useApiRequest, useTrade } from '@/api/hooks';
import type { Account, BarInterval, MediaFile, TradeDetail } from '@/api/types';
import { ChartCanvas, type ChartBand, type ChartMarker } from '@/components/chart-canvas';
import { ErrorState, InlineError } from '@/components/error-state';
import { GlassButton } from '@/components/glass-button';
import { NumericField } from '@/components/numeric-field';
import { ReplayControls } from '@/components/replay-controls';
import { Segmented } from '@/components/segmented';
import { Skeleton } from '@/components/skeleton';
import { ValueToggle } from '@/components/value-toggle';
import { t } from '@lingui/core/macro';
import { locale } from '@/i18n';
import { errorMessage } from '@/lib/errors';
import { useFormatters } from '@/lib/format';
import * as haptics from '@/lib/haptics';
import { appendNoteImage } from '@/lib/note-media';
import {
  INTERVAL_SEC,
  useReplayController,
  useReplayRun,
  type ReplayController,
  type ReplayFill,
  type ReplayRun,
} from '@/lib/replay';
import { BAR_INTERVALS, useTradeBars } from '@/lib/trade-bars';
import { storage } from '@/storage/mmkv';
import { PnlFill, pnlColor } from '@/styles/unistyles';
import { AppHost } from '@/components/app-host';

/**
 * Floor for the plot. The chart takes whatever the readout and transport leave
 * behind (measured, not guessed — a fixed chrome estimate pushed the transport
 * off the bottom of taller phones), but below this a candle chart stops being
 * readable, so it overflows the slot rather than shrinking further.
 */
const MIN_CHART_HEIGHT = 160;

/** Stable identity for the fill-less symbol mode, so the run memo doesn't churn. */
const EMPTY_FILLS: TradeDetail['fills'] = [];

function formatBarClock(unixSec: number | undefined, interval: BarInterval): string {
  if (unixSec == null) return '';
  const d = new Date(unixSec * 1000);
  return interval === 'D'
    ? d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })
    : `${d.toLocaleDateString(locale, { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString(
        locale,
        { hour: '2-digit', minute: '2-digit' },
      )}`;
}

/**
 * Full-screen trade replay.
 *
 * The transport used to live inside the 220pt chart card on trade detail,
 * where the chart, the P&L readout and four buttons fought over one card's
 * width. Replay is a thing you sit and watch, so it gets its own screen: the
 * chart takes whatever height is left, the readout is legible from arm's
 * length, and the controls are docked where a thumb already is.
 *
 * Three modes, one screen: `?id=` replays a journalled trade with its fills and
 * plan; `?symbol=` replays bare candles from the advanced chart; and
 * `?mode=backtest` replays the same candles blind, with an order pad — see
 * `BacktestStage`.
 */
export default function ReplayScreen() {
  const { id, symbol, market, from, to, interval, mode } = useLocalSearchParams<{
    id?: string;
    symbol?: string;
    market?: string;
    from?: string;
    to?: string;
    interval?: string;
    mode?: string;
  }>();

  if (id) return <TradeReplay id={id} />;
  if (mode === 'backtest') {
    return (
      <BacktestReplay
        symbol={(symbol ?? '').toUpperCase()}
        market={market ?? 'stock'}
        fromMs={Number(from)}
        toMs={Number(to)}
        interval={(interval as BarInterval) ?? '60'}
      />
    );
  }
  return (
    <SymbolReplay
      symbol={(symbol ?? '').toUpperCase()}
      market={market ?? 'stock'}
      fromMs={Number(from)}
      toMs={Number(to)}
      interval={(interval as BarInterval) ?? '60'}
    />
  );
}

/** Loads the trade, then hands the stage its fills and plan. */
function TradeReplay({ id }: { id: string }) {
  const trade = useTrade(id);
  // Open trades replay up to "now", captured once per mount so the query key
  // doesn't churn between renders.
  const [mountedAtMs] = useState(() => Date.now());

  if (trade.isLoading) {
    return (
      <View style={styles.page}>
        <Stack.Screen options={{ headerShown: true, title: '' }} />
        <View style={styles.content}>
          <Skeleton style={styles.chartSkeleton} />
        </View>
      </View>
    );
  }
  // Only when there is nothing to replay: the persisted query cache usually
  // still holds the trade the user just tapped, and a stale replay beats none.
  if (trade.error && !trade.data) {
    return (
      <View style={styles.page}>
        <Stack.Screen options={{ headerShown: true, title: '' }} />
        <ErrorState
          error={trade.error}
          onRetry={() => void trade.refetch()}
          retrying={trade.isRefetching}
        />
      </View>
    );
  }
  if (!trade.data) {
    return <Failure message={t`Trade not found`} />;
  }

  const detail = trade.data;
  return (
    <Stage
      trade={detail}
      symbol={detail.symbol}
      instrumentType={detail.instrument_type}
      fromMs={new Date(detail.opened_at).getTime()}
      toMs={detail.closed_at ? new Date(detail.closed_at).getTime() : mountedAtMs}
    />
  );
}

function SymbolReplay({
  symbol,
  market,
  fromMs,
  toMs,
  interval,
}: {
  symbol: string;
  market: string;
  fromMs: number;
  toMs: number;
  interval: BarInterval;
}) {
  if (!symbol || !Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
    return <Failure message={t`Nothing to replay.`} />;
  }
  return (
    <Stage
      symbol={symbol}
      instrumentType={market}
      fromMs={fromMs}
      toMs={toMs}
      initialInterval={interval}
    />
  );
}

function BacktestReplay({
  symbol,
  market,
  fromMs,
  toMs,
  interval,
}: {
  symbol: string;
  market: string;
  fromMs: number;
  toMs: number;
  interval: BarInterval;
}) {
  if (!symbol || !Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
    return <Failure message={t`Nothing to replay.`} />;
  }
  return (
    <BacktestStage
      symbol={symbol}
      instrumentType={market}
      fromMs={fromMs}
      toMs={toMs}
      interval={interval}
    />
  );
}

/** Nothing to replay — an empty stage, not a failure, so it stays plain copy. */
function Failure({ message }: { message: string }) {
  return (
    <View style={[styles.page, styles.centered]}>
      <Stack.Screen options={{ headerShown: true, title: '' }} />
      <Text style={styles.muted}>{message}</Text>
    </View>
  );
}

/**
 * The replay itself. Trade mode and symbol mode share every pixel below the
 * header — the only difference is whether there are fills to mark the tape
 * with and a plan to shade behind it. Absent `trade`, the window comes from
 * the caller instead of the trade's own open/close.
 */
function Stage({
  trade,
  symbol,
  instrumentType,
  fromMs,
  toMs,
  initialInterval,
}: {
  trade?: TradeDetail;
  symbol: string;
  instrumentType: string;
  fromMs: number;
  toMs: number;
  initialInterval?: BarInterval;
}) {
  const { theme } = useUnistyles();
  const router = useRouter();
  const apiRaw = useApiRaw();
  // Formatters bound to the display prefs (see lib/format.ts).
  const { formatCurrency, formatPnl } = useFormatters();
  const insets = useSafeAreaInsets();
  const frameRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  // The plot's height comes from the slot the transport leaves behind, so the
  // controls are always fully on screen whatever the device or dynamic type.
  const [chartSlot, setChartSlot] = useState(0);

  const bars = useTradeBars({ symbol, instrumentType, fromMs, toMs, initialInterval });

  const run = useReplayRun({
    fills: trade?.fills ?? EMPTY_FILLS,
    bars: bars.bars,
    interval: bars.interval,
    initialRisk: trade?.initial_risk,
    stopPrice: trade?.stop_price,
    targetPrice: trade?.target_price,
  });

  const replay = useReplayController(bars.bars.length, true);
  const frame = run.frames[replay.cursor];
  const currency = trade?.pnl_currency ?? 'USD';
  const chartHeight = Math.max(MIN_CHART_HEIGHT, Math.round(chartSlot));

  const onChartSlotLayout = (e: LayoutChangeEvent) => setChartSlot(e.nativeEvent.layout.height);

  // A short buzz when the run lands on the final bar, so a replay you are not
  // staring at still tells you it finished.
  useEffect(() => {
    if (replay.atEnd) haptics.landmark();
  }, [replay.atEnd]);

  const priceLines = trade
    ? [
        { value: trade.avg_entry_price, color: theme.colors.primary },
        ...(trade.target_price != null
          ? [{ value: trade.target_price, color: theme.colors.profit }]
          : []),
        ...(trade.stop_price != null
          ? [{ value: trade.stop_price, color: theme.colors.loss }]
          : []),
      ]
    : [];

  // Risk below the entry, reward above it (inverted for a short) — the plan as
  // territory rather than two stray lines.
  const bands: ChartBand[] = trade
    ? [
        ...(trade.stop_price != null
          ? [
              {
                from: trade.avg_entry_price,
                to: trade.stop_price,
                color: theme.colors.loss,
              },
            ]
          : []),
        ...(trade.target_price != null
          ? [
              {
                from: trade.avg_entry_price,
                to: trade.target_price,
                color: theme.colors.profit,
              },
            ]
          : []),
      ]
    : [];

  const markers: ChartMarker[] = trade
    ? trade.fills.map((fill) => ({
        key: fill.id,
        timeSec: Math.floor(new Date(fill.executed_at).getTime() / 1000),
        isBuy: fill.side === 'buy',
        label: `${fill.quantity} @ ${fill.price}`,
      }))
    : [];

  const barClock = formatBarClock(frame?.barTime, bars.interval);

  /** PNG of the frame card — the caption is baked in so the image stands alone. */
  async function captureFrame(): Promise<string> {
    const uri = await captureRef(frameRef, { format: 'png', quality: 1, result: 'tmpfile' });
    return uri.startsWith('file://') ? uri : `file://${uri}`;
  }

  async function shareFrame() {
    setBusy(true);
    try {
      await Sharing.shareAsync(await captureFrame(), {
        mimeType: 'image/png',
        dialogTitle: t`Share replay frame`,
      });
    } catch (err) {
      Alert.alert(t`Could not share`, errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  /**
   * The frame becomes a `tm-media` image in a new note, the same reference the
   * web editor round-trips — so "this is the bar it turned" survives as part of
   * the journal instead of a screenshot in the camera roll.
   */
  async function saveFrameToNote() {
    setBusy(true);
    try {
      const uri = await captureFrame();
      const formData = new FormData();
      // An expo-file-system `File`, not RN's `{uri,name,type}` descriptor — see
      // the note-images upload for why a bare descriptor throws here.
      formData.append(
        'file',
        new FsFile(uri) as unknown as Blob,
        `replay-${symbol}-${frame?.barTime ?? 0}.png`,
      );
      const response = await apiRaw('/media', { method: 'POST', formData });
      if (!response.ok) throw new Error(t`Upload failed (${response.status})`);
      const media = (await response.json()) as MediaFile;

      const heading = trade
        ? t`${symbol} replay at ${barClock} — ${formatPnl(frame?.net ?? 0, currency)}`
        : t`${symbol} replay at ${barClock}`;
      router.push({
        pathname: '/new-note',
        params: {
          title: t`${symbol} replay`,
          body: appendNoteImage(heading, media.id),
        },
      });
    } catch (err) {
      Alert.alert(t`Could not save`, errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const isLong = trade ? trade.direction === 'long' : null;

  return (
    <View style={styles.page}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: symbol,
          // A full-screen modal gets no back chevron of its own, so it has to
          // carry its own — replay is a place you came *into* from a trade, not
          // a form you complete, so it reads as back rather than Done.
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t`Back`}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Icon name="chevron.left" size={20} tintColor={theme.colors.foreground} />
            </Pressable>
          ),
          headerRight: () =>
            busy ? (
              <ActivityIndicator />
            ) : (
              <View style={styles.headerActions}>
                {/* The interval was a full-bleed segmented row above the chart —
                    46pt of chrome, on a screen whose whole point is the plot.
                    As a nav-bar pull-down it costs nothing and the candles get
                    the height back. */}
                <Segmented
                  variant="menu"
                  options={BAR_INTERVALS}
                  value={bars.interval}
                  onChange={bars.pickInterval}
                />
                <AppHost matchContents>
                  <Menu
                    label={<UIImage systemName="ellipsis.circle" size={17} />}
                    modifiers={[
                      buttonStyle('plain'),
                      tintModifier(theme.colors.foreground),
                      accessibilityLabel(t`Replay actions`),
                    ]}
                  >
                    <UIButton
                      label={t`Save frame to note`}
                      systemImage="note.text.badge.plus"
                      onPress={() => void saveFrameToNote()}
                    />
                    <UIButton
                      label={t`Share frame`}
                      systemImage="square.and.arrow.up"
                      onPress={() => void shareFrame()}
                    />
                  </Menu>
                </AppHost>
              </View>
            ),
        }}
      />

      <View style={[styles.content, { paddingBottom: theme.spacing.lg + insets.bottom }]}>
        {bars.isLoading ? (
          <Skeleton style={styles.chartSkeleton} />
        ) : bars.error && bars.bars.length === 0 ? (
          // Only when the feed left nothing behind — cached candles still draw,
          // and a dead feed costs the chart rather than the screen either way.
          <View style={[styles.chartSkeleton, styles.centered]}>
            <InlineError error={bars.error} />
          </View>
        ) : bars.bars.length === 0 ? (
          <View style={[styles.chartSkeleton, styles.centered]}>
            <Text style={styles.muted}>{t`No chart data for this window.`}</Text>
          </View>
        ) : (
          <>
            {/* Everything inside this View is what a shared frame contains. */}
            <View ref={frameRef} collapsable={false} style={styles.frame}>
              <View style={styles.caption}>
                <View style={styles.captionIdentity}>
                  <Text style={styles.captionSymbol}>{symbol}</Text>
                  {isLong != null ? (
                    <Text
                      style={[
                        styles.captionSide,
                        { color: isLong ? theme.colors.profit : theme.colors.loss },
                      ]}
                    >
                      {isLong ? t`LONG` : t`SHORT`}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.captionFigures}>
                  <Text
                    style={[
                      styles.captionValue,
                      trade
                        ? { color: pnlColor(theme.colors, frame?.net) }
                        : styles.captionNeutral,
                    ]}
                  >
                    {trade
                      ? formatPnl(frame?.net ?? 0, currency)
                      : formatCurrency(frame?.close ?? 0, currency)}
                  </Text>
                  <Text style={styles.captionClock}>{barClock}</Text>
                </View>
              </View>

              {/* The slot flexes; the canvas inside it is drawn to the height
                  that slot reported, since it lays candles out absolutely. */}
              <View style={styles.chartSlot} onLayout={onChartSlotLayout}>
                {chartSlot > 0 ? (
                  <ChartCanvas
                    bars={bars.bars}
                    interval={bars.interval}
                    height={chartHeight}
                    surface={theme.colors.background}
                    priceLines={priceLines}
                    bands={bands}
                    markers={markers}
                    cursor={replay.cursor}
                    onScrub={replay.seek}
                  />
                ) : null}
              </View>
            </View>

            <ReplayControls
              controller={replay}
              run={run}
              currency={currency}
              barTimeLabel={barClock}
              mode={trade ? 'pnl' : 'price'}
            />
          </>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Backtest — the same tape, played blind, with an order pad
// ---------------------------------------------------------------------------

/** A synthetic order, with a local key: it has no server id until the save. */
type BacktestFill = ReplayFill & { key: string };

/** Last order size outlives the session — a size is a habit, not a decision. */
const QTY_KEY = 'backtest:qty';
const DEFAULT_QTY = '100';
/**
 * Bars of context before the first tradeable one: the larger of these two.
 * Same figures as web `useBacktestReplay`, so a session set up identically on
 * either client opens on the same bar.
 */
const WARMUP_BARS = 10;
const WARMUP_FRACTION = 0.1;
/**
 * Seconds in a regular stock session (6.5h). Daily bars carry the session's
 * *open* as their timestamp, so this is what puts a daily fill at the close of
 * the same market day rather than at the next day's open.
 */
const SESSION_SEC = 23_400;

function loadQty(): string {
  try {
    return storage.getString(QTY_KEY) ?? DEFAULT_QTY;
  } catch {
    return DEFAULT_QTY;
  }
}

/**
 * Paper trading against historical tape.
 *
 * The whole point is that the trader knows exactly as much as the chart does,
 * so this stage differs from `Stage` in what it *refuses* to do: the canvas is
 * `blind` (no candles, scale or axis past the cursor), the plot is not a
 * scrubber, the transport's seek can only travel backwards over bars already
 * revealed, and orders are only accepted at the furthest bar reached — stepping
 * back is review, not a second chance.
 *
 * Fills live in component state until the session is saved, at which point they
 * are posted as real executions against the paper account (`account_type:
 * 'backtest'`), which the API keeps out of the unscoped analytics.
 */
function BacktestStage({
  symbol,
  instrumentType,
  fromMs,
  toMs,
  interval,
}: {
  symbol: string;
  instrumentType: string;
  fromMs: number;
  toMs: number;
  interval: BarInterval;
}) {
  const { theme } = useUnistyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const api = useApiRequest();
  const accounts = useAccounts();
  const queryClient = useQueryClient();
  const [chartSlot, setChartSlot] = useState(0);
  const [fills, setFills] = useState<BacktestFill[]>([]);
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [qty, setQty] = useState(loadQty);

  const bars = useTradeBars({ symbol, instrumentType, fromMs, toMs, initialInterval: interval });
  const run = useReplayRun({ fills, bars: bars.bars, interval: bars.interval });
  const replay = useReplayController(bars.bars.length, false);

  const lastIndex = Math.max(bars.bars.length - 1, 0);
  const warmup = Math.min(
    Math.max(WARMUP_BARS, Math.floor(bars.bars.length * WARMUP_FRACTION)),
    lastIndex,
  );

  // The furthest bar revealed. Orders are only taken here, so a step back can
  // never become a trade placed with the next bar already on screen.
  // Adopt-during-render (the controller's own idiom) — an effect would paint
  // one frame of bar 0 before the warmup landed.
  const [session, setSession] = useState({ signature: '', head: 0 });
  const signature = `${bars.interval}:${bars.bars.length}`;
  if (bars.bars.length > 0 && session.signature !== signature) {
    // `head`, not `warmup`, when a session is already under way: a background
    // refetch that changes the bar count must not rewind what was traded.
    const head = Math.min(Math.max(warmup, session.head), lastIndex);
    setSession({ signature, head });
    replay.seek(head);
  } else if (replay.cursor > session.head) {
    setSession((prev) => ({ ...prev, head: replay.cursor }));
  }

  const frame = run.frames[replay.cursor];
  // The book belongs to the furthest bar reached, never to the bar being
  // reviewed: stepping back must not report a position as flat because it had
  // not been opened yet, and must not let "Close & save" fire into the past.
  const head = Math.min(Math.max(session.head, replay.cursor), lastIndex);
  const headFrame = run.frames[head];
  const position = headFrame?.position ?? 0;

  /**
   * The run as far as it has been revealed. `ReplayControls` is built for a
   * finished trade, where every frame is history: it draws the whole equity
   * strip (ghosting, but drawing, the frames past the cursor) and reports the
   * run's peak and trough. Handed the full run here, an open position's future
   * P&L would be legible in the strip's silhouette — so the controls only ever
   * see the bars the trader has.
   */
  const maskedFrame = headFrame != null ? { ...headFrame, net: 0 } : null;
  const revealed: ReplayRun = {
    // Masked rather than truncated: the controls derive "is there a bar left to
    // step to" from the frame count, so a truncated run would disable the one
    // control the backtest is played with. Frames past the head are flattened
    // to zero P&L, so the strip's ghosted tail reads as unknown rather than as
    // a forecast.
    frames: maskedFrame == null ? run.frames : run.frames.map((f, i) => (i <= head ? f : maskedFrame)),
    // Frame `peak`/`trough` are cumulative, so the head frame already carries
    // the extremes of everything seen.
    best: headFrame?.peak ?? 0,
    worst: headFrame?.trough ?? 0,
    // No plan and no imported fills: both belong to a journalled trade.
    stopTouch: null,
    targetTouch: null,
    mismatch: false,
  };
  const account = accounts.data?.find((a) => a.account_type === 'backtest');
  const currency = account?.base_currency ?? 'USD';
  const barClock = formatBarClock(frame?.barTime, bars.interval);
  const chartHeight = Math.max(MIN_CHART_HEIGHT, Math.round(chartSlot));
  const orderQty = Number(qty);
  const atHead = replay.cursor >= session.head;

  const save = useMutation({
    mutationFn: async (batch: BacktestFill[]) => {
      // One paper account per user, found by type rather than by name so a
      // renamed account is still the same account. The list is re-read when the
      // query has not landed yet — guessing "none" here would mint a second
      // paper account on every cold save.
      const known = accounts.data ?? (await api<Account[]>('/accounts'));
      const paper =
        known.find((a) => a.account_type === 'backtest') ??
        (await api<Account>('/accounts', {
          method: 'POST',
          // Not translated: this is a stored account name shared with the web
          // client, not a label rendered from the catalog.
          body: {
            name: 'Backtest',
            account_type: 'backtest',
            base_currency: 'USD',
            starting_balance: 0,
          },
        }));
      // Chronological: the server groups executions into trades in arrival
      // order, so an exit posted before its entry would open a short.
      const ordered = [...batch].sort((a, b) => a.executed_at.localeCompare(b.executed_at));
      for (const fill of ordered) {
        await api('/executions', {
          method: 'POST',
          body: {
            account_id: paper.id,
            symbol,
            instrument_type: instrumentType,
            side: fill.side,
            quantity: fill.quantity,
            price: fill.price,
            fees: 0,
            commission: 0,
            executed_at: fill.executed_at,
            multiplier: 1,
          },
        });
      }
    },
    onSuccess: () => {
      haptics.notify('success');
      void queryClient.invalidateQueries({ queryKey: ['trades'] });
      void queryClient.invalidateQueries({ queryKey: ['analytics'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.accounts() });
      router.back();
    },
    onError: (err) => Alert.alert(t`Could not save`, errorMessage(err)),
  });

  /**
   * The fill list with one more order on it, anchored at the head bar's close.
   * Mirrors web `useBacktestReplay.placeOrder` — keep the two in step.
   *
   * Everything an order can collide with on its own bar is resolved here rather
   * than left for the server: opposite sides net out, same sides merge.
   */
  function withOrder(
    prev: BacktestFill[],
    orderSide: 'buy' | 'sell',
    quantity: number,
  ): BacktestFill[] {
    const bar = bars.bars[head];
    if (!bar || !(quantity > 0)) return prev;
    // Inside the bar, never on its boundary: a fill stamped at the next bar's
    // open falls past this bar's P&L cutoff and would leave the order you just
    // placed invisible until you stepped forward. Daily bars are stamped at the
    // session *open*, so a full day's offset would also roll the journal date
    // onto the next day — the 6.5h stock session lands it at ~4pm ET instead.
    const executedSec =
      bar.time + (bars.interval === 'D' ? SESSION_SEC : INTERVAL_SEC[bars.interval] - 1);
    const executedAt = new Date(executedSec * 1000).toISOString();
    const next = [...prev];
    let remaining = quantity;

    // Opposite sides on one bar net out first: both fill at the same close, so
    // netting is economically identical — and it avoids handing the server two
    // fills with the same timestamp, whose order it cannot reconstruct (the
    // trades engine sorts by executed_at, and a tie could read a buy/sell round
    // trip as a short flip).
    const opposite = next.findIndex((f) => f.executed_at === executedAt && f.side !== orderSide);
    if (opposite >= 0) {
      const other = next[opposite]!;
      const netted = Math.min(other.quantity, remaining);
      remaining -= netted;
      if (other.quantity - netted <= 0) next.splice(opposite, 1);
      else next[opposite] = { ...other, quantity: other.quantity - netted };
    }
    if (remaining <= 0) return next;

    // Same side on one bar merges into a single fill: the price is identical
    // anyway, and two executions with the same (symbol, side, qty, price, time)
    // share a dedup hash, so the server would silently keep one of them.
    const same = next.findIndex((f) => f.executed_at === executedAt && f.side === orderSide);
    if (same >= 0) {
      next[same] = { ...next[same]!, quantity: next[same]!.quantity + remaining };
      return next;
    }
    next.push({
      key: `${executedAt}-${orderSide}`,
      side: orderSide,
      quantity: remaining,
      price: bar.close,
      fees: 0,
      commission: 0,
      executed_at: executedAt,
      multiplier: 1,
    });
    return next;
  }

  function order(orderSide: 'buy' | 'sell', quantity: number) {
    if (!(quantity > 0)) return;
    setFills((prev) => withOrder(prev, orderSide, quantity));
    haptics.tap();
  }

  /**
   * The flattening order — what "Close" and "Close & save" both place. Returns
   * the resulting batch as well as storing it: the save runs now, and the state
   * update would not have landed in time for it.
   */
  function flatten(): BacktestFill[] {
    if (position === 0) return fills;
    const next = withOrder(fills, position > 0 ? 'sell' : 'buy', Math.abs(position));
    setFills(next);
    haptics.tap();
    return next;
  }

  function changeQty(next: string) {
    setQty(next);
    try {
      storage.set(QTY_KEY, next);
    } catch {
      // A read-only store costs the default, not the order.
    }
  }

  function discard() {
    Alert.alert(t`Discard session?`, t`The orders you placed will not be saved.`, [
      { text: t`Cancel`, style: 'cancel' },
      { text: t`Discard`, style: 'destructive', onPress: () => router.back() },
    ]);
  }

  function leave() {
    if (fills.length === 0) {
      router.back();
      return;
    }
    discard();
  }

  // Seek only ever travels backwards here: the transport is for reviewing the
  // bars already revealed, and a forward jump would hand over the tape.
  const guarded: ReplayController = {
    ...replay,
    seek: (index: number) => replay.seek(Math.min(index, replay.cursor)),
  };

  const markers: ChartMarker[] = fills.map((fill) => ({
    key: fill.key,
    timeSec: Math.floor(new Date(fill.executed_at).getTime() / 1000),
    isBuy: fill.side === 'buy',
    label: `${fill.quantity} @ ${fill.price.toFixed(2)}`,
  }));

  // The open position's average cost, so the tape shows what has to hold.
  const priceLines =
    position !== 0 && headFrame != null && headFrame.avgCost > 0
      ? [{ value: headFrame.avgCost, color: theme.colors.primary }]
      : [];

  const sides = [
    { value: 'buy' as const, label: t`Buy`, fill: PnlFill.pos },
    { value: 'sell' as const, label: t`Sell`, fill: PnlFill.neg },
  ] as const;

  // Built as a list rather than as conditional children: the menu is a hosted
  // SwiftUI view, and an empty branch inside it is still a child.
  const sessionActions: { label: string; systemImage: SFSymbol; onPress: () => void }[] = [
    ...(fills.length > 0 && position === 0
      ? [
          {
            label: t`Save session`,
            systemImage: 'tray.and.arrow.down' as SFSymbol,
            onPress: () => save.mutate(fills),
          },
        ]
      : []),
    // An open position is not a session yet — flattening it at this bar is what
    // makes the round trip journallable, so the two are one action.
    ...(position !== 0
      ? [
          {
            label: t`Close & save`,
            systemImage: 'tray.and.arrow.down' as SFSymbol,
            onPress: () => save.mutate(flatten()),
          },
        ]
      : []),
    ...(fills.length > 0
      ? [{ label: t`Discard`, systemImage: 'trash' as SFSymbol, onPress: discard }]
      : []),
  ];

  return (
    <View style={styles.page}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: symbol,
          headerLeft: () => (
            <Pressable
              onPress={leave}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t`Back`}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Icon name="chevron.left" size={20} tintColor={theme.colors.foreground} />
            </Pressable>
          ),
          headerRight: () =>
            save.isPending ? (
              <ActivityIndicator />
            ) : // Nothing traded yet, nothing to save or throw away — an empty
            // pull-down would be a dead affordance in the nav bar.
            sessionActions.length === 0 ? null : (
              <AppHost matchContents>
                <Menu
                  label={<UIImage systemName="ellipsis.circle" size={17} />}
                  modifiers={[
                    buttonStyle('plain'),
                    tintModifier(theme.colors.foreground),
                    accessibilityLabel(t`Session actions`),
                  ]}
                >
                  {sessionActions.map((action) => (
                    <UIButton
                      key={action.label}
                      label={action.label}
                      systemImage={action.systemImage}
                      onPress={action.onPress}
                    />
                  ))}
                </Menu>
              </AppHost>
            ),
        }}
      />

      <View style={[styles.content, { paddingBottom: theme.spacing.lg + insets.bottom }]}>
        {bars.isLoading ? (
          <Skeleton style={styles.chartSkeleton} />
        ) : bars.error && bars.bars.length === 0 ? (
          <View style={[styles.chartSkeleton, styles.centered]}>
            <InlineError error={bars.error} />
          </View>
        ) : bars.bars.length === 0 ? (
          <View style={[styles.chartSkeleton, styles.centered]}>
            <Text style={styles.muted}>{t`No chart data for this window.`}</Text>
          </View>
        ) : (
          <>
            <View
              style={styles.chartSlot}
              onLayout={(e: LayoutChangeEvent) => setChartSlot(e.nativeEvent.layout.height)}
            >
              {chartSlot > 0 ? (
                <ChartCanvas
                  blind
                  bars={bars.bars}
                  interval={bars.interval}
                  height={chartHeight}
                  surface={theme.colors.background}
                  priceLines={priceLines}
                  markers={markers}
                  cursor={replay.cursor}
                />
              ) : null}
            </View>

            <ReplayControls
              controller={guarded}
              run={revealed}
              currency={currency}
              barTimeLabel={barClock}
              mode={fills.length > 0 ? 'pnl' : 'price'}
            />

            <View style={styles.orderRow}>
              <ValueToggle options={sides} value={side} onChange={setSide} />
              <View style={styles.qtyBox}>
                <Text style={styles.qtyLabel}>{t`Qty`}</Text>
                <NumericField
                  value={qty}
                  onChangeText={changeQty}
                  align="trailing"
                  size={15}
                  weight="semibold"
                  decimals={false}
                />
              </View>
            </View>

            <View style={styles.actionRow}>
              <View style={styles.actionCell}>
                <GlassButton
                  fill
                  prominent
                  label={t`Order`}
                  systemImage="bolt.fill"
                  disabled={!atHead || !(orderQty > 0) || save.isPending}
                  onPress={() => order(side, orderQty)}
                />
              </View>
              {position !== 0 ? (
                <View style={styles.actionCell}>
                  <GlassButton
                    fill
                    label={t`Close`}
                    systemImage="xmark"
                    disabled={!atHead || save.isPending}
                    onPress={() => order(position > 0 ? 'sell' : 'buy', Math.abs(position))}
                  />
                </View>
              ) : null}
            </View>

            {!atHead ? (
              <Text style={styles.muted}>{t`Reviewing an earlier bar — step forward to trade.`}</Text>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  page: { flex: 1, backgroundColor: theme.colors.background },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  pressed: { opacity: 0.6 },
  content: { flex: 1, padding: theme.spacing.lg, gap: theme.spacing.md },
  centered: { alignItems: 'center', justifyContent: 'center' },
  muted: { fontSize: 13, color: theme.colors.mutedForeground, textAlign: 'center' },
  chartSkeleton: { flex: 1, borderRadius: theme.radius.lg },
  // The capture target paints the app background so the shared PNG isn't
  // transparent where the screen was showing through.
  frame: { flex: 1, gap: theme.spacing.sm, backgroundColor: theme.colors.background },
  // minHeight, not height: the slot reports the space actually left over, and
  // only refuses to go below the floor.
  chartSlot: { flex: 1, minHeight: MIN_CHART_HEIGHT },
  caption: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.md },
  captionIdentity: { flex: 1, gap: 2 },
  captionSymbol: { fontSize: 17, fontWeight: '700', color: theme.colors.foreground },
  captionSide: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  captionFigures: { alignItems: 'flex-end', gap: 2 },
  captionValue: { fontSize: 17, fontWeight: '700', ...theme.numeric },
  captionNeutral: { color: theme.colors.foreground },
  captionClock: { fontSize: 11, color: theme.colors.mutedForeground, ...theme.numeric },
  // Backtest order pad: direction and size on one line, the actions under it —
  // the two rows a broker's ticket uses, and the only way both fit a phone.
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  qtyBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    minHeight: 34,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.full,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.fill,
  },
  qtyLabel: { fontSize: 12, color: theme.colors.mutedForeground },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  actionCell: { flex: 1 },
}));
