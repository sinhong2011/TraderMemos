import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { Icon } from '@/components/icon';
import { useFxRate } from '@/api/hooks';
import { NumericField } from '@/components/numeric-field';
import { Segmented } from '@/components/segmented';
import { ToolSheet } from '@/components/tool-sheet';
import { t } from '@lingui/core/macro';
import { describeError, isUnreachable } from '@/lib/errors';
import { useFormatters } from '@/lib/format';
import { DISPLAY_CURRENCIES } from '@/lib/prefs';

/**
 * Currency converter over the server's latest FX rate (GET /market/fx),
 * shaped like the iOS 26 Calculator's convert mode: two stacked panels, each
 * one currency — you type in the top one, the bottom one answers — with the
 * swap sitting on the seam and the rate stated underneath. No Convert button:
 * the result is live, so the form is the result.
 */
export default function FxToolScreen() {
  const [foreground] = useCSSVariable(['--color-foreground']) as [string];
  // Bound to the display timezone (see lib/format.ts).
  const { formatDate } = useFormatters();

  const [amount, setAmount] = useState('100');
  const [from, setFrom] = useState<string>('USD');
  const [to, setTo] = useState<string>('HKD');

  const fx = useFxRate(from, to);
  const same = from === to;
  const rate = same ? 1 : fx.data?.rate;
  const parsed = Number(amount);
  const converted = rate != null && Number.isFinite(parsed) ? parsed * rate : null;

  const fxProblem = fx.isError ? describeError(fx.error) : null;
  // An unreachable server and an unconfigured provider both land here, and only
  // one of them is fixed under Settings — the copy has to tell them apart.
  const fxProblemLine = fxProblem
    ? isUnreachable(fx.error)
      ? fxProblem.description
      : t`Could not fetch the rate — is market data configured?`
    : null;

  const currencyOptions = DISPLAY_CURRENCIES.map((code) => ({ value: code, label: code }));

  const money = (v: number, code: string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(v);

  return (
    <ToolSheet title={t`Currency converter`}>
      <View className="gap-1">
        <View className={PANEL} style={CONTINUOUS}>
          <View className={PANEL_HEAD}>
            <Text className={CAPTION}>{t`From`}</Text>
            <Segmented variant="menu" options={currencyOptions} value={from} onChange={setFrom} />
          </View>
          <NumericField
            value={amount}
            onChangeText={setAmount}
            placeholder="0"
            align="trailing"
            layout="stretch"
            size={34}
            weight="semibold"
          />
        </View>

        {/* Zero-height so the button floats on the seam between the panels,
            the converter idiom — a row of its own would push them apart. */}
        <View className="z-[2] h-0 items-end pr-4" pointerEvents="box-none">
          <Pressable
            onPress={() => {
              setFrom(to);
              setTo(from);
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t`Swap currencies`}
            // Ring in the page color so the button reads as punched through
            // the seam; the negative top margin is half its own height.
            className="-mt-[22px] h-11 w-11 items-center justify-center rounded-full border-4 border-background bg-muted active:opacity-60"
          >
            <Icon name="arrow.up.arrow.down" size={16} tintColor={foreground} />
          </Pressable>
        </View>

        <View className={PANEL} style={CONTINUOUS}>
          <View className={PANEL_HEAD}>
            <Text className={CAPTION}>{t`To`}</Text>
            <Segmented variant="menu" options={currencyOptions} value={to} onChange={setTo} />
          </View>
          {converted != null ? (
            <Text
              selectable
              numberOfLines={1}
              adjustsFontSizeToFit
              className="text-right text-[34px] font-semibold tracking-[-1px] text-foreground tabular-nums"
            >
              {money(converted, to)}
            </Text>
          ) : (
            <Text className="py-2 text-right text-[17px] text-muted-foreground">
              {fxProblem ? fxProblem.title : t`Fetching rate…`}
            </Text>
          )}
        </View>
      </View>

      <Text className="text-center text-xs text-muted-foreground tabular-nums">
        {fxProblemLine && !same
          ? fxProblemLine
          : converted != null
            ? `${t`1 ${from} = ${(rate ?? 1).toFixed(4)} ${to}`}${
                !same && fx.data ? ` · ${formatDate(fx.data.as_of)}` : ''
              }`
            : t`Rates come from your server's market data provider.`}
      </Text>
    </ToolSheet>
  );
}

/**
 * The two currency panels. An 18pt radius — one step softer than the `lg`
 * tier — is the Calculator convert-mode panel; `continuous` corners have no
 * class, so the squircle stays a style prop.
 */
const PANEL = 'gap-1 rounded-[18px] bg-card px-4 py-3';
const PANEL_HEAD = 'flex-row items-center justify-between';
const CAPTION = 'text-[13px] font-semibold text-muted-foreground';
const CONTINUOUS = { borderCurve: 'continuous' } as const;
