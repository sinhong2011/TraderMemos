import { Image } from 'expo-image';
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
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Icon } from '@/components/icon';
import { useApiRaw } from '@/api/hooks';
import type { TradeExtract } from '@/api/types';
import { AppHost } from '@/components/app-host';
import { CenteredButton } from '@/components/centered-button';
import { GlassButton, GlassIconButton } from '@/components/glass-button';
import { BlockSummary } from '@/components/trade-summary';
import { t } from '@lingui/core/macro';
import { errorMessage } from '@/lib/errors';
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
  return <Animated.View style={[styles.beam, style]} />;
}

function StatusGlyph({ status }: { status: FileStatus }) {
  const { theme } = useUnistyles();
  switch (status) {
    case 'pending':
      return <Icon name="clock" size={16} tintColor={theme.colors.mutedForeground} />;
    case 'parsing':
      return <ActivityIndicator size="small" color={theme.colors.mutedForeground} />;
    case 'done':
      return <Icon name="checkmark.circle.fill" size={18} tintColor={theme.colors.profit} />;
    case 'error':
      return (
        <Icon name="exclamationmark.circle.fill" size={18} tintColor={theme.colors.loss} />
      );
  }
}

/** One picked file: thumbnail (beam while scanning), name, live status. */
function FileRow({ state, index }: { state: FileState; index: number }) {
  const { theme } = useUnistyles();
  const failed = state.status === 'error';
  const scanning = state.status === 'parsing';
  return (
    <Animated.View entering={springIn(index * 70)} style={styles.fileRow}>
      <View style={styles.thumbWrap}>
        {isImageSource(state.source) ? (
          <Image source={{ uri: state.source.uri }} style={styles.fileThumb} contentFit="cover" />
        ) : (
          <View style={styles.fileDoc}>
            <Icon name="doc.text" size={20} tintColor={theme.colors.mutedForeground} />
          </View>
        )}
        {scanning ? <ScanBeam travel={40} /> : null}
      </View>
      <View style={styles.fileMeta}>
        <Text style={styles.fileName} numberOfLines={1}>
          {state.source.name}
        </Text>
        <Text style={[styles.fileStatus, failed && styles.fileStatusError]} numberOfLines={2}>
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
      style={styles.progressTrack}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <Animated.View style={[styles.progressFill, fill]} />
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
  const { theme } = useUnistyles();
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
      style={[styles.overlay, { paddingTop: insets.top + 8 }]}
    >
      <View style={styles.header}>
        <GlassIconButton systemImage="xmark" label={t`Cancel`} onPress={onClose} />
        <Text style={styles.title}>{prefill ? t`Review import` : t`Scan to fill`}</Text>
        {/* Spacer mirroring the close button keeps the title centred. */}
        <View style={styles.headerSpacer} />
      </View>
      <ProgressTrack fraction={files.length > 0 ? settled / files.length : 0} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      >
        <Animated.View layout={LAYOUT} style={styles.card}>
          {prefill ? (
            // The scan is done — the list folds into a one-line receipt so
            // the review cards own the screen.
            <Animated.View entering={springIn()} style={styles.receiptRow}>
              <View style={styles.receiptThumbs}>
                {files.slice(0, 3).map((state, index) =>
                  isImageSource(state.source) ? (
                    <Image
                      key={state.source.uri}
                      source={{ uri: state.source.uri }}
                      style={[styles.receiptThumb, index > 0 && styles.receiptThumbStacked]}
                      contentFit="cover"
                    />
                  ) : (
                    <View
                      key={state.source.uri}
                      style={[
                        styles.receiptThumb,
                        styles.fileDocFill,
                        index > 0 && styles.receiptThumbStacked,
                      ]}
                    >
                      <Icon
                        name="doc.text"
                        size={14}
                        tintColor={theme.colors.mutedForeground}
                      />
                    </View>
                  ),
                )}
              </View>
              <Text style={styles.receiptLabel}>
                {parsedCount === 1 ? t`1 file scanned` : t`${parsedCount} files scanned`}
              </Text>
              <Icon
                name="checkmark.circle.fill"
                size={18}
                tintColor={theme.colors.profit}
              />
            </Animated.View>
          ) : (
            files.map((state, index) => (
              <FileRow key={state.source.uri} state={state} index={index} />
            ))
          )}
        </Animated.View>

        {parsing ? (
          <Animated.View entering={springIn(200)}>
            <Text style={styles.footnote}>
              {t`Reading ${settled} of ${files.length}… Screenshots are parsed by your vision endpoint; CSV and JSON parse on this device.`}
            </Text>
          </Animated.View>
        ) : null}

        {nothingParsed ? (
          <Animated.View entering={springIn()}>
            <Text style={styles.footnote}>
              {t`Nothing could be read from these files. Check your AI endpoint under Settings → AI, or try clearer screenshots.`}
            </Text>
          </Animated.View>
        ) : null}

        {prefill ? (
          <>
            <Animated.Text entering={springUp(80)} style={styles.sectionTitle}>
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
                style={styles.warningsCard}
              >
                {prefill.warnings.map((warning, index) => (
                  <View key={index} style={styles.warningRow}>
                    <Icon
                      name="exclamationmark.triangle.fill"
                      size={13}
                      tintColor={theme.colors.flat}
                    />
                    <Text style={styles.warningText}>{warning}</Text>
                  </View>
                ))}
              </Animated.View>
            ) : null}
            <Animated.Text
              entering={springUp(220 + prefill.blocks.length * 90)}
              style={styles.footnote}
            >
              {t`Every field stays editable in the form — check quantities and times against your broker before saving.`}
            </Animated.Text>
          </>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {prefill ? (
          <Animated.View entering={springUp(260)}>
            {/* The settings-form action idiom; hosted here since the footer
                is an RN view, not a Form (width from the stretched host). */}
            <AppHost matchContents={{ vertical: true }} style={styles.actionHost}>
              <CenteredButton label={t`Fill form`} onPress={() => onApply(prefill.blocks)} />
            </AppHost>
          </Animated.View>
        ) : nothingParsed ? (
          <GlassButton label={t`Close`} fill onPress={onClose} />
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create((theme) => ({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.md,
  },
  headerSpacer: { width: 38 },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.foreground,
  },
  progressTrack: {
    height: 3,
    marginHorizontal: theme.spacing.lg,
    borderRadius: 2,
    backgroundColor: theme.colors.muted,
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.colors.primary,
  },
  scroll: { flex: 1 },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    maxWidth: theme.measure.form,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    borderRadius: theme.radius.lg + 6,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.card,
    paddingVertical: theme.spacing.xs,
    overflow: 'hidden',
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm + 2,
  },
  thumbWrap: {
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  fileThumb: {
    width: 44,
    height: 44,
    backgroundColor: theme.colors.muted,
  },
  fileDoc: {
    width: 44,
    height: 44,
    backgroundColor: theme.colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileDocFill: {
    backgroundColor: theme.colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  beam: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.primary,
    opacity: 0.9,
  },
  fileMeta: { flex: 1, gap: 2 },
  fileName: { fontSize: 15, color: theme.colors.foreground },
  fileStatus: { fontSize: 12, color: theme.colors.mutedForeground },
  fileStatusError: { color: theme.colors.loss },
  receiptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm + 2,
  },
  receiptThumbs: { flexDirection: 'row' },
  receiptThumb: {
    width: 28,
    height: 28,
    borderRadius: theme.radius.sm + 2,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.muted,
    borderWidth: 1.5,
    borderColor: theme.colors.card,
  },
  receiptThumbStacked: { marginLeft: -10 },
  receiptLabel: { flex: 1, fontSize: 14, fontWeight: '500', color: theme.colors.foreground },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: theme.colors.mutedForeground,
    paddingLeft: theme.spacing.lg,
  },
  warningsCard: {
    borderRadius: theme.radius.lg + 6,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.card,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  warningRow: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm },
  warningText: { flex: 1, fontSize: 13, lineHeight: 18, color: theme.colors.flat },
  footnote: {
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.mutedForeground,
    paddingHorizontal: theme.spacing.xs,
  },
  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  actionHost: { alignSelf: 'stretch' },
}));
