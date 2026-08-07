import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useAccounts, useCash, useSummary } from '@/api/hooks';
import { GlassButton, GlassIconButton } from '@/components/glass-button';
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
import { pnlColor } from '@/styles/unistyles';

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
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
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
  const { theme } = useUnistyles();
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
    <View style={[styles.page, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <GlassIconButton systemImage="chevron.backward" label={t`Back`} onPress={router.back} />
        <Text style={styles.title}>{t`Review & save`}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      >
        {accountName ? <Text style={styles.accountLine}>{t`Logging into ${accountName}`}</Text> : null}
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
          <View style={styles.batchCard}>
            <View style={styles.batchMain}>
              <Text style={styles.statLabel}>{t`Est. P&L`}</Text>
              {batch.net != null ? (
                <View style={styles.batchNetRow}>
                  <Text style={[styles.batchNet, { color: pnlColor(theme.colors, batch.net) }]}>
                    {formatPnl(batch.net, currency)}
                  </Text>
                  {returnPct != null ? (
                    <Text style={styles.batchNetPct}>{formatPercentPoints(returnPct, 1)}</Text>
                  ) : null}
                </View>
              ) : (
                <Text style={styles.batchNetMuted}>{t`Open`}</Text>
              )}
            </View>
            <View style={styles.batchStats}>
              <Stat label={t`Symbols`}>
                <Text style={styles.statValue}>{batch.symbolCount}</Text>
              </Stat>
              <Stat label={t`Fees`}>
                <Text style={styles.statValue}>{formatCurrency(batch.feesTotal, currency)}</Text>
              </Stat>
              <Stat label={t`Closed`}>
                <View style={styles.closedRow}>
                  <Text style={styles.statValue}>
                    {batch.closedCount}/{priced}
                  </Text>
                  {batch.closedCount === priced ? (
                    <SymbolView
                      name="checkmark.circle.fill"
                      size={13}
                      tintColor={theme.colors.profit}
                    />
                  ) : null}
                </View>
              </Stat>
            </View>

            {pnlAfter != null ? (
              <View style={styles.afterSave}>
                <Text style={styles.afterSaveTitle}>{t`After save`}</Text>
                <View style={styles.batchStats}>
                  <Stat label={t`Account P&L`}>
                    <View style={styles.closedRow}>
                      <Text
                        style={[styles.statValue, { color: pnlColor(theme.colors, pnlAfter) }]}
                      >
                        {formatPnl(pnlAfter, currency)}
                      </Text>
                      {pnlPctAfter != null ? (
                        <Text style={styles.afterSavePct}>
                          {formatPercentPoints(pnlPctAfter, 1)}
                        </Text>
                      ) : null}
                    </View>
                  </Stat>
                  <Stat label={t`Balance`}>
                    <Text style={styles.statValue}>
                      {balanceAfter != null ? formatCurrency(balanceAfter, currency) : t`None`}
                    </Text>
                  </Stat>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {dividends > 0 || screenshots > 0 ? (
          <Text style={styles.footnote}>
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

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <GlassButton
          label={save.isPending ? t`Saving…` : t`Save trade`}
          systemImage="checkmark"
          prominent
          fill
          disabled={save.isPending}
          onPress={() => save.mutate(blocks)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  page: { flex: 1, backgroundColor: theme.colors.background },
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
  scroll: { flex: 1 },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    maxWidth: theme.measure.form,
    width: '100%',
    alignSelf: 'center',
  },
  accountLine: { fontSize: 13, color: theme.colors.mutedForeground, paddingLeft: theme.spacing.xs },
  batchCard: {
    borderRadius: theme.radius.lg + 6,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.card,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  batchMain: { gap: 2 },
  batchNetRow: { flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing.sm },
  batchNet: { fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] },
  batchNetPct: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.mutedForeground,
    fontVariant: ['tabular-nums'],
  },
  batchNetMuted: { fontSize: 28, fontWeight: '700', color: theme.colors.mutedForeground },
  batchStats: { flexDirection: 'row', gap: theme.spacing.xl },
  stat: { gap: 2 },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: theme.colors.mutedForeground,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.foreground,
    fontVariant: ['tabular-nums'],
  },
  closedRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  afterSave: {
    marginTop: theme.spacing.xs,
    paddingTop: theme.spacing.md,
    borderTopWidth: 0.5,
    borderTopColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  afterSaveTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: theme.colors.flat,
  },
  afterSavePct: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.mutedForeground,
    fontVariant: ['tabular-nums'],
  },
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
}));
