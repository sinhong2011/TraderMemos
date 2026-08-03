import {
  Button,
  Host,
  HStack,
  Section,
  Spacer,
  Text as UIText,
  VStack,
} from '@expo/ui/swift-ui';
import { font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

import { queryKeys, useApiRequest, useRiskRules } from '@/api/hooks';
import type { RiskRules } from '@/api/types';
import { t } from '@lingui/core/macro';
import { SettingsForm } from '@/components/settings-form';
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
 * a native prompt (iOS Alert with a decimal field), so the list never shows
 * empty inputs like the old four-blank-fields form.
 */
export default function RiskRulesScreen() {
  const queryClient = useQueryClient();
  const api = useApiRequest();
  const rules = useRiskRules();

  const save = useMutation({
    mutationFn: (body: RiskRules) => api('/settings/risk-rules', { method: 'PUT', body }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.riskRules() }),
    onError: (err) => Alert.alert(t`Could not save`, err.message),
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
    <Host style={{ flex: 1 }}>
      <SettingsForm>
        <Section
          title={t`Active limits`}
          footer={
            <UIText>{t`Used by Check compliance on New Trade. Add only the limits you want enforced.`}</UIText>
          }
        >
          {active.map(({ def, value }) => (
            <Button key={def.key} onPress={() => openActiveRule(def, value)}>
              <HStack spacing={8}>
                <VStack alignment="leading" spacing={2}>
                  <UIText modifiers={[foregroundStyle({ type: 'hierarchical', style: 'primary' })]}>
                    {def.label()}
                  </UIText>
                  <UIText
                    modifiers={[
                      font({ size: 13 }),
                      foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                    ]}
                  >
                    {def.detail()}
                  </UIText>
                </VStack>
                <Spacer />
                <UIText modifiers={[foregroundStyle({ type: 'hierarchical', style: 'primary' })]}>
                  {formatRiskRuleValue(def, value)}
                </UIText>
              </HStack>
            </Button>
          ))}
          {active.length === 0 ? (
            <UIText modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
              {rules.isLoading ? t`Loading…` : t`No risk rules yet`}
            </UIText>
          ) : null}
        </Section>

        {available.length > 0 ? (
          <Section title={t`Add a limit`}>
            {available.map((def) => (
              <Button
                key={def.key}
                systemImage="plus.circle.fill"
                label={def.label()}
                onPress={() => promptForValue(def)}
              />
            ))}
          </Section>
        ) : null}
      </SettingsForm>
    </Host>
  );
}
