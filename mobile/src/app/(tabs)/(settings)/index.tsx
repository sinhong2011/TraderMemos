import {
  Button,
  Form,
  Host,
  LabeledContent,
  Section,
  Text as UIText,
  TextField,
  Toggle,
  useNativeState,
} from '@expo/ui/swift-ui';
import { foregroundStyle, keyboardType, scrollDismissesKeyboard } from '@expo/ui/swift-ui/modifiers';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Application from 'expo-application';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { useAccounts, useAnnualGoal, useApiRequest, useRiskRules, queryKeys } from '@/api/hooks';
import { useSession } from '@/api/session';
import type { RiskRules } from '@/api/types';
import { t } from '@lingui/core/macro';
import { formatCurrency } from '@/lib/format';

/** "1234.5" → number, '' → null; NaN rejects with an alert upstream. */
function parseAmount(text: string): number | null | undefined {
  const trimmed = text.trim().replace(/,/g, '');
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

const RISK_FIELDS: { key: keyof RiskRules; label: () => string }[] = [
  { key: 'max_risk_per_trade', label: () => t`Max risk per trade` },
  { key: 'max_daily_loss', label: () => t`Max daily loss` },
  { key: 'max_open_risk', label: () => t`Max open risk` },
  { key: 'default_account_risk_pct', label: () => t`Default account risk %` },
];

/**
 * Native SwiftUI settings form, mirroring the web settings sections that make
 * sense on the phone: accounts, annual goal, risk rules, behavior, about.
 * (OCR / AI-coach / API-token management stays on web.)
 */
export default function SettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiRequest();
  const { session, signOut } = useSession();
  const { data: accounts } = useAccounts();

  const year = new Date().getFullYear();
  const goal = useAnnualGoal(year);
  const rules = useRiskRules();

  const [confirmDestructive, setConfirmDestructive] = useState(true);
  // SwiftUI TextFields bind to observable state; React mirrors (goalText /
  // ruleText) capture keystrokes for submit, same pattern as the login sheet.
  const goalState = useNativeState('');
  const ruleStates: Record<keyof RiskRules, ReturnType<typeof useNativeState<string>>> = {
    max_risk_per_trade: useNativeState(''),
    max_daily_loss: useNativeState(''),
    max_open_risk: useNativeState(''),
    default_account_risk_pct: useNativeState(''),
  };
  // Refs, not state: submit-time reads only, so keystrokes never re-render the form.
  const goalText = useRef('');
  const ruleText = useRef<Record<keyof RiskRules, string>>({
    max_risk_per_trade: '',
    max_daily_loss: '',
    max_open_risk: '',
    default_account_risk_pct: '',
  });

  // Prefill editors once the server values land.
  useEffect(() => {
    if (goal.data) {
      const text = goal.data.amount != null ? String(goal.data.amount) : '';
      goalState.set(text);
      goalText.current = text;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal.data]);
  useEffect(() => {
    if (rules.data) {
      const next = {
        max_risk_per_trade: rules.data.max_risk_per_trade?.toString() ?? '',
        max_daily_loss: rules.data.max_daily_loss?.toString() ?? '',
        max_open_risk: rules.data.max_open_risk?.toString() ?? '',
        default_account_risk_pct: rules.data.default_account_risk_pct?.toString() ?? '',
      };
      for (const key of Object.keys(next) as (keyof RiskRules)[]) ruleStates[key].set(next[key]);
      ruleText.current = next;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules.data]);

  const saveGoal = useMutation({
    mutationFn: (amount: number | null) =>
      amount == null
        ? api('/settings/annual-goal', { method: 'DELETE', params: { year } })
        : api('/settings/annual-goal', { method: 'PUT', body: { year, amount } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.annualGoal(year) });
      Alert.alert(t`Saved`, t`Annual goal updated.`);
    },
    onError: (err) => Alert.alert(t`Could not save`, err.message),
  });

  const saveRules = useMutation({
    mutationFn: (body: RiskRules) => api('/settings/risk-rules', { method: 'PUT', body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.riskRules() });
      Alert.alert(t`Saved`, t`Risk rules updated.`);
    },
    onError: (err) => Alert.alert(t`Could not save`, err.message),
  });

  function handleSaveGoal() {
    const amount = parseAmount(goalText.current);
    if (amount === undefined) {
      Alert.alert(t`Could not save`, t`Enter a valid amount.`);
      return;
    }
    saveGoal.mutate(amount);
  }

  function handleSaveRules() {
    const parsed = {} as RiskRules;
    for (const field of RISK_FIELDS) {
      const value = parseAmount(ruleText.current[field.key]);
      if (value === undefined) {
        Alert.alert(t`Could not save`, t`Enter a valid amount.`);
        return;
      }
      parsed[field.key] = value;
    }
    saveRules.mutate(parsed);
  }

  function handleSignOut() {
    const disconnect = () => {
      void signOut().then(() => router.replace('/login'));
    };
    if (!confirmDestructive) {
      disconnect();
      return;
    }
    Alert.alert(t`Disconnect?`, t`You will need to sign in again to reach this server.`, [
      { text: t`Cancel`, style: 'cancel' },
      { text: t`Disconnect`, style: 'destructive', onPress: disconnect },
    ]);
  }

  const appVersion = Application.nativeApplicationVersion ?? '1.0.0';

  return (
    <Host style={{ flex: 1 }}>
      {/* Decimal pads have no return key — any scroll tucks the keyboard away. */}
      <Form modifiers={[scrollDismissesKeyboard('immediately')]}>
        <Section title={t`Accounts`}>
          {(accounts ?? []).map((account) => (
            <LabeledContent key={account.id} label={account.name}>
              {/* Single string child — the SwiftUI Text bridge can't mount an
                  array of interpolations (RawText crash). */}
              <UIText modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
                {`${account.broker ? `${account.broker} · ` : ''}${account.base_currency} · ${formatCurrency(account.starting_balance, account.base_currency)}`}
              </UIText>
            </LabeledContent>
          ))}
          {accounts?.length === 0 ? <UIText>{t`No accounts yet`}</UIText> : null}
        </Section>

        <Section title={t`${year} goal`}>
          <TextField
            placeholder={t`Target net P&L (blank to clear)`}
            text={goalState}
            onTextChange={(text) => {
              goalText.current = text;
            }}
            modifiers={[keyboardType('decimal-pad')]}
          />
          <Button label={saveGoal.isPending ? t`Saving…` : t`Save goal`} onPress={handleSaveGoal} />
        </Section>

        <Section title={t`Risk rules`}>
          {RISK_FIELDS.map((field) => (
            <LabeledContent key={field.key} label={field.label()}>
              <TextField
                placeholder="0"
                text={ruleStates[field.key]}
                onTextChange={(text) => {
                  ruleText.current = { ...ruleText.current, [field.key]: text };
                }}
                modifiers={[keyboardType('decimal-pad')]}
              />
            </LabeledContent>
          ))}
          <Button
            label={saveRules.isPending ? t`Saving…` : t`Save risk rules`}
            onPress={handleSaveRules}
          />
        </Section>

        <Section title={t`Behavior`}>
          <Toggle
            label={t`Confirm before disconnecting`}
            isOn={confirmDestructive}
            onIsOnChange={setConfirmDestructive}
          />
        </Section>

        <Section title={t`About`}>
          <LabeledContent label={t`Server`}>
            <UIText modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
              {session?.serverUrl ?? t`Not connected`}
            </UIText>
          </LabeledContent>
          <LabeledContent label={t`Version`}>
            <UIText modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
              {appVersion}
            </UIText>
          </LabeledContent>
        </Section>

        {/* footer renders through a Slot — a bare string there mounts as RawText and crashes. */}
        <Section footer={<UIText>{t`OCR, AI coach, and API tokens are managed on the web app.`}</UIText>}>
          <Button role="destructive" label={t`Disconnect`} onPress={handleSignOut} />
        </Section>
      </Form>
    </Host>
  );
}
