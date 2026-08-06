import { Button, HStack, Image, Section, Spacer, Text as UIText } from '@expo/ui/swift-ui';
import { foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { queryKeys, useAnnualGoal, useApiRequest } from '@/api/hooks';
import { AppHost } from '@/components/app-host';
import { NavRow } from '@/components/nav-row';
import { SettingsForm } from '@/components/settings-form';
import { parseAmount } from '@/lib/amount';
import { formatCurrency } from '@/lib/format';
import { setMaxScreenshotsPerTrade, useJournalPrefs } from '@/lib/journal-prefs';
import { t } from '@lingui/core/macro';

/**
 * How I trade and how I record it: the annual target, the risk limits that
 * gate New Trade, the journal taxonomy, and the capture cap. One group — a
 * two-row Trading page above a one-row Journal page would be the clutter the
 * hub was folded to avoid.
 *
 * Single values edit in a native prompt (iOS idiom) rather than an inline
 * field; the row shows the current value.
 */
export default function TradingJournalScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiRequest();
  const { theme } = useUnistyles();
  const journalPrefs = useJournalPrefs();

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
    onError: (err) => Alert.alert(t`Could not save`, err.message),
  });

  function editGoal() {
    Alert.prompt(
      t`${year} P&L goal`,
      t`Leave blank to clear the goal.`,
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
            saveGoal.mutate(amount);
          },
        },
      ],
      'plain-text',
      goal.data?.amount != null ? String(goal.data.amount) : '',
      'decimal-pad',
    );
  }

  function editMaxScreenshots() {
    Alert.prompt(
      t`Screenshots per trade`,
      t`Leave blank for no limit.`,
      [
        { text: t`Cancel`, style: 'cancel' },
        {
          text: t`Save`,
          onPress: (text?: string) => {
            const raw = (text ?? '').trim();
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
        },
      ],
      'plain-text',
      journalPrefs.maxScreenshotsPerTrade != null
        ? String(journalPrefs.maxScreenshotsPerTrade)
        : '',
      'number-pad',
    );
  }

  return (
    <AppHost style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SettingsForm>
        <Section
          footer={
            <UIText>{t`Your P&L target shows on the dashboard; risk limits drive Check compliance on New Trade.`}</UIText>
          }
        >
          {/* Same 12pt icon gutter as NavRow, so the value rows line up with
              the pushing rows they sit between. */}
          <Button onPress={editGoal}>
            <HStack spacing={12}>
              <Image systemName="target" size={17} color={theme.colors.foreground} />
              <UIText modifiers={[foregroundStyle({ type: 'hierarchical', style: 'primary' })]}>
                {t`${year} P&L goal`}
              </UIText>
              <Spacer />
              <UIText modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
                {saveGoal.isPending
                  ? t`Saving…`
                  : goal.data?.amount != null
                    ? formatCurrency(goal.data.amount)
                    : t`Not set`}
              </UIText>
              <Image systemName="chevron.right" size={12} color={theme.colors.mutedForeground} />
            </HStack>
          </Button>
          <NavRow
            systemImage="shield"
            label={t`Risk rules`}
            onPress={() => router.push('/risk-rules')}
          />
          <NavRow systemImage="tag" label={t`Tags`} onPress={() => router.push('/tags')} />
          {/* A capture rule, not a formatting one — it belongs with the
              journal, not on the Display screen it used to sit on. */}
          <Button onPress={editMaxScreenshots}>
            <HStack spacing={12}>
              <Image systemName="photo.on.rectangle" size={17} color={theme.colors.foreground} />
              <UIText modifiers={[foregroundStyle({ type: 'hierarchical', style: 'primary' })]}>
                {t`Screenshots per trade`}
              </UIText>
              <Spacer />
              <UIText modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
                {journalPrefs.maxScreenshotsPerTrade != null
                  ? String(journalPrefs.maxScreenshotsPerTrade)
                  : t`No limit`}
              </UIText>
              <Image systemName="chevron.right" size={12} color={theme.colors.mutedForeground} />
            </HStack>
          </Button>
        </Section>
      </SettingsForm>
    </AppHost>
  );
}
