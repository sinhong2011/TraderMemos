import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Frame, Text } from 'panelui-native';
import { Alert } from 'react-native';

import { queryKeys, useApiRequest, useRiskRules } from '@/api/hooks';
import type { RiskRules } from '@/api/types';
import { t } from '@lingui/core/macro';
import { SettingsForm } from '@/components/settings-form';
import { SettingsButton, SettingsSection } from '@/components/settings-rows';
import { errorMessage } from '@/lib/errors';
import {
  activeRiskRules,
  availableRiskRules,
  formatRiskRuleValue,
  parseRiskRuleValue,
  setRiskRuleValue,
  validateRiskRuleValue,
  type RiskRuleDef,
} from '@/lib/risk-rules';

/**
 * Risk rules (web RulesTab parity): only active limits are listed — tap one to
 * change or remove it, add unset limits from the section below. Values edit in
 * a native prompt (an Alert with a decimal field), so the list never shows
 * empty inputs like the old four-blank-fields form.
 */
export default function RiskRulesScreen() {
  const queryClient = useQueryClient();
  const api = useApiRequest();
  const rules = useRiskRules();

  const save = useMutation({
    mutationFn: (body: RiskRules) => api('/settings/risk-rules', { method: 'PUT', body }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.riskRules() }),
    onError: (err) => Alert.alert(t`Could not save`, errorMessage(err)),
  });

  function promptForValue(def: RiskRuleDef, current?: number) {
    const unitLabel = def.unit === '%' ? t`Value (%)` : t`Value ($)`;
    Alert.prompt(
      def.label(),
      `${def.detail()}\n${unitLabel}`,
      [
        { text: t`Cancel`, style: 'cancel' },
        {
          text: t`Save`,
          onPress: (raw?: string) => {
            const text = raw ?? '';
            const error = validateRiskRuleValue(def, text);
            if (error) {
              Alert.alert(t`Could not save`, error);
              return;
            }
            save.mutate(setRiskRuleValue(rules.data, def.key, parseRiskRuleValue(text)));
          },
        },
      ],
      'plain-text',
      current != null ? String(current) : '',
      'decimal-pad',
    );
  }

  function confirmRemove(def: RiskRuleDef) {
    Alert.alert(t`Remove rule?`, def.label(), [
      { text: t`Cancel`, style: 'cancel' },
      {
        text: t`Remove`,
        style: 'destructive',
        onPress: () => save.mutate(setRiskRuleValue(rules.data, def.key, null)),
      },
    ]);
  }

  function openActiveRule(def: RiskRuleDef, value: number) {
    Alert.alert(def.label(), formatRiskRuleValue(def, value), [
      { text: t`Cancel`, style: 'cancel' },
      { text: t`Edit`, onPress: () => promptForValue(def, value) },
      { text: t`Remove`, style: 'destructive', onPress: () => confirmRemove(def) },
    ]);
  }

  const active = activeRiskRules(rules.data);
  const available = availableRiskRules(rules.data);

  return (
    <SettingsForm>
      <SettingsSection
        title={t`Active limits`}
        footer={t`Used by Check compliance on New Trade. Add only the limits you want enforced.`}
      >
        {/* A rule row carries a second line the settings vocabulary has no slot
            for — what the limit actually measures — so it is composed from the
            Frame row parts the other rows are built on rather than bent out of
            NavRow. */}
        {active.map(({ def, value }) => (
          <Frame.Row key={def.key} onPress={() => openActiveRule(def, value)}>
            <Frame.Content>
              <Frame.Title>{def.label()}</Frame.Title>
              <Frame.Description>{def.detail()}</Frame.Description>
            </Frame.Content>
            <Frame.Actions>
              <Text size="sm" className="tabular-nums">
                {formatRiskRuleValue(def, value)}
              </Text>
            </Frame.Actions>
          </Frame.Row>
        ))}
        {active.length === 0 ? (
          <Frame.Row>
            <Frame.Content>
              <Text size="sm" muted>
                {rules.isLoading ? t`Loading…` : t`No risk rules yet`}
              </Text>
            </Frame.Content>
          </Frame.Row>
        ) : null}
      </SettingsSection>

      {available.length > 0 ? (
        <SettingsSection title={t`Add a limit`}>
          {available.map((def) => (
            <SettingsButton
              key={def.key}
              systemImage="plus.circle.fill"
              label={def.label()}
              onPress={() => promptForValue(def)}
            />
          ))}
        </SettingsSection>
      ) : null}
    </SettingsForm>
  );
}
