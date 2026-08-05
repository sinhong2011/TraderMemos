import { Button as UIButton, Host, Image as UIImage, Menu } from '@expo/ui/swift-ui';
import { accessibilityLabel, buttonStyle, tint as tintModifier } from '@expo/ui/swift-ui/modifiers';
import { File as FsFile } from 'expo-file-system';
import { SymbolView } from 'expo-symbols';
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

import { useApiRaw, useTrade } from '@/api/hooks';
import type { BarInterval, MediaFile, TradeDetail } from '@/api/types';
import { ChartCanvas, type ChartBand, type ChartMarker } from '@/components/chart-canvas';
import { ReplayControls } from '@/components/replay-controls';
import { Segmented } from '@/components/segmented';
import { Skeleton } from '@/components/skeleton';
import { t } from '@lingui/core/macro';
import { locale } from '@/i18n';
import { formatCurrency, formatPnl } from '@/lib/format';
import * as haptics from '@/lib/haptics';
import { appendNoteImage } from '@/lib/note-media';
import { useDisplayPrefs } from '@/lib/prefs';
import { useReplayController, useReplayRun } from '@/lib/replay';
import { BAR_INTERVALS, useTradeBars } from '@/lib/trade-bars';
import { pnlColor } from '@/styles/unistyles';

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
 * Two modes, one screen: `?id=` replays a journalled trade with its fills and
 * plan; `?symbol=` replays bare candles from the advanced chart.
 */
export default function ReplayScreen() {
  const { id, symbol, market, from, to, interval } = useLocalSearchParams<{
    id?: string;
    symbol?: string;
    market?: string;
    from?: string;
    to?: string;
    interval?: string;
  }>();

  if (id) return <TradeReplay id={id} />;
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
  if (trade.error || !trade.data) {
    return <Failure message={trade.error?.message ?? t`Trade not found`} />;
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

function Failure({ message }: { message: string }) {
  return (
    <View style={[styles.page, styles.centered]}>
      <Stack.Screen options={{ headerShown: true, title: '' }} />
      <Text selectable style={styles.muted}>
        {message}
      </Text>
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
  // Re-render when privacy mode flips — formatters read it at call time.
  useDisplayPrefs();
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
      Alert.alert(t`Could not share`, err instanceof Error ? err.message : String(err));
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
      Alert.alert(t`Could not save`, err instanceof Error ? err.message : String(err));
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
              <SymbolView name="chevron.left" size={20} tintColor={theme.colors.foreground} />
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
                <Host matchContents>
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
                </Host>
              </View>
            ),
        }}
      />

      <View style={[styles.content, { paddingBottom: theme.spacing.lg + insets.bottom }]}>
        {bars.isLoading ? (
          <Skeleton style={styles.chartSkeleton} />
        ) : bars.error ? (
          <View style={[styles.chartSkeleton, styles.centered]}>
            <Text selectable style={styles.muted}>
              {bars.error.message}
            </Text>
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
}));
