import { SymbolView } from 'expo-symbols';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { Setup, Tag } from '@/api/types';
import { t } from '@lingui/core/macro';
import { formatCurrency, formatPnl } from '@/lib/format';
import { useDisplayPrefs } from '@/lib/prefs';
import { parseAmount, type FillDraft, type TradeFormValues } from '@/lib/trade-form';
import { blockPnlPreview } from '@/lib/trade-pnl-preview';
import { pnlColor } from '@/styles/unistyles';

/** "CALL 102 · Aug 7 · ×100" — the contract facts the header row can't hold. */
function contractLine(block: TradeFormValues): string {
  const parts: string[] = [];
  if (block.market === 'option') {
    const right = block.optionRight ? block.optionRight.toUpperCase() : '';
    const strike = block.optionStrike.trim();
    if (right || strike) parts.push([right, strike].filter(Boolean).join(' '));
    if (block.optionExpiry.trim()) parts.push(block.optionExpiry.trim());
  }
  const multiplier = parseAmount(block.multiplier);
  if (multiplier != null && multiplier > 1) parts.push(`×${multiplier}`);
  else if (block.market === 'option') parts.push('×100');
  return parts.join(' · ');
}

function planLine(block: TradeFormValues, currency: string): string {
  const target = parseAmount(block.target);
  const stop = parseAmount(block.stop);
  const parts: string[] = [];
  if (target != null) parts.push(t`Target ${formatCurrency(target, currency)}`);
  if (stop != null) parts.push(t`Stop ${formatCurrency(stop, currency)}`);
  return parts.join(' · ');
}

function Chip({ label, tone }: { label: string; tone: 'accent' | 'muted' | 'neg' }) {
  return (
    <View style={[styles.chip, tone === 'accent' && styles.chipAccent]}>
      <Text
        style={[
          styles.chipLabel,
          tone === 'accent' && styles.chipLabelAccent,
          tone === 'neg' && styles.chipLabelNeg,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

function FillLine({ fill }: { fill: FillDraft }) {
  const when = fill.executedAt.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const buy = fill.side === 'buy';
  return (
    <View style={styles.fillLine}>
      <Text style={[styles.fillSide, buy ? styles.labelPos : styles.labelNeg]}>
        {buy ? t`Buy` : t`Sell`}
      </Text>
      <Text style={styles.fillQtyPrice} numberOfLines={1}>
        {fill.quantity || '—'} @ {fill.price || '—'}
      </Text>
      <Text style={styles.fillWhen}>{when}</Text>
    </View>
  );
}

/**
 * Read-only digest of one symbol block — what will be logged when the form
 * saves. Shared by the scan review (post-parse) and the /trade-preview screen
 * (pre-commit) so both phases speak the same visual language: header facts,
 * fills, journal chips, then a result strip with the FIFO net P&L.
 */
export function BlockSummary({
  block,
  currency = 'USD',
  setups,
  tags,
}: {
  block: TradeFormValues;
  currency?: string;
  /** When provided, journal selections render as named chips. */
  setups?: Setup[];
  tags?: Tag[];
}) {
  const { theme } = useUnistyles();
  // Money formatters read privacy mode at call time (see lib/format.ts).
  useDisplayPrefs();

  const shown = block.fills.slice(0, 6);
  const hidden = block.fills.length - shown.length;
  const long = block.direction === 'long';
  const preview = blockPnlPreview(block);
  const contract = contractLine(block);
  const plan = planLine(block, currency);

  const chips: { key: string; label: string; tone: 'accent' | 'muted' | 'neg' }[] = [];
  for (const id of block.setupIds) {
    const name = setups?.find((s) => s.id === id)?.name;
    if (name) chips.push({ key: `s-${id}`, label: name, tone: 'accent' });
  }
  if (block.session) chips.push({ key: 'session', label: block.session, tone: 'muted' });
  for (const id of block.tagIds) {
    const name = tags?.find((tag) => tag.id === id)?.name;
    if (name) chips.push({ key: `t-${id}`, label: name, tone: 'muted' });
  }
  for (const id of block.mistakeIds) {
    const name = tags?.find((tag) => tag.id === id)?.name;
    if (name) chips.push({ key: `m-${id}`, label: name, tone: 'neg' });
  }

  return (
    <View style={styles.card}>
      <View style={styles.blockHeader}>
        <Text style={styles.blockSymbol}>{block.symbol || t`Unknown symbol`}</Text>
        <View style={styles.directionBadge}>
          <Text style={[styles.directionLabel, long ? styles.labelPos : styles.labelNeg]}>
            {long ? t`Long` : t`Short`}
          </Text>
        </View>
        <Text style={styles.blockMarket}>{block.market}</Text>
      </View>
      {contract ? <Text style={styles.metaLine}>{contract}</Text> : null}

      <View style={styles.fills}>
        {shown.map((fill) => (
          <FillLine key={fill.key} fill={fill} />
        ))}
        {hidden > 0 ? <Text style={styles.moreLine}>{t`+${hidden} more fills`}</Text> : null}
      </View>

      {plan ? <Text style={styles.metaLine}>{plan}</Text> : null}

      {chips.length > 0 ? (
        <View style={styles.chips}>
          {chips.map((chip) => (
            <Chip key={chip.key} label={chip.label} tone={chip.tone} />
          ))}
        </View>
      ) : null}

      {preview.avgEntry != null || preview.avgExit != null ? (
        <View style={styles.resultStrip}>
          <View style={styles.resultCell}>
            <Text style={styles.resultLabel}>{t`Avg entry`}</Text>
            <Text style={styles.resultValue}>
              {preview.avgEntry != null ? formatCurrency(preview.avgEntry, currency) : t`None`}
            </Text>
          </View>
          <View style={styles.resultCell}>
            <Text style={styles.resultLabel}>{t`Avg exit`}</Text>
            <Text style={styles.resultValue}>
              {preview.avgExit != null ? formatCurrency(preview.avgExit, currency) : t`Open`}
            </Text>
          </View>
          <View style={styles.resultCell}>
            <Text style={styles.resultLabel}>{t`Est. P&L`}</Text>
            {preview.net != null ? (
              <View style={styles.resultPnlRow}>
                <Text
                  style={[styles.resultValue, { color: pnlColor(theme.colors, preview.net) }]}
                >
                  {formatPnl(preview.net, currency)}
                </Text>
                {preview.closed ? (
                  <SymbolView
                    name="checkmark.circle.fill"
                    size={13}
                    tintColor={theme.colors.profit}
                  />
                ) : null}
              </View>
            ) : (
              <Text style={styles.resultValueMuted}>
                {t`Open · ${preview.positionQty} left`}
              </Text>
            )}
          </View>
        </View>
      ) : null}

      {preview.feesTotal > 0 ? (
        <Text style={styles.metaLine}>{t`Fees ${formatCurrency(preview.feesTotal, currency)}`}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    borderRadius: theme.radius.lg + 6,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.card,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
  blockSymbol: { fontSize: 18, fontWeight: '700', color: theme.colors.foreground },
  directionBadge: {
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    backgroundColor: theme.colors.muted,
  },
  directionLabel: { fontSize: 12, fontWeight: '600' },
  labelPos: { color: theme.colors.profit },
  labelNeg: { color: theme.colors.loss },
  blockMarket: {
    marginLeft: 'auto',
    fontSize: 13,
    color: theme.colors.mutedForeground,
    textTransform: 'capitalize',
  },
  metaLine: {
    fontSize: 12,
    color: theme.colors.mutedForeground,
    paddingHorizontal: theme.spacing.lg,
    fontVariant: ['tabular-nums'],
  },
  fills: { paddingVertical: theme.spacing.xs },
  fillLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xs + 2,
  },
  fillSide: { width: 34, fontSize: 13, fontWeight: '600' },
  fillQtyPrice: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.foreground,
    fontVariant: ['tabular-nums'],
  },
  fillWhen: {
    fontSize: 12,
    color: theme.colors.mutedForeground,
    fontVariant: ['tabular-nums'],
  },
  moreLine: {
    fontSize: 12,
    color: theme.colors.mutedForeground,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs + 2,
    paddingHorizontal: theme.spacing.lg,
  },
  chip: {
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.muted,
    paddingHorizontal: theme.spacing.sm + 2,
    paddingVertical: 3,
    maxWidth: 180,
  },
  chipAccent: { backgroundColor: theme.colors.accent },
  chipLabel: { fontSize: 12, fontWeight: '500', color: theme.colors.foreground },
  chipLabelAccent: { color: theme.colors.foreground },
  chipLabelNeg: { color: theme.colors.loss },
  resultStrip: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.xs,
    paddingTop: theme.spacing.md,
    borderTopWidth: 0.5,
    borderTopColor: theme.colors.border,
  },
  resultCell: { flex: 1, gap: 2 },
  resultLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: theme.colors.mutedForeground,
  },
  resultValue: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.foreground,
    fontVariant: ['tabular-nums'],
  },
  resultValueMuted: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.mutedForeground,
    fontVariant: ['tabular-nums'],
  },
  resultPnlRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
}));
