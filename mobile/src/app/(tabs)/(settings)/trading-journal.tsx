import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';

import { queryKeys, useAnnualGoal, useApiRequest } from '@/api/hooks';
import { NavRow } from '@/components/nav-row';
import { SettingsForm } from '@/components/settings-form';
import { SettingsSection } from '@/components/settings-rows';
import { usePrompt } from '@/components/use-prompt';
import { parseAmount } from '@/lib/amount';
import { errorMessage } from '@/lib/errors';
import { useFormatters } from '@/lib/format';
import { setMaxScreenshotsPerTrade, useJournalPrefs } from '@/lib/journal-prefs';
import { t } from '@lingui/core/macro';

/**
 * How I trade and how I record it: the annual target, the risk limits that
 * gate New Trade, the journal taxonomy, and the capture cap. One group — a
 * two-row Trading page above a one-row Journal page would be the clutter the
 * hub was folded to avoid.
 *
 * Single values edit in a native prompt (iOS idiom; a dialog on Android via
 * `usePrompt`) rather than an inline field; the row shows the current value.
 */
export default function TradingJournalScreen() {
  const { formatCurrency } = useFormatters();
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiRequest();
  const journalPrefs = useJournalPrefs();
  const { prompt, element: promptElement } = usePrompt();

  const year = new Date().getFullYear();
  const goal = useAnnualGoal(year);

  const saveGoal = useMutation({
    mutationFn: (amount: number | null) =>
      amount == null
        ? api('/settings/annual-goal', { method: 'DELETE', params: { year } })
        : api('/settings/annual-goal', { method: 'PUT', body: { year, amount } }),
    onSuccess: (_, amount) => {
      // Update the cache directly so the row refreshes even if the follow-up
      // refetch is slow or dropped; the invalidate then confirms server truth.
      queryClient.setQueryData(queryKeys.annualGoal(year), { year, amount });
      void queryClient.invalidateQueries({ queryKey: queryKeys.annualGoal(year) });
    },
    onError: (err) => Alert.alert(t`Could not save`, errorMessage(err)),
  });

  function editGoal() {
    prompt({
      title: t`${year} P&L goal`,
      message: t`Leave blank to clear the goal.`,
      defaultValue: goal.data?.amount != null ? String(goal.data.amount) : '',
      keyboardType: 'decimal-pad',
      onSubmit: (text) => {
        const amount = parseAmount(text);
        if (amount === undefined) {
          Alert.alert(t`Could not save`, t`Enter a valid amount.`);
          return;
        }
        saveGoal.mutate(amount);
      },
    });
  }

  function editMaxScreenshots() {
    prompt({
      title: t`Screenshots per trade`,
      message: t`Leave blank for no limit.`,
      defaultValue:
        journalPrefs.maxScreenshotsPerTrade != null
          ? String(journalPrefs.maxScreenshotsPerTrade)
          : '',
      keyboardType: 'number-pad',
      onSubmit: (text) => {
        const raw = text.trim();
        if (raw === '') {
          setMaxScreenshotsPerTrade(null);
          return;
        }
        const parsed = Number(raw);
        if (!Number.isFinite(parsed) || parsed < 1) {
          Alert.alert(t`Could not save`, t`Enter a number of 1 or more.`);
          return;
        }
        setMaxScreenshotsPerTrade(parsed);
      },
    });
  }

  return (
    <>
      <SettingsForm>
        <SettingsSection
          footer={t`Your P&L target shows on the dashboard; risk limits drive Check compliance on New Trade.`}
        >
          {/* NavRow draws the same icon-gutter row throughout, so the value
              rows line up with the pushing rows they sit between. */}
          <NavRow
            systemImage="target"
            label={t`${year} P&L goal`}
            value={
              saveGoal.isPending
                ? t`Saving…`
                : goal.data?.amount != null
                  ? formatCurrency(goal.data.amount)
                  : t`Not set`
            }
            onPress={editGoal}
          />
          <NavRow
            systemImage="shield"
            label={t`Risk rules`}
            onPress={() => router.push('/risk-rules')}
          />
          <NavRow
            systemImage="bell.badge"
            label={t`Alerts`}
            onPress={() => router.push('/alerts')}
          />
          <NavRow systemImage="tag" label={t`Tags`} onPress={() => router.push('/tags')} />
          {/* A capture rule, not a formatting one — it belongs with the
              journal, not on the Display screen it used to sit on. */}
          <NavRow
            systemImage="photo.on.rectangle"
            label={t`Screenshots per trade`}
            value={
              journalPrefs.maxScreenshotsPerTrade != null
                ? String(journalPrefs.maxScreenshotsPerTrade)
                : t`No limit`
            }
            onPress={editMaxScreenshots}
          />
        </SettingsSection>
      </SettingsForm>
      {promptElement}
    </>
  );
}
