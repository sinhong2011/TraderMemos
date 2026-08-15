
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

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
  const { theme } = useUnistyles();
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
      <View style={styles.stack}>
        <View style={styles.panel}>
          <View style={styles.panelHead}>
            <Text style={styles.caption}>{t`From`}</Text>
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
        <View style={styles.seam} pointerEvents="box-none">
          <Pressable
            onPress={() => {
              setFrom(to);
              setTo(from);
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t`Swap currencies`}
            style={({ pressed }) => [styles.swapButton, pressed && styles.pressed]}
          >
            <Icon name="arrow.up.arrow.down" size={16} tintColor={theme.colors.foreground} />
          </Pressable>
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHead}>
            <Text style={styles.caption}>{t`To`}</Text>
            <Segmented variant="menu" options={currencyOptions} value={to} onChange={setTo} />
          </View>
          {converted != null ? (
            <Text selectable numberOfLines={1} adjustsFontSizeToFit style={styles.result}>
              {money(converted, to)}
            </Text>
          ) : (
            <Text style={styles.resultPending}>
              {fxProblem ? fxProblem.title : t`Fetching rate…`}
            </Text>
          )}
        </View>
      </View>

      <Text style={styles.rateLine}>
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

const SWAP_SIZE = 44;

const styles = StyleSheet.create((theme) => ({
  stack: { gap: theme.spacing.xs },
  panel: {
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.lg + 4,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.card,
  },
  panelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  caption: { fontSize: 13, fontWeight: '600', color: theme.colors.mutedForeground },
  seam: { height: 0, alignItems: 'flex-end', paddingRight: theme.spacing.lg, zIndex: 2 },
  swapButton: {
    width: SWAP_SIZE,
    height: SWAP_SIZE,
    marginTop: -SWAP_SIZE / 2,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.muted,
    // Ring in the page color so the button reads as punched through the seam.
    borderWidth: 4,
    borderColor: theme.colors.background,
  },
  pressed: { opacity: 0.6 },
  result: {
    fontSize: 34,
    fontWeight: '600',
    letterSpacing: -1,
    textAlign: 'right',
    color: theme.colors.foreground,
    ...theme.numeric,
  },
  resultPending: {
    fontSize: 17,
    textAlign: 'right',
    paddingVertical: theme.spacing.sm,
    color: theme.colors.mutedForeground,
  },
  rateLine: {
    fontSize: 12,
    textAlign: 'center',
    color: theme.colors.mutedForeground,
    ...theme.numeric,
  },
}));
