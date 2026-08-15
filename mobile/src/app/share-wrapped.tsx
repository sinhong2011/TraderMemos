import * as Sharing from 'expo-sharing';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Chip, Spinner, Switch } from 'panelui-native';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { useCSSVariable } from 'uniwind';

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
import { PnlFill } from '@/styles/pnl';

/**
 * Year Wrapped share preview (#198) — the share-trade sheet's twin. Same
 * honesty contract: the on-screen card is the capture, and amounts stay off
 * until the sharer opts in.
 */
export default function ShareWrappedScreen() {
  const [background] = useCSSVariable(['--color-background']) as [string];
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
    classic: background,
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
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="gap-4 p-4 pb-12 pt-6"
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-[20px] font-bold text-foreground">{t`Share card`}</Text>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          className="p-1 active:opacity-60"
        >
          <Text className="text-[15px] font-semibold text-foreground">{t`Done`}</Text>
        </Pressable>
      </View>

      {trades.isLoading ? (
        <Skeleton className="h-[280px] rounded-[18px]" />
      ) : trades.error && trades.data == null ? (
        // Only when the cache has nothing either — a card built from stale
        // trades still shares.
        <View className="h-[280px]">
          <ErrorState
            error={trades.error}
            onRetry={() => void trades.refetch()}
            retrying={trades.isRefetching}
          />
        </View>
      ) : wrapped.totalTrades === 0 ? (
        <Text className="text-center text-muted-foreground">{t`No closed trades in ${year}`}</Text>
      ) : (
        <>
          {/* The card paints its own background; a muted mat separates it from
              the sheet so the capture's edges read. */}
          <View
            className="items-center rounded-[18px] bg-muted py-4"
            style={{ borderCurve: 'continuous' }}
          >
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

          <View className="flex-row justify-center gap-2">
            {SHARE_CARD_STYLES.map((id) => {
              const selected = id === effectiveStyle;
              return (
                <Chip
                  key={id}
                  // `variant`, not Chip's own `selected` fill: this theme's
                  // accent is quieter than the default chip ground, so the
                  // chosen style would read as the unchosen one.
                  variant={selected ? 'primary' : 'default'}
                  onPress={() => setCardStyle(id)}
                  accessibilityState={{ selected }}
                  start={
                    // Hairline keeps same-ground swatches (paper-on-light,
                    // midnight-on-dark) readable; interactive controls may
                    // carry borders.
                    <View
                      className="h-[14px] w-[14px] rounded-full border-border"
                      style={{
                        backgroundColor: swatchColor[id],
                        borderWidth: StyleSheet.hairlineWidth,
                      }}
                    />
                  }
                >
                  {shareCardStyleLabel(id)}
                </Chip>
              );
            })}
          </View>

          <View className={OPTION_ROW}>
            <View className={OPTION_TEXT}>
              <Text className={OPTION_LABEL}>{t`Show amounts`}</Text>
              <Text className={OPTION_HINT}>
                {t`Off by default — the card shows win rate and ratios only.`}
              </Text>
            </View>
            <Switch
              value={showAmounts}
              onValueChange={setShowAmounts}
              label={t`Show amounts`}
            />
          </View>

          <View className={OPTION_ROW}>
            <View className={OPTION_TEXT}>
              <Text className={OPTION_LABEL}>{t`TraderMemos mark`}</Text>
              <Text className={OPTION_HINT}>{t`A small wordmark in the card corner.`}</Text>
            </View>
            <Switch
              value={effectiveShowMark}
              onValueChange={setShowMark}
              label={t`TraderMemos mark`}
            />
          </View>

          <View className="items-center">
            {sharing ? (
              <Spinner />
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

const OPTION_ROW = 'flex-row items-center gap-3';
const OPTION_TEXT = 'flex-1 gap-[2px]';
const OPTION_LABEL = 'text-[15px] font-medium text-foreground';
const OPTION_HINT = 'text-xs text-muted-foreground';
