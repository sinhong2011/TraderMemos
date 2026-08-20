import { forwardRef } from 'react';
import { Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import type { TradeDetail } from '@/api/types';
import { t } from '@lingui/core/macro';
import { formatPercent, formatPercentPoints, formatRatio, useFormatters } from '@/lib/format';
import { tradeRMultiple, tradeStatus } from '@/lib/trades';
import type { YearWrapped } from '@/lib/wrapped';
import { pnlColor, PnlFill } from '@/styles/pnl';

/** Card width in points — the capture scales it up, so this is the layout unit. */
export const SHARE_CARD_WIDTH = 340;

export const SHARE_CARD_STYLES = ['classic', 'midnight', 'paper', 'signal'] as const;
export type ShareCardStyleId = (typeof SHARE_CARD_STYLES)[number];

export function shareCardStyleLabel(id: ShareCardStyleId): string {
  switch (id) {
    case 'classic':
      return t`Classic`;
    case 'midnight':
      return t`Midnight`;
    case 'paper':
      return t`Paper`;
    default:
      return t`Signal`;
  }
}

/**
 * Everything a card style controls. Fixed styles carry their own palette so a
 * midnight card stays midnight in light mode; `classic` mirrors the app theme.
 * `chipBg`/`chipFg` null → derive the direction chip from the pos/neg tone
 * (the translucent Pill recipe); set → a single fixed chip surface (signal).
 *
 * The hexes below are deliberately literal rather than theme tokens: a card is
 * an *exported image*, and a picked style has to render the same whatever
 * scheme the sharer's phone happens to be in. Only `classic` follows the app.
 */
type CardPalette = {
  bg: string;
  fg: string;
  mutedFg: string;
  pos: string;
  neg: string;
  flat: string;
  /** Hero/amount color override — null derives from P&L tone. */
  heroFg: string | null;
  chipBg: string | null;
  chipFg: string | null;
  /** "Memos" half of the wordmark. */
  brandAccent: string;
};

/** The `classic` style's ground: the live app theme, read from the tokens. */
type AppPalette = {
  background: string;
  foreground: string;
  mutedForeground: string;
  profit: string;
  loss: string;
  flat: string;
};

function useAppPalette(): AppPalette {
  const [background, foreground, mutedForeground, profit, loss, flat] = useCSSVariable([
    '--color-background',
    '--color-foreground',
    '--color-muted-foreground',
    '--color-profit',
    '--color-loss',
    '--color-flat',
  ]) as [string, string, string, string, string, string];
  return { background, foreground, mutedForeground, profit, loss, flat };
}

function cardPalette(
  id: ShareCardStyleId,
  app: AppPalette,
  net: number,
  open: boolean,
): CardPalette {
  switch (id) {
    case 'midnight':
      return {
        bg: '#0E1116',
        fg: '#F5F5F5',
        mutedFg: '#9BA1A6',
        pos: '#54BF5C',
        neg: '#FF6467',
        flat: '#A1A1A1',
        heroFg: null,
        chipBg: null,
        chipFg: null,
        brandAccent: PnlFill.open,
      };
    case 'paper':
      return {
        bg: '#FFFFFF',
        fg: '#171717',
        mutedFg: '#737373',
        pos: '#098926',
        neg: '#E7000B',
        flat: '#737373',
        heroFg: null,
        chipBg: null,
        chipFg: null,
        brandAccent: PnlFill.open,
      };
    case 'signal': {
      const fill = open ? PnlFill.open : net > 0 ? PnlFill.pos : net < 0 ? PnlFill.neg : PnlFill.flat;
      return {
        bg: fill,
        fg: '#FFFFFF',
        mutedFg: 'rgba(255, 255, 255, 0.72)',
        pos: '#FFFFFF',
        neg: '#FFFFFF',
        flat: '#FFFFFF',
        heroFg: '#FFFFFF',
        chipBg: 'rgba(255, 255, 255, 0.18)',
        chipFg: '#FFFFFF',
        brandAccent: '#FFFFFF',
      };
    }
    default:
      return {
        bg: app.background,
        fg: app.foreground,
        mutedFg: app.mutedForeground,
        pos: app.profit,
        neg: app.loss,
        flat: app.flat,
        heroFg: null,
        chipBg: null,
        chipFg: null,
        brandAccent: PnlFill.open,
      };
  }
}

/** Hero tone for a P&L, resolved against the card's own pos/neg/flat hues. */
function heroTone(palette: CardPalette, net: number): string {
  return (
    palette.heroFg ??
    pnlColor(
      { profit: palette.pos, loss: palette.neg, flat: palette.flat, open: PnlFill.open },
      net,
    )
  );
}

function statusLabel(label: ReturnType<typeof tradeStatus>['label']): string {
  switch (label) {
    case 'WIN':
      return t`WIN`;
    case 'LOSS':
      return t`LOSS`;
    case 'OPEN':
      return t`OPEN`;
    default:
      return t`BE`;
  }
}

/*
 * The card is a capture target (react-native-view-shot), so its metrics are
 * spelled out rather than inherited: 340pt wide, 24pt padding, 20pt corners.
 * Arbitrary type sizes (`text-[24px]`) rather than the `text-2xl` scale on
 * purpose — the scale utilities also set a line height, which would reflow
 * every exported image.
 */
const CARD = 'w-[340px] gap-4 rounded-2xl p-6';
const CARD_ROW = 'flex-row items-center justify-between';
// Palette-aware sibling of Pill — the theme Pill would tint from the app
// scheme, which breaks on the fixed midnight/paper/signal grounds.
const CHIP = 'flex-row items-center rounded-sm px-2 py-[2px]';
const CHIP_TEXT = 'text-[11px] font-semibold tracking-[0.3px]';
const HERO_WRAP = 'items-center gap-1 py-4';
const HERO_SUB = 'text-[16px] font-medium tabular-nums';
const DATE = 'text-[13px] tabular-nums';
const BRAND = 'text-[13px] font-bold';
/** `continuous` corners have no class — iOS squircles are a style-only prop. */
const CONTINUOUS = { borderCurve: 'continuous' } as const;

/**
 * Shareable result card (web TradeShareCard). Privacy-first like the web
 * default: the hero is the R multiple, falling back to return %, then the
 * W/L status — dollar amounts only appear when the sharer opts in.
 */
export const ShareCardView = forwardRef<
  View,
  { trade: TradeDetail; showAmounts: boolean; cardStyle?: ShareCardStyleId; showMark?: boolean }
>(function ShareCardView({ trade, showAmounts, cardStyle = 'classic', showMark = true }, ref) {
  const app = useAppPalette();
  // Formatters bound to the display prefs (see lib/format.ts).
  const { formatDate, formatPnl } = useFormatters();
  const r = trade.r_multiple ?? tradeRMultiple(trade);
  const status = tradeStatus(trade);
  const isLong = trade.direction === 'long';
  const net = trade.net_pnl ?? 0;
  const palette = cardPalette(cardStyle, app, net, status.label === 'OPEN');

  const hero =
    r != null
      ? `${r >= 0 ? '+' : ''}${r.toFixed(2)}R`
      : trade.return_pct != null
        ? formatPercentPoints(trade.return_pct)
        : statusLabel(status.label);
  const sub = r != null && trade.return_pct != null ? formatPercentPoints(trade.return_pct) : null;

  const heroColor = heroTone(palette, net);
  const chipTone = isLong ? palette.pos : palette.neg;

  return (
    <View
      ref={ref}
      collapsable={false}
      className={CARD}
      style={[CONTINUOUS, { backgroundColor: palette.bg }]}
    >
      <View className={CARD_ROW}>
        <Text className="text-[24px] font-bold" style={{ color: palette.fg }}>
          {trade.symbol}
        </Text>
        <View
          className={CHIP}
          style={[CONTINUOUS, { backgroundColor: palette.chipBg ?? `${chipTone}1F` }]}
        >
          <Text className={CHIP_TEXT} style={{ color: palette.chipFg ?? chipTone }}>
            {isLong ? t`LONG` : t`SHORT`}
          </Text>
        </View>
      </View>
      <View className={HERO_WRAP}>
        <Text
          className="text-[56px] font-bold tracking-[-2px] tabular-nums"
          style={{ color: heroColor }}
        >
          {hero}
        </Text>
        {sub ? (
          <Text className={HERO_SUB} style={{ color: palette.mutedFg }}>
            {sub}
          </Text>
        ) : null}
        {showAmounts ? (
          <Text
            className="text-[20px] font-semibold tabular-nums"
            style={{ color: heroColor }}
          >
            {formatPnl(net, trade.pnl_currency)}
          </Text>
        ) : null}
      </View>
      <View className={CARD_ROW}>
        <Text className={DATE} style={{ color: palette.mutedFg }}>
          {formatDate(trade.closed_at ?? trade.opened_at)}
        </Text>
        {showMark ? (
          // Wordmark, not a logo asset — keeps the capture self-contained.
          <Text className={BRAND} style={{ color: palette.fg }}>
            Trader<Text style={{ color: palette.brandAccent }}>Memos</Text>
          </Text>
        ) : null}
      </View>
    </View>
  );
});

/**
 * Annual-recap share card (web WrappedShareCard). Same privacy default as the
 * trade card: without amounts the hero is the win rate and the stats stick to
 * ratios and day counts — account size never leaves the device unasked.
 */
export const WrappedShareCardView = forwardRef<
  View,
  {
    wrapped: YearWrapped;
    currency: string;
    fxRate: number;
    /** True while the year is still running (current year → "Year to date"). */
    inProgress: boolean;
    showAmounts: boolean;
    cardStyle?: ShareCardStyleId;
    showMark?: boolean;
  }
>(function WrappedShareCardView(
  { wrapped, currency, fxRate, inProgress, showAmounts, cardStyle = 'classic', showMark = true },
  ref,
) {
  const app = useAppPalette();
  const { formatPnl, formatPnlCompact } = useFormatters();
  const net = wrapped.netPnl;
  const palette = cardPalette(cardStyle, app, net, false);
  const money = (v: number) => formatPnl(v * fxRate, currency);
  const moneyCompact = (v: number) => formatPnlCompact(v * fxRate, currency);
  const winRate = formatPercent(wrapped.winRate, 0);

  const heroColor = heroTone(palette, net);
  const chipTone = net > 0 ? palette.pos : net < 0 ? palette.neg : palette.flat;

  // Same stat menu as the web builder: amounts unlock money rows, privacy
  // mode swaps in counts and streaks. At most three make the card.
  const stats: { label: string; value: string }[] = [
    ...(showAmounts
      ? [
          { label: t`Win rate`, value: winRate },
          { label: t`Profit factor`, value: formatRatio(wrapped.profitFactor) },
          ...(wrapped.bestDay
            ? [{ label: t`Best day`, value: moneyCompact(wrapped.bestDay.pnl) }]
            : []),
        ]
      : [
          { label: t`Profit factor`, value: formatRatio(wrapped.profitFactor) },
          { label: t`Green days`, value: t`${wrapped.greenDays} of ${wrapped.tradingDays}` },
          ...(wrapped.bestStreak > 0
            ? [{ label: t`Best streak`, value: t`${wrapped.bestStreak} wins` }]
            : []),
        ]),
  ].slice(0, 3);

  return (
    <View
      ref={ref}
      collapsable={false}
      className={CARD}
      style={[CONTINUOUS, { backgroundColor: palette.bg }]}
    >
      <View className={CARD_ROW}>
        <Text className="text-[20px] font-bold" style={{ color: palette.fg }}>
          {t`${wrapped.year} Wrapped`}
        </Text>
        <View
          className={CHIP}
          style={[CONTINUOUS, { backgroundColor: palette.chipBg ?? `${chipTone}1F` }]}
        >
          <Text className={CHIP_TEXT} style={{ color: palette.chipFg ?? chipTone }}>
            {net > 0 ? t`GREEN YEAR` : net < 0 ? t`RED YEAR` : t`FLAT YEAR`}
          </Text>
        </View>
      </View>
      <View className={HERO_WRAP}>
        {/* The year hero carries full currency strings — a step down from the
            trade card's R multiple so "+$123,456.78" still fits 340pt. */}
        <Text
          className="text-[40px] font-bold tracking-[-1.5px] tabular-nums"
          style={{ color: heroColor }}
        >
          {showAmounts ? money(net) : winRate}
        </Text>
        <Text className={HERO_SUB} style={{ color: palette.mutedFg }}>
          {showAmounts ? t`Net P&L` : t`Win rate`}
        </Text>
      </View>
      <View className="flex-row gap-2">
        {stats.map((stat) => (
          <View key={stat.label} className="flex-1 items-center gap-[2px]">
            <Text className="text-[11px] font-medium" style={{ color: palette.mutedFg }}>
              {stat.label}
            </Text>
            <Text
              className="text-[15px] font-semibold tabular-nums"
              style={{ color: palette.fg }}
            >
              {stat.value}
            </Text>
          </View>
        ))}
      </View>
      <View className={CARD_ROW}>
        <Text className={DATE} style={{ color: palette.mutedFg }}>
          {inProgress
            ? t`${wrapped.totalTrades} trades · Year to date`
            : t`${wrapped.totalTrades} trades · Full year`}
        </Text>
        {showMark ? (
          <Text className={BRAND} style={{ color: palette.fg }}>
            Trader<Text style={{ color: palette.brandAccent }}>Memos</Text>
          </Text>
        ) : null}
      </View>
    </View>
  );
});
