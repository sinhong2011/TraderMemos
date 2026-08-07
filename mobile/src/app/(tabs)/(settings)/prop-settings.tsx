import {
  Button,
  Picker,
  Section,
  Text as UIText,
} from '@expo/ui/swift-ui';
import { tag } from '@expo/ui/swift-ui/modifiers';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert } from 'react-native';

import { queryKeys, useAccounts, useApiRequest, usePropSettings } from '@/api/hooks';
import type { DrawdownMode, PropSettings } from '@/api/types';
import { CenteredButton } from '@/components/centered-button';
import { SettingsForm } from '@/components/settings-form';
import { t } from '@lingui/core/macro';
import { parseAmount } from '@/lib/amount';
import { errorMessage } from '@/lib/errors';
import { formatPercent, useFormatters } from '@/lib/format';
import { AppHost } from '@/components/app-host';

/**
 * Prop-firm evaluation rules for one account. Every edit PUTs the whole DTO
 * (the endpoint replaces); blank clears that rule. iOS idiom: rows show the
 * value, editing happens in native prompts.
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
    <AppHost style={{ flex: 1 }}>
      <SettingsForm>
        <Section
          title={account ? account.name : t`Prop rules`}
          footer={<UIText>{t`Rules the firm scores this evaluation on. Blank rules are skipped.`}</UIText>}
        >
          <Button
            systemImage="target"
            label={t`Profit target — ${valueLabel(current.profit_target)}`}
            onPress={() => editAmount(t`Profit target`, 'profit_target')}
          />
          <Button
            systemImage="arrow.down.to.line"
            label={t`Max drawdown — ${valueLabel(current.max_drawdown)}`}
            onPress={() => editAmount(t`Max drawdown`, 'max_drawdown')}
          />
          <Picker
            label={t`Drawdown model`}
            selection={current.drawdown_mode}
            onSelectionChange={(value) =>
              save.mutate({ ...current, drawdown_mode: value as DrawdownMode })
            }
          >
            <UIText key="trailing" modifiers={[tag('trailing')]}>
              {t`Trailing — ratchets on every high`}
            </UIText>
            <UIText key="eod" modifiers={[tag('eod')]}>
              {t`EOD trailing — ratchets at day close`}
            </UIText>
            <UIText key="static" modifiers={[tag('static')]}>
              {t`Static — fixed floor`}
            </UIText>
          </Picker>
          <Button
            systemImage="calendar.badge.exclamationmark"
            label={t`Daily loss limit — ${valueLabel(current.daily_loss_limit)}`}
            onPress={() => editAmount(t`Daily loss limit`, 'daily_loss_limit')}
          />
          <Button
            systemImage="chart.pie"
            label={
              current.consistency_pct != null
                ? t`Consistency — ${formatPercent(current.consistency_pct, 0)}`
                : t`Consistency — Not set`
            }
            onPress={editConsistency}
          />
        </Section>

        <Section>
          <CenteredButton
            role="destructive"
            label={remove.isPending ? t`Removing…` : t`Remove prop rules`}
            onPress={confirmDelete}
          />
        </Section>
      </SettingsForm>
    </AppHost>
  );
}
