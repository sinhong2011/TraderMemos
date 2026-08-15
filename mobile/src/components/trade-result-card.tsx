
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Icon } from '@/components/icon';
import { SectionHeader } from '@/components/form-rows';
import { t } from '@lingui/core/macro';
import { formatRatio, useFormatters } from '@/lib/format';
import { pnlColor } from '@/styles/unistyles';
import type { TradePnlPreview } from '@/lib/trade-pnl-preview';

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      {children}
    </View>
  );
}

/**
 * Live outcome of the fills typed so far — the web drawer's RESULT strip on
 * the phone: fill-weighted average entry/exit, FIFO net P&L, and the open
 * position (with a check once the round-trip is flat). Renders nothing until
 * a fill parses, so an empty form stays quiet.
 */
export function TradeResultCard({
  preview,
  currency,
}: {
  preview: TradePnlPreview;
  currency: string;
}) {
  const { theme } = useUnistyles();
  // Formatters bound to the display prefs (see lib/format.ts).
  const { formatCurrency, formatPnl } = useFormatters();

  if (preview.avgEntry == null && preview.avgExit == null) return null;

  return (
    <>
      <SectionHeader label={t`Result`} />
      <View style={styles.card}>
        <View style={styles.grid}>
          <Tile label={t`Avg entry`}>
            <Text style={styles.tileValue}>
              {preview.avgEntry != null ? formatCurrency(preview.avgEntry, currency) : t`None`}
            </Text>
          </Tile>
          <Tile label={t`Avg exit`}>
            <Text style={styles.tileValue}>
              {preview.avgExit != null ? formatCurrency(preview.avgExit, currency) : t`Open`}
            </Text>
          </Tile>
          <Tile label={t`Est. P&L`}>
            {preview.net != null ? (
              <Text style={[styles.tileValue, { color: pnlColor(theme.colors, preview.net) }]}>
                {formatPnl(preview.net, currency)}
              </Text>
            ) : (
              <Text style={styles.tileValueMuted}>{t`Open`}</Text>
            )}
          </Tile>
          <Tile label={t`Position`}>
            <View style={styles.positionRow}>
              <Text style={styles.tileValue}>{preview.positionQty}</Text>
              {preview.closed ? (
                <Icon
                  name="checkmark.circle.fill"
                  size={15}
                  tintColor={theme.colors.profit}
                />
              ) : null}
            </View>
          </Tile>
        </View>
        {preview.feesTotal > 0 || preview.rMultiple != null ? (
          <Text style={styles.rLine}>
            {[
              preview.feesTotal > 0 ? t`Fees ${formatCurrency(preview.feesTotal, currency)}` : '',
              preview.rMultiple != null ? t`R multiple ${formatRatio(preview.rMultiple)}` : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    borderRadius: theme.radius.lg + 6,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.card,
    boxShadow: theme.shadows.card,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: theme.spacing.md,
  },
  tile: { width: '50%', gap: 2 },
  tileLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: theme.colors.mutedForeground,
  },
  tileValue: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.foreground,
    fontVariant: ['tabular-nums'],
  },
  tileValueMuted: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.mutedForeground,
  },
  positionRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  rLine: {
    fontSize: 12,
    color: theme.colors.mutedForeground,
    fontVariant: ['tabular-nums'],
  },
}));
