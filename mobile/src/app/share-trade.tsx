import * as Sharing from 'expo-sharing';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useTrade } from '@/api/hooks';
import { ErrorState } from '@/components/error-state';
import { GlassButton } from '@/components/glass-button';
import {
  SHARE_CARD_STYLES,
  ShareCardView,
  shareCardStyleLabel,
  type ShareCardStyleId,
} from '@/components/share-card';
import { Skeleton } from '@/components/skeleton';
import { t } from '@lingui/core/macro';
import { errorMessage } from '@/lib/errors';
import { useProGate } from '@/lib/pro-gate';
import { PnlFill } from '@/styles/unistyles';

/**
 * Share preview: the actual card, at the size it will be captured, with the
 * amounts switch — you see exactly what leaves the device before it does.
 * Capturing the on-screen card (rather than an off-screen clone) is what makes
 * the preview honest.
 */
export default function ShareTradeScreen() {
  const { theme } = useUnistyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const trade = useTrade(id ?? '');
  const cardRef = useRef<View>(null);
  const [showAmounts, setShowAmounts] = useState(false);
  const [cardStyle, setCardStyle] = useState<ShareCardStyleId>('classic');
  const [showMark, setShowMark] = useState(true);
  const [sharing, setSharing] = useState(false);

  // Pro seam (docs/mobile-monetization-plan.md): styles beyond Classic and
  // mark removal are the Pro candidates; the capability itself stays free.
  const stylesUnlocked = useProGate('share-card-styles');
  const hideMarkUnlocked = useProGate('share-card-hide-mark');
  const effectiveStyle = stylesUnlocked ? cardStyle : 'classic';
  const effectiveShowMark = hideMarkUnlocked ? showMark : true;

  // Swatch dots for the picker; signal's fill is outcome-driven on the card,
  // so its swatch shows the brand-blue "open" fill as the representative hue.
  const swatchColor: Record<ShareCardStyleId, string> = {
    classic: theme.colors.background,
    midnight: '#0E1116',
    paper: '#FFFFFF',
    signal: PnlFill.open,
  };

  async function share() {
    setSharing(true);
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile' });
      await Sharing.shareAsync(`file://${uri.replace(/^file:\/\//, '')}`, {
        mimeType: 'image/png',
        dialogTitle: t`Share trade`,
      });
    } catch (err) {
      Alert.alert(t`Could not share`, errorMessage(err));
    } finally {
      setSharing(false);
    }
  }

  return (
    // Form sheets lay non-scroll children on top of each other — the sheet's
    // content root must be a ScrollView.
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{t`Share card`}</Text>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}
        >
          <Text style={styles.doneLabel}>{t`Done`}</Text>
        </Pressable>
      </View>

      {trade.isLoading ? (
        <Skeleton style={styles.cardSkeleton} />
      ) : trade.error && !trade.data ? (
        // Only when the cache has nothing either — a card built from a stale
        // trade still shares. The sheet's content root is the ScrollView, which
        // hands children no height, so the failure needs an explicit slot.
        <View style={styles.failure}>
          <ErrorState
            error={trade.error}
            onRetry={() => void trade.refetch()}
            retrying={trade.isRefetching}
          />
        </View>
      ) : !trade.data ? (
        <Text style={styles.muted}>{t`Trade not found`}</Text>
      ) : (
        <>
          <View style={styles.preview}>
            <ShareCardView
              ref={cardRef}
              trade={trade.data}
              showAmounts={showAmounts}
              cardStyle={effectiveStyle}
              showMark={effectiveShowMark}
            />
          </View>

          <View style={styles.stylePicker}>
            {SHARE_CARD_STYLES.map((id) => {
              const selected = id === effectiveStyle;
              return (
                <Pressable
                  key={id}
                  onPress={() => setCardStyle(id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.styleChip,
                    selected && styles.styleChipSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.swatch, { backgroundColor: swatchColor[id] }]} />
                  <Text style={[styles.styleLabel, selected && styles.styleLabelSelected]}>
                    {shareCardStyleLabel(id)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.optionRow}>
            <View style={styles.optionText}>
              <Text style={styles.optionLabel}>{t`Show amounts`}</Text>
              <Text style={styles.optionHint}>
                {t`Off by default — the card shows R and return % only.`}
              </Text>
            </View>
            <Switch
              value={showAmounts}
              onValueChange={setShowAmounts}
              trackColor={{ true: theme.colors.primary }}
            />
          </View>

          <View style={styles.optionRow}>
            <View style={styles.optionText}>
              <Text style={styles.optionLabel}>{t`TraderMemos mark`}</Text>
              <Text style={styles.optionHint}>{t`A small wordmark in the card corner.`}</Text>
            </View>
            <Switch
              value={effectiveShowMark}
              onValueChange={setShowMark}
              trackColor={{ true: theme.colors.primary }}
            />
          </View>

          <View style={styles.action}>
            {sharing ? (
              <ActivityIndicator />
            ) : (
              <GlassButton
                prominent
                label={t`Share`}
                systemImage="square.and.arrow.up"
                onPress={() => void share()}
              />
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  page: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xl * 2,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: '700', color: theme.colors.foreground },
  doneButton: { paddingVertical: 4, paddingHorizontal: 4 },
  pressed: { opacity: 0.6 },
  doneLabel: { fontSize: 15, fontWeight: '600', color: theme.colors.foreground },
  // The card paints its own background; a muted mat separates it from the
  // sheet so the capture's edges read.
  preview: {
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.radius.lg + 4,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.muted,
  },
  stylePicker: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  styleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingVertical: 6,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.muted,
  },
  styleChipSelected: { backgroundColor: theme.colors.primary },
  // Hairline keeps same-ground swatches (paper-on-light, midnight-on-dark)
  // readable; interactive controls may carry borders.
  swatch: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  styleLabel: { fontSize: 13, fontWeight: '600', color: theme.colors.foreground },
  styleLabelSelected: { color: theme.colors.primaryForeground },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  optionText: { flex: 1, gap: 2 },
  optionLabel: { fontSize: 15, fontWeight: '500', color: theme.colors.foreground },
  optionHint: { fontSize: 12, color: theme.colors.mutedForeground },
  action: { alignItems: 'center' },
  cardSkeleton: { height: 280, borderRadius: theme.radius.lg + 4 },
  failure: { height: 280 },
  muted: { color: theme.colors.mutedForeground, textAlign: 'center' },
}));
