import * as Sharing from 'expo-sharing';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useAccounts, useTrades } from '@/api/hooks';
import { ErrorState } from '@/components/error-state';
import { GlassButton } from '@/components/glass-button';
import {
  SHARE_CARD_STYLES,
  WrappedShareCardView,
  shareCardStyleLabel,
  type ShareCardStyleId,
} from '@/components/share-card';
import { Skeleton } from '@/components/skeleton';
import { t } from '@lingui/core/macro';
import { useSelectedAccountId } from '@/lib/account-store';
import { errorMessage } from '@/lib/errors';
import { useMoneyFx } from '@/lib/money';
import { accountBaseCurrency } from '@/lib/prefs';
import { useProGate } from '@/lib/pro-gate';
import { computeYearWrapped } from '@/lib/wrapped';
import { PnlFill } from '@/styles/unistyles';

/**
 * Year Wrapped share preview (#198) — the share-trade sheet's twin. Same
 * honesty contract: the on-screen card is the capture, and amounts stay off
 * until the sharer opts in.
 */
export default function ShareWrappedScreen() {
  const { theme } = useUnistyles();
  const params = useLocalSearchParams<{ year: string }>();
  const year = Number.parseInt(params.year ?? '', 10);
  const router = useRouter();
  const selectedAccountId = useSelectedAccountId();
  const trades = useTrades({
    ...(selectedAccountId ? { account_id: selectedAccountId } : {}),
    from: `${year}-01-01T00:00:00Z`,
    to: `${year + 1}-01-01T00:00:00Z`,
  });
  const accounts = useAccounts();
  const fx = useMoneyFx(accountBaseCurrency(accounts.data, selectedAccountId));
  const wrapped = useMemo(() => computeYearWrapped(trades.data ?? [], year), [trades.data, year]);
  const cardRef = useRef<View>(null);
  const [showAmounts, setShowAmounts] = useState(false);
  const [cardStyle, setCardStyle] = useState<ShareCardStyleId>('classic');
  const [showMark, setShowMark] = useState(true);
  const [sharing, setSharing] = useState(false);

  // Same Pro seam as share-trade: extra styles and mark removal are the
  // candidates; the capability itself stays free.
  const stylesUnlocked = useProGate('share-card-styles');
  const hideMarkUnlocked = useProGate('share-card-hide-mark');
  const effectiveStyle = stylesUnlocked ? cardStyle : 'classic';
  const effectiveShowMark = hideMarkUnlocked ? showMark : true;

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
        dialogTitle: t`Share Year Wrapped`,
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

      {trades.isLoading ? (
        <Skeleton style={styles.cardSkeleton} />
      ) : trades.error && trades.data == null ? (
        // Only when the cache has nothing either — a card built from stale
        // trades still shares.
        <View style={styles.failure}>
          <ErrorState
            error={trades.error}
            onRetry={() => void trades.refetch()}
            retrying={trades.isRefetching}
          />
        </View>
      ) : wrapped.totalTrades === 0 ? (
        <Text style={styles.muted}>{t`No closed trades in ${year}`}</Text>
      ) : (
        <>
          <View style={styles.preview}>
            <WrappedShareCardView
              ref={cardRef}
              wrapped={wrapped}
              currency={fx.currency}
              fxRate={fx.rate ?? 1}
              inProgress={year === new Date().getFullYear()}
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
                {t`Off by default — the card shows win rate and ratios only.`}
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
