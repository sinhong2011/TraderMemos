import { useState } from 'react';
import { View } from 'react-native';

import { useAccounts, useRiskRules } from '@/api/hooks';
import { FormField, FormInput } from '@/components/form-sheet';
import { StatBar } from '@/components/stat-bar';
import { ToolCol, ToolRow, ToolSheet } from '@/components/tool-sheet';
import { t } from '@lingui/core/macro';
import { useSelectedAccountId } from '@/lib/account-store';
import { formatCompact, useFormatters } from '@/lib/format';
import { positionSizeFromRisk } from '@/lib/position-size';
import { accountBaseCurrency } from '@/lib/prefs';

/**
 * Position-size calculator: equity × risk% ÷ per-share risk. Seeds equity
 * from the scoped account's starting balance and risk % from the risk rules
 * — both only until the trader types their own numbers.
 */
export default function PositionSizeToolScreen() {
  const accounts = useAccounts();
  const selectedAccountId = useSelectedAccountId();
  const riskRules = useRiskRules();
  // Formatters bound to the display prefs (see lib/format.ts).
  const { formatCurrency } = useFormatters();

  const account = selectedAccountId
    ? accounts.data?.find((a) => a.id === selectedAccountId)
    : accounts.data?.[0];
  const currency = accountBaseCurrency(accounts.data, selectedAccountId);

  const [equity, setEquity] = useState('');
  const [riskPct, setRiskPct] = useState('');
  const [entry, setEntry] = useState('');
  const [stop, setStop] = useState('');

  const seededEquity = equity !== '' ? equity : account ? String(account.starting_balance) : '';
  const seededRisk =
    riskPct !== ''
      ? riskPct
      : riskRules.data?.default_account_risk_pct != null
        ? String(riskRules.data.default_account_risk_pct)
        : '';

  const result = positionSizeFromRisk({
    equity: Number(seededEquity),
    riskPct: Number(seededRisk),
    entryPrice: Number(entry),
    stopPrice: Number(stop),
  });

  return (
    <ToolSheet title={t`Position size`}>
      <ToolRow>
        <ToolCol>
          <FormField label={t`Equity`}>
            <FormInput
              value={seededEquity}
              onChangeText={setEquity}
              placeholder="10000"
              numeric
            />
          </FormField>
        </ToolCol>
        <ToolCol>
          <FormField label={t`Risk %`}>
            <FormInput
              value={seededRisk}
              onChangeText={setRiskPct}
              placeholder="1"
              numeric
            />
          </FormField>
        </ToolCol>
      </ToolRow>
      <ToolRow>
        <ToolCol>
          <FormField label={t`Entry`}>
            <FormInput
              value={entry}
              onChangeText={setEntry}
              placeholder="100.00"
              numeric
            />
          </FormField>
        </ToolCol>
        <ToolCol>
          <FormField label={t`Stop`}>
            <FormInput
              value={stop}
              onChangeText={setStop}
              placeholder="98.00"
              numeric
            />
          </FormField>
        </ToolCol>
      </ToolRow>

      {result ? (
        <View className="flex-row flex-wrap gap-2 pt-2">
          <StatBar label={t`Shares`} value={formatCompact(Math.floor(result.qty))} tone="accent" />
          <StatBar
            label={t`Risk`}
            value={formatCurrency(result.riskDollars, currency)}
            sub={t`at the stop`}
            tone="neg"
          />
          <StatBar
            label={t`Per-share risk`}
            value={formatCurrency(result.perShareRisk, currency)}
          />
        </View>
      ) : null}
    </ToolSheet>
  );
}
