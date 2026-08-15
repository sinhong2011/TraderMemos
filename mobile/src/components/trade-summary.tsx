
import { Badge, Card, cn } from 'panelui-native';
import { Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { Icon } from '@/components/icon';
import type { Setup, Tag } from '@/api/types';
import { t } from '@lingui/core/macro';
import { useFormatters, type MoneyFormatter } from '@/lib/format';
import { parseAmount, type FillDraft, type TradeFormValues } from '@/lib/trade-form';
import { blockFillPnls, blockPnlPreview } from '@/lib/trade-pnl-preview';
import { pnlClass } from '@/styles/pnl';

/** Shared padding for every row inside the card — the gutter the header sets. */
const GUTTER = 'px-4';

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

function planLine(
  block: TradeFormValues,
  currency: string,
  formatCurrency: MoneyFormatter,
): string {
  const target = parseAmount(block.target);
  const stop = parseAmount(block.stop);
  const parts: string[] = [];
  if (target != null) parts.push(t`Target ${formatCurrency(target, currency)}`);
  if (stop != null) parts.push(t`Stop ${formatCurrency(stop, currency)}`);
  return parts.join(' · ');
}

/** One journal token: setup, session/tag, or mistake. */
function JournalChip({ label, tone }: { label: string; tone: 'accent' | 'muted' | 'neg' }) {
  return (
    <Badge
      variant={tone === 'muted' ? 'outline' : 'secondary'}
      className="max-w-[180px] rounded-full px-2.5 py-[3px]"
      labelClassName={cn('text-xs', tone === 'neg' && 'text-loss')}
    >
      {label}
    </Badge>
  );
}

function FillLine({
  fill,
  pnl,
  currency,
}: {
  fill: FillDraft;
  /** Realized net this closing fill locked in; null on opening fills. */
  pnl: number | null;
  currency: string;
}) {
  const { formatPnl } = useFormatters();
  const when = fill.executedAt.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const buy = fill.side === 'buy';
  // Three zones so the timestamp lands on the row's centre line and the P&L on
  // its trailing edge — the same columns whether or not a fill closed anything.
  return (
    <View className={cn('flex-row items-center gap-2 py-1.5', GUTTER)}>
      <View className="flex-1 flex-row items-center gap-2">
        <Text
          className={cn('w-[34px] text-[13px] font-semibold', buy ? 'text-profit' : 'text-loss')}
        >
          {buy ? t`Buy` : t`Sell`}
        </Text>
        <Text className="shrink text-sm text-foreground tabular-nums" numberOfLines={1}>
          {fill.quantity || '—'} @ {fill.price || '—'}
        </Text>
      </View>
      <Text className="text-center text-xs text-muted-foreground tabular-nums" numberOfLines={1}>
        {when}
      </Text>
      <View className="flex-1 items-end">
        {pnl != null ? (
          <Text
            className={cn('text-xs font-semibold tabular-nums', pnlClass(pnl))}
            numberOfLines={1}
          >
            {formatPnl(pnl, currency)}
          </Text>
        ) : null}
      </View>
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
  const [profit] = useCSSVariable(['--color-profit']) as [string];
  // Formatters bound to the display prefs (see lib/format.ts).
  const { formatCurrency, formatPnl } = useFormatters();

  const shown = block.fills.slice(0, 6);
  const hidden = block.fills.length - shown.length;
  const long = block.direction === 'long';
  const preview = blockPnlPreview(block);
  const fillPnls = blockFillPnls(block);
  const contract = contractLine(block);
  const plan = planLine(block, currency, formatCurrency);

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
    <Card className="gap-2 py-3">
      <View className={cn('flex-row items-center gap-2', GUTTER)}>
        <Text className="text-lg font-bold text-foreground">
          {block.symbol || t`Unknown symbol`}
        </Text>
        <View className="rounded-full bg-muted px-2 py-0.5">
          <Text className={cn('text-xs font-semibold', long ? 'text-profit' : 'text-loss')}>
            {long ? t`Long` : t`Short`}
          </Text>
        </View>
        <Text className="ml-auto text-[13px] capitalize text-muted-foreground">{block.market}</Text>
      </View>
      {contract ? (
        <Text className={cn('text-xs text-muted-foreground tabular-nums', GUTTER)}>{contract}</Text>
      ) : null}

      <View className="py-1">
        {shown.map((fill, index) => (
          <FillLine key={fill.key} fill={fill} pnl={fillPnls[index] ?? null} currency={currency} />
        ))}
        {hidden > 0 ? (
          <Text className={cn('pt-1 text-xs text-muted-foreground', GUTTER)}>
            {t`+${hidden} more fills`}
          </Text>
        ) : null}
      </View>

      {plan ? (
        <Text className={cn('text-xs text-muted-foreground tabular-nums', GUTTER)}>{plan}</Text>
      ) : null}

      {chips.length > 0 ? (
        <View className={cn('flex-row flex-wrap gap-1.5', GUTTER)}>
          {chips.map((chip) => (
            <JournalChip key={chip.key} label={chip.label} tone={chip.tone} />
          ))}
        </View>
      ) : null}

      {preview.avgEntry != null || preview.avgExit != null ? (
        <View className="mx-4 mt-1 flex-row gap-3 border-t border-border pt-3">
          <View className="flex-1 gap-0.5">
            <Text className="text-[10px] font-semibold uppercase tracking-[0.5px] text-muted-foreground">
              {t`Avg entry`}
            </Text>
            <Text className="text-[15px] font-semibold text-foreground tabular-nums">
              {preview.avgEntry != null ? formatCurrency(preview.avgEntry, currency) : t`None`}
            </Text>
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="text-[10px] font-semibold uppercase tracking-[0.5px] text-muted-foreground">
              {t`Avg exit`}
            </Text>
            <Text className="text-[15px] font-semibold text-foreground tabular-nums">
              {preview.avgExit != null ? formatCurrency(preview.avgExit, currency) : t`Open`}
            </Text>
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="text-[10px] font-semibold uppercase tracking-[0.5px] text-muted-foreground">
              {t`Est. P&L`}
            </Text>
            {preview.net != null ? (
              <View className="flex-row items-center gap-1">
                <Text
                  className={cn(
                    'text-[15px] font-semibold tabular-nums',
                    pnlClass(preview.net),
                  )}
                >
                  {formatPnl(preview.net, currency)}
                </Text>
                {preview.closed ? (
                  <Icon name="checkmark.circle.fill" size={13} tintColor={profit} />
                ) : null}
              </View>
            ) : (
              <Text className="text-[13px] font-medium text-muted-foreground tabular-nums">
                {t`Open · ${preview.positionQty} left`}
              </Text>
            )}
          </View>
        </View>
      ) : null}

      {preview.feesTotal > 0 ? (
        <Text className={cn('text-xs text-muted-foreground tabular-nums', GUTTER)}>
          {t`Fees ${formatCurrency(preview.feesTotal, currency)}`}
        </Text>
      ) : null}
    </Card>
  );
}
