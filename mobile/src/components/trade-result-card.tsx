
import { Card, cn } from 'panelui-native';
import { Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { Icon } from '@/components/icon';
import { SectionHeader } from '@/components/form-rows';
import { t } from '@lingui/core/macro';
import { formatRatio, useFormatters } from '@/lib/format';
import { pnlClass } from '@/styles/pnl';
import type { TradePnlPreview } from '@/lib/trade-pnl-preview';

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="w-1/2 gap-0.5">
      <Text className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted-foreground">
        {label}
      </Text>
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
  const [profit] = useCSSVariable(['--color-profit']) as [string];
  // Formatters bound to the display prefs (see lib/format.ts).
  const { formatCurrency, formatPnl } = useFormatters();

  if (preview.avgEntry == null && preview.avgExit == null) return null;

  return (
    <>
      <SectionHeader label={t`Result`} />
      <Card className="gap-3 p-4">
        <View className="flex-row flex-wrap gap-y-3">
          <Tile label={t`Avg entry`}>
            <Text className="text-[17px] font-semibold text-foreground tabular-nums">
              {preview.avgEntry != null ? formatCurrency(preview.avgEntry, currency) : t`None`}
            </Text>
          </Tile>
          <Tile label={t`Avg exit`}>
            <Text className="text-[17px] font-semibold text-foreground tabular-nums">
              {preview.avgExit != null ? formatCurrency(preview.avgExit, currency) : t`Open`}
            </Text>
          </Tile>
          <Tile label={t`Est. P&L`}>
            {preview.net != null ? (
              <Text
                className={cn('text-[17px] font-semibold tabular-nums', pnlClass(preview.net))}
              >
                {formatPnl(preview.net, currency)}
              </Text>
            ) : (
              <Text className="text-[17px] font-semibold text-muted-foreground">{t`Open`}</Text>
            )}
          </Tile>
          <Tile label={t`Position`}>
            <View className="flex-row items-center gap-1">
              <Text className="text-[17px] font-semibold text-foreground tabular-nums">
                {preview.positionQty}
              </Text>
              {preview.closed ? (
                <Icon name="checkmark.circle.fill" size={15} tintColor={profit} />
              ) : null}
            </View>
          </Tile>
        </View>
        {preview.feesTotal > 0 || preview.rMultiple != null ? (
          <Text className="text-xs text-muted-foreground tabular-nums">
            {[
              preview.feesTotal > 0 ? t`Fees ${formatCurrency(preview.feesTotal, currency)}` : '',
              preview.rMultiple != null ? t`R multiple ${formatRatio(preview.rMultiple)}` : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        ) : null}
      </Card>
    </>
  );
}
