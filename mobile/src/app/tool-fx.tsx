import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useFxRate } from '@/api/hooks';
import { FormField, FormInput } from '@/components/form-sheet';
import { Segmented } from '@/components/segmented';
import { ToolSheet } from '@/components/tool-sheet';
import { t } from '@lingui/core/macro';
import { formatDate } from '@/lib/format';
import { DISPLAY_CURRENCIES, useDisplayPrefs } from '@/lib/prefs';

/** Currency converter over the server's latest FX rate (GET /market/fx). */
export default function FxToolScreen() {
  const { theme } = useUnistyles();
  useDisplayPrefs();

  const [amount, setAmount] = useState('100');
  const [from, setFrom] = useState<string>('USD');
  const [to, setTo] = useState<string>('HKD');

  const fx = useFxRate(from, to);
  const same = from === to;
  const rate = same ? 1 : fx.data?.rate;
  const parsed = Number(amount);
  const converted = rate != null && Number.isFinite(parsed) ? parsed * rate : null;

  const currencyOptions = DISPLAY_CURRENCIES.map((code) => ({ value: code, label: code }));

  const money = (v: number, code: string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(v);

  return (
    <ToolSheet title={t`Currency converter`}>
      <FormField label={t`Amount`}>
        <FormInput
          value={amount}
          onChangeText={setAmount}
          placeholder="100"
          keyboardType="decimal-pad"
        />
      </FormField>

      <FormField label={t`From`}>
        <Segmented variant="menu" options={currencyOptions} value={from} onChange={setFrom} />
      </FormField>

      <View style={styles.swapRow}>
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
          <SymbolView name="arrow.up.arrow.down" size={15} tintColor={theme.colors.foreground} />
        </Pressable>
      </View>

      <FormField label={t`To`}>
        <Segmented variant="menu" options={currencyOptions} value={to} onChange={setTo} />
      </FormField>

      <View style={styles.result}>
        {fx.isLoading && !same ? (
          <Text style={styles.muted}>{t`Fetching rate…`}</Text>
        ) : fx.isError && !same ? (
          <Text style={styles.muted}>{t`Could not fetch the rate — is market data configured?`}</Text>
        ) : converted != null ? (
          <>
            <Text selectable style={styles.converted}>
              {money(converted, to)}
            </Text>
            <Text style={styles.rateLine}>
              {t`1 ${from} = ${(rate ?? 1).toFixed(4)} ${to}`}
              {!same && fx.data ? ` · ${formatDate(fx.data.as_of)}` : null}
            </Text>
          </>
        ) : null}
      </View>
    </ToolSheet>
  );
}

const styles = StyleSheet.create((theme) => ({
  swapRow: { alignItems: 'center' },
  swapButton: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.muted,
  },
  pressed: { opacity: 0.6 },
  result: { alignItems: 'center', gap: theme.spacing.xs, paddingTop: theme.spacing.md },
  converted: {
    fontSize: 34,
    fontWeight: '600',
    letterSpacing: -1,
    color: theme.colors.foreground,
    ...theme.numeric,
  },
  rateLine: { fontSize: 12, color: theme.colors.mutedForeground, ...theme.numeric },
  muted: { fontSize: 13, color: theme.colors.mutedForeground },
}));
