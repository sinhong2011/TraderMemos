import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Share, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { queryKeys, useApiRequest } from '@/api/hooks';
import type { CreatedAccessToken } from '@/api/types';
import { FormInput } from '@/components/form-sheet';
import { GlassButton } from '@/components/glass-button';
import { Segmented } from '@/components/segmented';
import { ToolSheet } from '@/components/tool-sheet';
import { t } from '@lingui/core/macro';

const EXPIRY_OPTIONS = [
  { value: 'never', label: () => t`Never` },
  { value: '30', label: () => t`30d` },
  { value: '90', label: () => t`90d` },
  { value: '365', label: () => t`1y` },
];

/**
 * New personal access token — a two-step sheet: the form, then the secret.
 * The secret is shown once and never again, so it earns the whole sheet
 * instead of a banner on the list behind it; hand it off through the share
 * sheet (no clipboard module in the dev-client build).
 */
export default function NewTokenScreen() {
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
      <ToolSheet title={t`Token created`}>
        <Text style={styles.footnote}>
          {t`Copy it now — the secret is shown only once and cannot be recovered.`}
        </Text>
        <Text selectable style={styles.secret}>
          {created.token}
        </Text>
        <GlassButton
          prominent
          fill
          label={t`Share token`}
          systemImage="square.and.arrow.up"
          onPress={() => void Share.share({ message: created.token })}
        />
      </ToolSheet>
    );
  }

  return (
    <ToolSheet title={t`New token`}>
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
      <GlassButton
        prominent
        fill
        label={create.isPending ? t`Creating…` : t`Generate token`}
        systemImage="key"
        disabled={create.isPending}
        onPress={handleCreate}
      />
    </ToolSheet>
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
