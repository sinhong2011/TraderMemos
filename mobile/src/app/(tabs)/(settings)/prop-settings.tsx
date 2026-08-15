import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert } from 'react-native';

import { queryKeys, useAccounts, useApiRequest, usePropSettings } from '@/api/hooks';
import type { DrawdownMode, PropSettings } from '@/api/types';
import { CenteredButton } from '@/components/centered-button';
import { NavRow } from '@/components/nav-row';
import { SettingsForm } from '@/components/settings-form';
import { SettingsPicker, SettingsSection } from '@/components/settings-rows';
import { t } from '@lingui/core/macro';
import { parseAmount } from '@/lib/amount';
import { errorMessage } from '@/lib/errors';
import { formatPercent, useFormatters } from '@/lib/format';

/**
 * Prop-firm evaluation rules for one account. Every edit PUTs the whole DTO
 * (the endpoint replaces); blank clears that rule. Settings idiom: rows show
 * the value on the trailing edge, editing happens in native prompts — so the
 * rows carry no chevron, since a tap here opens an alert rather than pushing.
 */
export default function PropSettingsScreen() {
  const { formatCurrency } = useFormatters();
  const { accountId } = useLocalSearchParams<{ accountId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiRequest();
  const accounts = useAccounts();
  const settings = usePropSettings(accountId ?? '');

  const account = accounts.data?.find((candidate) => candidate.id === accountId);
  const currency = account?.base_currency ?? 'USD';
  const current: PropSettings = settings.data ?? {
    profit_target: null,
    max_drawdown: null,
    drawdown_mode: 'trailing',
    daily_loss_limit: null,
    consistency_pct: null,
  };

  const save = useMutation({
    mutationFn: (body: PropSettings) =>
      api(`/accounts/${accountId}/prop-settings`, { method: 'PUT', body }),
    onSuccess: (_, body) => {
      queryClient.setQueryData(queryKeys.propSettings(accountId!), body);
      void queryClient.invalidateQueries({ queryKey: ['accounts', accountId] });
    },
    onError: (err) => Alert.alert(t`Could not save`, errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: () => api<void>(`/accounts/${accountId}/prop-settings`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['accounts', accountId] });
      router.back();
    },
    onError: (err) => Alert.alert(t`Could not delete`, errorMessage(err)),
  });

  function editAmount(
    title: string,
    key: 'profit_target' | 'max_drawdown' | 'daily_loss_limit',
  ) {
    Alert.prompt(
      title,
      t`Leave blank to drop this rule.`,
      [
        { text: t`Cancel`, style: 'cancel' },
        {
          text: t`Save`,
          onPress: (text?: string) => {
            const amount = parseAmount(text ?? '');
            if (amount === undefined) {
              Alert.alert(t`Could not save`, t`Enter a valid amount.`);
              return;
            }
            save.mutate({ ...current, [key]: amount });
          },
        },
      ],
      'plain-text',
      current[key] != null ? String(current[key]) : '',
      'decimal-pad',
    );
  }

  function editConsistency() {
    Alert.prompt(
      t`Consistency rule`,
      t`Max share of profit one day may contribute, as a percent (e.g. 40). Leave blank to drop.`,
      [
        { text: t`Cancel`, style: 'cancel' },
        {
          text: t`Save`,
          onPress: (text?: string) => {
            const raw = (text ?? '').trim();
            if (raw === '') {
              save.mutate({ ...current, consistency_pct: null });
              return;
            }
            const parsed = Number(raw);
            if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100) {
              Alert.alert(t`Could not save`, t`Enter a percent between 1 and 100.`);
              return;
            }
            save.mutate({ ...current, consistency_pct: parsed / 100 });
          },
        },
      ],
      'plain-text',
      current.consistency_pct != null ? String(current.consistency_pct * 100) : '',
      'decimal-pad',
    );
  }

  function confirmDelete() {
    Alert.alert(t`Remove prop rules?`, t`The evaluation card disappears from Home.`, [
      { text: t`Cancel`, style: 'cancel' },
      { text: t`Remove`, style: 'destructive', onPress: () => remove.mutate() },
    ]);
  }

  const valueLabel = (value: number | null) =>
    value != null ? formatCurrency(value, currency) : t`Not set`;

  return (
    <SettingsForm>
      <SettingsSection
        title={account ? account.name : t`Prop rules`}
        footer={t`Rules the firm scores this evaluation on. Blank rules are skipped.`}
      >
        <NavRow
          systemImage="target"
          label={t`Profit target`}
          value={valueLabel(current.profit_target)}
          accessory="none"
          onPress={() => editAmount(t`Profit target`, 'profit_target')}
        />
        <NavRow
          systemImage="arrow.down.to.line"
          label={t`Max drawdown`}
          value={valueLabel(current.max_drawdown)}
          accessory="none"
          onPress={() => editAmount(t`Max drawdown`, 'max_drawdown')}
        />
        <SettingsPicker
          label={t`Drawdown model`}
          selectedValue={current.drawdown_mode}
          onValueChange={(value) =>
            save.mutate({ ...current, drawdown_mode: value as DrawdownMode })
          }
          items={[
            { value: 'trailing', label: t`Trailing — ratchets on every high` },
            { value: 'eod', label: t`EOD trailing — ratchets at day close` },
            { value: 'static', label: t`Static — fixed floor` },
          ]}
        />
        <NavRow
          systemImage="calendar.badge.exclamationmark"
          label={t`Daily loss limit`}
          value={valueLabel(current.daily_loss_limit)}
          accessory="none"
          onPress={() => editAmount(t`Daily loss limit`, 'daily_loss_limit')}
        />
        <NavRow
          systemImage="chart.pie"
          label={t`Consistency`}
          value={
            current.consistency_pct != null
              ? formatPercent(current.consistency_pct, 0)
              : t`Not set`
          }
          accessory="none"
          onPress={editConsistency}
        />
      </SettingsSection>

      {/* Standalone action, not a row: a filled button inside a section card
          would fill the card edge to edge and read as a red panel. */}
      <CenteredButton
        role="destructive"
        label={remove.isPending ? t`Removing…` : t`Remove prop rules`}
        onPress={confirmDelete}
      />
    </SettingsForm>
  );
}
