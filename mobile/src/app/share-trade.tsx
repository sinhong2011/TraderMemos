import * as Sharing from 'expo-sharing';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Chip, Spinner, Switch } from 'panelui-native';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { useCSSVariable } from 'uniwind';

import { useTrade } from '@/api/hooks';
import { ErrorState } from '@/components/error-state';
import { GlassButton, GlassIconButton } from '@/components/glass-button';
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
import { PnlFill } from '@/styles/pnl';

/**
 * Share preview: the actual card, at the size it will be captured, with the
 * amounts switch — you see exactly what leaves the device before it does.
 * Capturing the on-screen card (rather than an off-screen clone) is what makes
 * the preview honest.
 */
export default function ShareTradeScreen() {
  const [background] = useCSSVariable(['--color-background']) as [string];
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
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="gap-4 p-4 pb-12 pt-6"
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-[20px] font-bold text-foreground">{t`Share card`}</Text>
        <GlassIconButton systemImage="xmark" label={t`Close`} onPress={() => router.back()} />
      </View>

      {trade.isLoading ? (
        <Skeleton className="h-[280px] rounded-[18px]" />
      ) : trade.error && !trade.data ? (
        // Only when the cache has nothing either — a card built from a stale
        // trade still shares. The sheet's content root is the ScrollView, which
        // hands children no height, so the failure needs an explicit slot.
        <View className="h-[280px]">
          <ErrorState
            error={trade.error}
            onRetry={() => void trade.refetch()}
            retrying={trade.isRefetching}
          />
        </View>
      ) : !trade.data ? (
        <Text className="text-center text-muted-foreground">{t`Trade not found`}</Text>
      ) : (
        <>
          {/* The card paints its own background; a muted mat separates it from
              the sheet so the capture's edges read. */}
          <View
            className="items-center rounded-[18px] bg-muted py-4"
            style={{ borderCurve: 'continuous' }}
          >
            <ShareCardView
              ref={cardRef}
              trade={trade.data}
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
                {t`Off by default — the card shows R and return % only.`}
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
