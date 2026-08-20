import { useRouter } from 'expo-router';
import { cn } from 'panelui-native';
import { useEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { useAccounts, useCash, useSummary } from '@/api/hooks';
import { CenteredButton } from '@/components/centered-button';
import { GlassIconButton } from '@/components/glass-button';
import { BlockSummary } from '@/components/trade-summary';
import { t } from '@lingui/core/macro';
import { formatPercentPoints, useFormatters } from '@/lib/format';
import { useSaveTradeBlocks } from '@/lib/save-trades';
import { clearTradeDraft, peekTradeDraft } from '@/lib/trade-draft';
import {
  effectiveMultiplier,
  isValidFill,
  parseAmount,
  type TradeFormValues,
} from '@/lib/trade-form';
import { aggregateTradePnlPreviews, blockPnlPreview } from '@/lib/trade-pnl-preview';
import { pnlClass, usePnlPalette } from '@/styles/pnl';

/** Squircle corners on the batch card — no Tailwind utility maps to this. */
const CONTINUOUS = { borderCurve: 'continuous' } as const;

/** Shared caption above every figure in the batch card. */
const STAT_LABEL = 'text-[11px] font-semibold uppercase tracking-[0.5px] text-muted-foreground';
const STAT_VALUE = 'text-[15px] font-semibold tabular-nums text-foreground';

/** Opening-side cost basis across the batch — denominator for the return %. */
function entryTotal(blocks: TradeFormValues[]): number {
  let total = 0;
  for (const block of blocks) {
    const openSide = block.direction === 'long' ? 'buy' : 'sell';
    const mult = effectiveMultiplier(block) || 1;
    for (const fill of block.fills) {
      if (fill.side !== openSide || !isValidFill(fill)) continue;
      total += (parseAmount(fill.quantity) ?? 0) * (parseAmount(fill.price) ?? 0) * mult;
    }
  }
  return total;
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="gap-0.5">
      <Text className={STAT_LABEL}>{label}</Text>
      {children}
    </View>
  );
}

/**
 * "Review & save" — a real pushed page between the form and the commit (the
 * header action on the form reads Preview, Save lives here). One summary card
 * per symbol, then the batch result and what the account looks like after the
 * save lands. The draft rides the in-memory stash, not router params (see
 * lib/trade-draft.ts).
 */
export default function TradePreviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profit } = usePnlPalette();
  // Formatters bound to the display prefs (see lib/format.ts).
  const { formatCurrency, formatPnl } = useFormatters();

  const draft = peekTradeDraft();
  const { data: accounts } = useAccounts();
  // Baseline the account so the batch delta can be projected onto it — the
  // web drawer's "After save" strip (headerStats.ts: cash = deposits + netPnl).
  const summary = useSummary(draft ? { account_id: draft.accountId } : {});
  const cash = useCash(draft ? { account_id: draft.accountId } : {});

  const save = useSaveTradeBlocks(accounts, () => {
    clearTradeDraft();
    // Pop the preview and the form together — back to wherever + was tapped.
    router.dismiss(2);
  });

  // Opened cold (deep link, state loss): nothing to preview.
  useEffect(() => {
    if (!draft) router.back();
  }, [draft, router]);
  if (!draft) return null;
  const { blocks, accountName, currency } = draft;

  const batch = aggregateTradePnlPreviews(blocks.map(blockPnlPreview));
  const priced = batch.closedCount + batch.openCount;
  const dividends = blocks.filter((block) => (parseAmount(block.dividendAmount) ?? 0) > 0).length;
  const screenshots = blocks.reduce((sum, block) => sum + block.screenshots.length, 0);

  const basis = entryTotal(blocks);
  const returnPct = batch.net != null && basis > 0 ? (batch.net / basis) * 100 : null;

  const deposits = (cash.data ?? []).reduce((sum, tx) => sum + tx.amount, 0);
  const baselinePnl = summary.data?.net_pnl;
  const delta = batch.net ?? 0;
  const pnlAfter = baselinePnl != null ? baselinePnl + delta : null;
  const balanceAfter = baselinePnl != null ? deposits + baselinePnl + delta : null;
  const pnlPctAfter = pnlAfter != null && deposits > 0 ? (pnlAfter / deposits) * 100 : null;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top + 8 }}>
      <View className="flex-row items-center gap-3 px-4 pb-3">
        <GlassIconButton systemImage="chevron.backward" label={t`Back`} onPress={router.back} />
        <Text className="flex-1 text-center text-[17px] font-semibold text-foreground">{t`Review & save`}</Text>
        {/* Spacer mirroring the back button keeps the title centred. */}
        <View className="w-[38px]" />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="w-full max-w-[560px] self-center gap-4 p-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {accountName ? (
          <Text className="pl-1 text-[13px] text-muted-foreground">{t`Logging into ${accountName}`}</Text>
        ) : null}
        {blocks.map((block) => (
          <BlockSummary
            key={block.key}
            block={block}
            currency={currency}
            setups={draft.setups}
            tags={draft.tags}
          />
        ))}

        {priced > 0 ? (
          <View className="gap-3 rounded-[20px] bg-card p-4" style={CONTINUOUS}>
            <View className="gap-0.5">
              <Text className={STAT_LABEL}>{t`Est. P&L`}</Text>
              {batch.net != null ? (
                <View className="flex-row items-baseline gap-2">
                  <Text className={cn('text-[28px] font-bold tabular-nums', pnlClass(batch.net))}>
                    {formatPnl(batch.net, currency)}
                  </Text>
                  {returnPct != null ? (
                    <Text className="text-[13px] font-semibold tabular-nums text-muted-foreground">
                      {formatPercentPoints(returnPct, 1)}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <Text className="text-[28px] font-bold text-muted-foreground">{t`Open`}</Text>
              )}
            </View>
            <View className="flex-row gap-6">
              <Stat label={t`Symbols`}>
                <Text className={STAT_VALUE}>{batch.symbolCount}</Text>
              </Stat>
              <Stat label={t`Fees`}>
                <Text className={STAT_VALUE}>{formatCurrency(batch.feesTotal, currency)}</Text>
              </Stat>
              <Stat label={t`Closed`}>
                <View className="flex-row items-center gap-1">
                  <Text className={STAT_VALUE}>
                    {batch.closedCount}/{priced}
                  </Text>
                  {batch.closedCount === priced ? (
                    <Icon name="checkmark.circle.fill" size={13} tintColor={profit} />
                  ) : null}
                </View>
              </Stat>
            </View>

            {pnlAfter != null ? (
              <View className="mt-1 gap-2 border-t-[0.5px] border-border pt-3">
                <Text className="text-[11px] font-semibold uppercase tracking-[0.5px] text-flat">{t`After save`}</Text>
                <View className="flex-row gap-6">
                  <Stat label={t`Account P&L`}>
                    <View className="flex-row items-center gap-1">
                      <Text className={cn(STAT_VALUE, pnlClass(pnlAfter))}>
                        {formatPnl(pnlAfter, currency)}
                      </Text>
                      {pnlPctAfter != null ? (
                        <Text className="text-xs font-medium tabular-nums text-muted-foreground">
                          {formatPercentPoints(pnlPctAfter, 1)}
                        </Text>
                      ) : null}
                    </View>
                  </Stat>
                  <Stat label={t`Balance`}>
                    <Text className={STAT_VALUE}>
                      {balanceAfter != null ? formatCurrency(balanceAfter, currency) : t`None`}
                    </Text>
                  </Stat>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {dividends > 0 || screenshots > 0 ? (
          <Text className="px-1 text-[13px] leading-[18px] text-muted-foreground">
            {[
              dividends > 0 ? t`Includes a dividend entry.` : '',
              screenshots > 0
                ? screenshots === 1
                  ? t`1 screenshot uploads after saving.`
                  : t`${screenshots} screenshots upload after saving.`
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
          </Text>
        ) : null}
      </ScrollView>

      {/* The settings-form action idiom. `CenteredButton` fills the row itself
          now, so the footer only owns the insets around it. */}
      <View className="px-4 pt-2" style={{ paddingBottom: insets.bottom + 12 }}>
        <CenteredButton
          label={save.isPending ? t`Saving…` : t`Save trade`}
          loading={save.isPending}
          onPress={() => save.mutate(blocks)}
        />
      </View>
    </View>
  );
}
