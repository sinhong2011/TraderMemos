import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { Text } from 'panelui-native';
import { useState } from 'react';
import { Alert } from 'react-native';

import { queryKeys, useApiRequest, useRiskRules } from '@/api/hooks';
import type { RiskRules } from '@/api/types';
import { CenteredButton } from '@/components/centered-button';
import { FormField, FormInput, FormScreen } from '@/components/form-kit';
import { FormSkeleton } from '@/components/skeleton';
import { errorMessage } from '@/lib/errors';
import { notify } from '@/lib/haptics';
import { t } from '@lingui/core/macro';
import {
  RISK_RULE_DEFS,
  parseRiskRuleValue,
  setRiskRuleValue,
  validateRiskRuleValue,
  type RiskRuleDef,
} from '@/lib/risk-rules';

/**
 * Set or edit one risk limit's value — an entry form (the form kit), pushed
 * from the Risk rules list, replacing the old single-field prompt so the rule
 * rows get the trades-row anatomy (tap to edit, long-press preview) and the
 * validation lands under the field instead of in an alert.
 */
export default function RiskRuleFormScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const rules = useRiskRules();
  const def = RISK_RULE_DEFS.find((candidate) => candidate.key === key);

  // The form seeds its field from the stored value, so it can't mount until
  // the rules are in cache (no prefill effects) — same gate as cash-form.
  if (!def || (rules.isLoading && rules.data == null)) {
    return (
      <FormScreen>
        <FormSkeleton fields={1} />
      </FormScreen>
    );
  }

  return <RuleForm def={def} rules={rules.data} />;
}

function RuleForm({ def, rules }: { def: RiskRuleDef; rules?: RiskRules }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiRequest();

  const current = rules?.[def.key];
  const [value, setValue] = useState(current != null ? String(current) : '');
  const [fieldError, setFieldError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (body: RiskRules) => api('/settings/risk-rules', { method: 'PUT', body }),
    onSuccess: () => {
      notify('success');
      void queryClient.invalidateQueries({ queryKey: queryKeys.riskRules() });
      router.back();
    },
    onError: (err) => {
      notify('error');
      Alert.alert(t`Could not save`, errorMessage(err));
    },
  });

  function submit() {
    const error = validateRiskRuleValue(def, value);
    if (error) {
      setFieldError(error);
      return;
    }
    save.mutate(setRiskRuleValue(rules, def.key, parseRiskRuleValue(value)));
  }

  const unitLabel =
    def.unit === '%' ? t`Value (%)` : def.unit === 'count' ? t`Value (trades)` : t`Value ($)`;

  return (
    <>
      <Stack.Screen options={{ title: def.label() }} />
      <FormScreen>
        <Text size="sm" muted>
          {def.detail()}
        </Text>
        <FormField label={unitLabel}>
          <FormInput
            value={value}
            onChangeText={(text) => {
              setValue(text);
              if (fieldError) setFieldError(null);
            }}
            errorMessage={fieldError ?? undefined}
            keyboardType="decimal-pad"
            accessibilityLabel={unitLabel}
          />
        </FormField>
        <CenteredButton
          label={save.isPending ? t`Saving…` : t`Save`}
          disabled={value.trim() === ''}
          loading={save.isPending}
          onPress={submit}
        />
      </FormScreen>
    </>
  );
}
