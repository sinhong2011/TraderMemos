import { Image } from 'expo-image';
import { Button, cn } from 'panelui-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeInUp,
  LinearTransition,
  SlideInDown,
  SlideOutDown,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';

import { Icon } from '@/components/icon';
import { useApiRaw } from '@/api/hooks';
import type { TradeExtract } from '@/api/types';
import { GlassButton, GlassIconButton } from '@/components/glass-button';
import { BlockSummary } from '@/components/trade-summary';
import { t } from '@lingui/core/macro';
import { errorMessage } from '@/lib/errors';
import { usePnlPalette } from '@/styles/pnl';
import type { TradeFormValues } from '@/lib/trade-form';
import {
  capScanSources,
  extractFromSource,
  isImageSource,
  type ImportSource,
} from '@/lib/trade-import';
import { blocksFromExtract, mergeTradeExtracts } from '@/lib/trade-prefill';

/** The app's one spring (see symbol-pager-bar.tsx) — scan motion matches. */
const SCAN_SPRING = { duration: 420, dampingRatio: 0.85 } as const;
const springIn = (delay = 0) =>
  FadeInDown.springify().duration(SCAN_SPRING.duration).dampingRatio(SCAN_SPRING.dampingRatio).delay(delay);
const springUp = (delay = 0) =>
  FadeInUp.springify().duration(SCAN_SPRING.duration).dampingRatio(SCAN_SPRING.dampingRatio).delay(delay);
const LAYOUT = LinearTransition.springify()
  .duration(SCAN_SPRING.duration)
  .dampingRatio(SCAN_SPRING.dampingRatio);

/** Squircle corners on the panels — no Tailwind utility maps to this. */
const CONTINUOUS = { borderCurve: 'continuous' } as const;

type FileStatus = 'pending' | 'parsing' | 'done' | 'error';

interface FileState {
  source: ImportSource;
  status: FileStatus;
  error?: string;
}

function statusCaption(state: FileState): string {
  switch (state.status) {
    case 'pending':
      return t`Waiting`;
    case 'parsing':
      return isImageSource(state.source) ? t`Scanning with AI…` : t`Reading…`;
    case 'done':
      return t`Parsed`;
    case 'error':
      return state.error ?? t`Failed`;
  }
}

/**
 * The document-scanner light bar: a thin brand-tinted line sweeping the
 * thumbnail top-to-bottom while the vision endpoint reads the screenshot.
 */
function ScanBeam({ travel }: { travel: number }) {
  const sweep = useSharedValue(0);
  useEffect(() => {
    sweep.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [sweep]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: sweep.value * travel }],
  }));
  return (
    <Animated.View
      className="absolute inset-x-0 top-0 h-1 rounded-[2px] bg-primary opacity-90"
      style={style}
    />
  );
}

function StatusGlyph({ status }: { status: FileStatus }) {
  const [mutedForeground] = useCSSVariable(['--color-muted-foreground']) as [string];
  const { profit, loss } = usePnlPalette();
  switch (status) {
    case 'pending':
      return <Icon name="clock" size={16} tintColor={mutedForeground} />;
    case 'parsing':
      return <ActivityIndicator size="small" color={mutedForeground} />;
    case 'done':
      return <Icon name="checkmark.circle.fill" size={18} tintColor={profit} />;
    case 'error':
      return <Icon name="exclamationmark.circle.fill" size={18} tintColor={loss} />;
  }
}

/** One picked file: thumbnail (beam while scanning), name, live status. */
function FileRow({ state, index }: { state: FileState; index: number }) {
  // expo-image is not one of the components Uniwind extends with `className`,
  // so its surface color comes from the token as a value.
  const [mutedForeground, muted] = useCSSVariable([
    '--color-muted-foreground',
    '--color-muted',
  ]) as [string, string];
  const failed = state.status === 'error';
  const scanning = state.status === 'parsing';
  return (
    <Animated.View
      entering={springIn(index * 70)}
      className="flex-row items-center gap-3 px-4 py-[10px]"
    >
      <View className="overflow-hidden rounded-md" style={CONTINUOUS}>
        {isImageSource(state.source) ? (
          <Image
            source={{ uri: state.source.uri }}
            style={{ width: 44, height: 44, backgroundColor: muted }}
            contentFit="cover"
          />
        ) : (
          <View className="h-11 w-11 items-center justify-center bg-muted">
            <Icon name="doc.text" size={20} tintColor={mutedForeground} />
          </View>
        )}
        {scanning ? <ScanBeam travel={40} /> : null}
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-[15px] text-foreground" numberOfLines={1}>
          {state.source.name}
        </Text>
        <Text
          className={cn('text-xs', failed ? 'text-loss' : 'text-muted-foreground')}
          numberOfLines={2}
        >
          {statusCaption(state)}
        </Text>
      </View>
      {/* Keyed by status so each state change lands with a zoom-pop. */}
      <Animated.View key={state.status} entering={ZoomIn.springify().duration(320)}>
        <StatusGlyph status={state.status} />
      </Animated.View>
    </Animated.View>
  );
}

/** Animated brand-blue progress track under the title. */
function ProgressTrack({ fraction }: { fraction: number }) {
  const [width, setWidth] = useState(0);
  const fill = useAnimatedStyle(
    () => ({ width: withSpring(width * fraction, SCAN_SPRING) }),
    [width, fraction],
  );
  return (
    <View
      className="mx-4 h-[3px] overflow-hidden rounded-[2px] bg-muted"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <Animated.View className="h-[3px] rounded-[2px] bg-primary" style={fill} />
    </View>
  );
}

/**
 * Full-screen scan flow over the new-trade form, staged like a document
 * scanner: files slide in and get read one by one (a light bar sweeps the
 * active thumbnail, statuses pop in as they land), a progress track fills
 * under the title, and when everything is parsed the file list folds into a
 * one-line receipt while the per-symbol review cards spring up. Nothing
 * touches the form until "Fill form".
 */
export function TradeScanOverlay({
  sources,
  accountId,
  currency,
  onApply,
  onClose,
}: {
  sources: ImportSource[];
  accountId: string;
  currency: string;
  onApply: (blocks: TradeFormValues[]) => void;
  onClose: () => void;
}) {
  const api = useApiRaw();
  const insets = useSafeAreaInsets();
  const [mutedForeground, muted, card] = useCSSVariable([
    '--color-muted-foreground',
    '--color-muted',
    '--color-card',
  ]) as [string, string, string];
  const { profit, flat } = usePnlPalette();
  // Overlapping receipt thumbnails: expo-image takes no `className`, and the
  // document tile has to match it exactly, so both wear the same style.
  const receiptThumb = {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderCurve: 'continuous',
    backgroundColor: muted,
    borderWidth: 1.5,
    borderColor: card,
  } as const;
  const [files, setFiles] = useState<FileState[]>(() =>
    capScanSources(sources).map((source) => ({ source, status: 'pending' as const })),
  );
  const [extracts, setExtracts] = useState<TradeExtract[] | null>(null);
  // Closing mid-scan unmounts the overlay; the guard keeps a late OCR response
  // from re-opening state on a dead component.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const done: TradeExtract[] = [];
      for (const [index, file] of files.entries()) {
        if (cancelled) return;
        setFiles((current) =>
          current.map((f, i) => (i === index ? { ...f, status: 'parsing' } : f)),
        );
        try {
          const extract = await extractFromSource(file.source, api);
          done.push(extract);
          if (!alive.current || cancelled) return;
          setFiles((current) => current.map((f, i) => (i === index ? { ...f, status: 'done' } : f)));
        } catch (err) {
          if (!alive.current || cancelled) return;
          // Extraction is a server round trip, so this label is where an
          // unreachable server would otherwise print its raw platform throw.
          const message = errorMessage(err);
          setFiles((current) =>
            current.map((f, i) => (i === index ? { ...f, status: 'error', error: message } : f)),
          );
        }
      }
      if (!cancelled && alive.current) setExtracts(done);
    })();
    return () => {
      cancelled = true;
    };
    // Parse exactly once for the sources this overlay was opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parsing = extracts == null;
  const nothingParsed = extracts != null && extracts.length === 0;
  const prefill =
    extracts != null && extracts.length > 0
      ? blocksFromExtract(mergeTradeExtracts(extracts), accountId)
      : null;
  const settled = files.filter((f) => f.status === 'done' || f.status === 'error').length;
  const parsedCount = files.filter((f) => f.status === 'done').length;

  return (
    <Animated.View
      entering={SlideInDown.springify().duration(SCAN_SPRING.duration).dampingRatio(SCAN_SPRING.dampingRatio)}
      exiting={SlideOutDown.duration(240)}
      className="absolute inset-0 bg-background"
      style={{ paddingTop: insets.top + 8 }}
    >
      <View className="flex-row items-center gap-3 px-4 pb-3">
        <GlassIconButton systemImage="xmark" label={t`Cancel`} onPress={onClose} />
        <Text className="flex-1 text-center text-[17px] font-semibold text-foreground">
          {prefill ? t`Review import` : t`Scan to fill`}
        </Text>
        {/* Spacer mirroring the close button keeps the title centred. */}
        <View className="w-[38px]" />
      </View>
      <ProgressTrack fraction={files.length > 0 ? settled / files.length : 0} />

      <ScrollView
        className="flex-1"
        contentContainerClassName="w-full max-w-[560px] self-center gap-4 p-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        <Animated.View
          layout={LAYOUT}
          className="overflow-hidden rounded-[20px] bg-card py-1"
          style={CONTINUOUS}
        >
          {prefill ? (
            // The scan is done — the list folds into a one-line receipt so
            // the review cards own the screen.
            <Animated.View
              entering={springIn()}
              className="flex-row items-center gap-3 px-4 py-[10px]"
            >
              <View className="flex-row">
                {files.slice(0, 3).map((state, index) =>
                  isImageSource(state.source) ? (
                    <Image
                      key={state.source.uri}
                      source={{ uri: state.source.uri }}
                      style={[receiptThumb, index > 0 && { marginLeft: -10 }]}
                      contentFit="cover"
                    />
                  ) : (
                    <View
                      key={state.source.uri}
                      className="items-center justify-center"
                      style={[receiptThumb, index > 0 && { marginLeft: -10 }]}
                    >
                      <Icon name="doc.text" size={14} tintColor={mutedForeground} />
                    </View>
                  ),
                )}
              </View>
              <Text className="flex-1 text-sm font-medium text-foreground">
                {parsedCount === 1 ? t`1 file scanned` : t`${parsedCount} files scanned`}
              </Text>
              <Icon name="checkmark.circle.fill" size={18} tintColor={profit} />
            </Animated.View>
          ) : (
            files.map((state, index) => (
              <FileRow key={state.source.uri} state={state} index={index} />
            ))
          )}
        </Animated.View>

        {parsing ? (
          <Animated.View entering={springIn(200)}>
            <Text className="px-1 text-[13px] leading-[18px] text-muted-foreground">
              {t`Reading ${settled} of ${files.length}… Screenshots are parsed by your vision endpoint; CSV and JSON parse on this device.`}
            </Text>
          </Animated.View>
        ) : null}

        {nothingParsed ? (
          <Animated.View entering={springIn()}>
            <Text className="px-1 text-[13px] leading-[18px] text-muted-foreground">
              {t`Nothing could be read from these files. Check your AI endpoint under Settings → AI, or try clearer screenshots.`}
            </Text>
          </Animated.View>
        ) : null}

        {prefill ? (
          <>
            <Animated.Text
              entering={springUp(80)}
              className="pl-4 text-xs font-semibold uppercase tracking-[0.6px] text-muted-foreground"
            >
              {prefill.blocks.length === 1
                ? t`1 symbol found`
                : t`${prefill.blocks.length} symbols found`}
            </Animated.Text>
            {prefill.blocks.map((block, index) => (
              <Animated.View key={block.key} entering={springUp(140 + index * 90)}>
                <BlockSummary block={block} currency={currency} />
              </Animated.View>
            ))}
            {prefill.warnings.length > 0 ? (
              <Animated.View
                entering={springUp(140 + prefill.blocks.length * 90)}
                className="gap-2 rounded-[20px] bg-card p-4"
                style={CONTINUOUS}
              >
                {prefill.warnings.map((warning, index) => (
                  <View key={index} className="flex-row items-start gap-2">
                    <Icon name="exclamationmark.triangle.fill" size={13} tintColor={flat} />
                    <Text className="flex-1 text-[13px] leading-[18px] text-flat">{warning}</Text>
                  </View>
                ))}
              </Animated.View>
            ) : null}
            <Animated.Text
              entering={springUp(220 + prefill.blocks.length * 90)}
              className="px-1 text-[13px] leading-[18px] text-muted-foreground"
            >
              {t`Every field stays editable in the form — check quantities and times against your broker before saving.`}
            </Animated.Text>
          </>
        ) : null}
      </ScrollView>

      <View className="px-4 pt-2" style={{ paddingBottom: insets.bottom + 12 }}>
        {prefill ? (
          <Animated.View entering={springUp(260)}>
            <Button size="md" className="rounded-3xl" fullWidth onPress={() => onApply(prefill.blocks)}>
              {t`Fill form`}
            </Button>
          </Animated.View>
        ) : nothingParsed ? (
          <GlassButton label={t`Close`} fill onPress={onClose} />
        ) : null}
      </View>
    </Animated.View>
  );
}
