import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Share, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { queryKeys, useApiRequest } from '@/api/hooks';
import type { CreatedAccessToken } from '@/api/types';
import { FormInput, FormSheet } from '@/components/form-sheet';
import { GlassButton } from '@/components/glass-button';
import { Segmented } from '@/components/segmented';
import { t } from '@lingui/core/macro';

const EXPIRY_OPTIONS = [
  { value: 'never', label: () => t`Never` },
  { value: '30', label: () => t`30d` },
  { value: '90', label: () => t`90d` },
  { value: '365', label: () => t`1y` },
];

/**
 * New personal access token — a two-step sheet: the form, then the secret.
 * Each step has exactly one bar action (Generate, then Done); the only body
 * button is Share, which does something else entirely. The secret is shown
 * once and never again, so it earns the whole sheet, and step two drops the
 * cancel affordance — the token already exists by then.
 */
export default function NewTokenScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiRequest();

  const [name, setName] = useState('');
  const [expiry, setExpiry] = useState('never');
  const [created, setCreated] = useState<CreatedAccessToken | null>(null);

  const create = useMutation({
    mutationFn: (body: { name: string; expires_in_days?: number }) =>
      api<CreatedAccessToken>('/access-tokens', { method: 'POST', body }),
    onSuccess: (row) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.accessTokens() });
      setCreated(row);
    },
    onError: (err) => Alert.alert(t`Could not create token`, err.message),
  });

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert(t`Could not create token`, t`Token name is required.`);
      return;
    }
    create.mutate(
      expiry === 'never' ? { name: trimmed } : { name: trimmed, expires_in_days: Number(expiry) },
    );
  }

  if (created) {
    return (
      <FormSheet
        title={t`Token created`}
        saveLabel={t`Done`}
        hideClose
        onSave={() => router.back()}
      >
        <Text style={styles.footnote}>
          {t`Copy it now — the secret is shown only once and cannot be recovered.`}
        </Text>
        <Text selectable style={styles.secret}>
          {created.token}
        </Text>
        <GlassButton
          fill
          label={t`Share token`}
          systemImage="square.and.arrow.up"
          onPress={() => void Share.share({ message: created.token })}
        />
      </FormSheet>
    );
  }

  return (
    <FormSheet
      title={t`New token`}
      saving={create.isPending}
      saveLabel={t`Generate`}
      savingLabel={t`Creating…`}
      onSave={handleCreate}
    >
      <Text style={styles.footnote}>
        {t`Tokens authenticate scripts and integrations against your server's API.`}
      </Text>
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{t`Name`}</Text>
        <FormInput
          value={name}
          onChangeText={setName}
          placeholder={t`e.g. CLI import`}
          autoCorrect={false}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleCreate}
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{t`Expiry`}</Text>
        <Segmented
          fill
          options={EXPIRY_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label(),
          }))}
          value={expiry}
          onChange={setExpiry}
        />
      </View>
    </FormSheet>
  );
}

const styles = StyleSheet.create((theme) => ({
  footnote: { fontSize: 13, lineHeight: 18, color: theme.colors.mutedForeground },
  field: { gap: theme.spacing.xs + 2 },
  // Quiet field labels — the sheet title is the only shout.
  fieldLabel: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.3,
    color: theme.colors.mutedForeground,
  },
  secret: {
    fontSize: 14,
    color: theme.colors.foreground,
    backgroundColor: theme.colors.muted,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    padding: theme.spacing.md,
    ...theme.numeric,
  },
}));
