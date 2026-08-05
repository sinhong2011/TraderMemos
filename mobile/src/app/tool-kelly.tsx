import { useState } from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { useSummary } from '@/api/hooks';
import { FormField, FormInput } from '@/components/form-sheet';
import { StatBar } from '@/components/stat-bar';
import { ToolCol, ToolRow, ToolSheet } from '@/components/tool-sheet';
import { t } from '@lingui/core/macro';
import { useGlobalFilters } from '@/lib/filters';
import { formatPercent } from '@/lib/format';
import { kellyFraction } from '@/lib/kelly';

/**
 * Kelly criterion — seeded from the live summary when the book has enough
 * history (wins, losses, and a non-zero average loss), editable thereafter.
 */
export default function KellyToolScreen() {
  const summary = useSummary(useGlobalFilters());

  const [winRate, setWinRate] = useState('');
  const [payoff, setPayoff] = useState('');

  const s = summary.data;
  const canSeed = s != null && s.wins > 0 && s.losses > 0 && s.avg_loss > 0;
  const seededWinRate =
    winRate !== '' ? winRate : canSeed ? (s.win_rate * 100).toFixed(0) : '';
  const seededPayoff = payoff !== '' ? payoff : canSeed ? (s.avg_win / s.avg_loss).toFixed(2) : '';

  const kelly = kellyFraction(Number(seededWinRate) / 100, Number(seededPayoff));

  return (
    <ToolSheet title={t`Kelly criterion`}>
      <ToolRow>
        <ToolCol>
          <FormField label={t`Win rate %`}>
            <FormInput
              value={seededWinRate}
              onChangeText={setWinRate}
              placeholder="55"
              numeric
            />
          </FormField>
        </ToolCol>
        <ToolCol>
          <FormField label={t`Payoff ratio`}>
            <FormInput
              value={seededPayoff}
              onChangeText={setPayoff}
              placeholder="1.5"
              numeric
            />
          </FormField>
        </ToolCol>
      </ToolRow>

      {kelly != null ? (
        <>
          <View style={styles.grid}>
            <StatBar
              label={t`Full Kelly`}
              value={formatPercent(kelly, 1)}
              tone={kelly > 0 ? 'accent' : 'neg'}
            />
            <StatBar label={t`Half Kelly`} value={formatPercent(kelly / 2, 1)} tone="pos" />
            <StatBar label={t`Quarter Kelly`} value={formatPercent(kelly / 4, 1)} />
          </View>
          <Text style={styles.footnote}>
            {kelly > 0
              ? t`Fraction of capital to risk per trade. Half Kelly is the common practical pick — full Kelly assumes perfect estimates.`
              : t`Negative Kelly means this win rate and payoff have no positive edge.`}
          </Text>
        </>
      ) : null}
    </ToolSheet>
  );
}

const styles = StyleSheet.create((theme) => ({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
  },
  footnote: { fontSize: 12, lineHeight: 17, color: theme.colors.mutedForeground },
}));
