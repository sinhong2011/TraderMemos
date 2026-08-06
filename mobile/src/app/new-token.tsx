import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
 * Step one has one bar action (the glass checkmark). Step two is where the design earns
 * its keep: the secret is shown once and never again, so Copy is the body's
 * prominent action, Share sits under it as the alternative, and Done in the
 * bar is only dismissal. Step two drops the cancel affordance — the token
 * already exists by then.
 */
export default function NewTokenScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiRequest();

  const [name, setName] = useState('');
  const [expiry, setExpiry] = useState('never');
  const [created, setCreated] = useState<CreatedAccessToken | null>(null);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The confirmation is a timed label swap, so it must not fire after unmount.
  useEffect(() => () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
  }, []);

  async function copyToken(token: string) {
    await Clipboard.setStringAsync(token);
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 2000);
  }

  const create = useMutation({
    mutationFn: (body: { name: string; expires_in_days?: number }) =>
      api<CreatedAccessToken>('/access-tokens', { method: 'POST', body }),
    onSuccess: (row) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.accessTokens() });
      setCreated(row);
    },
    onError: (err) => Alert.alert(t`Could not create token`, err.message),
  });

  const trimmedName = name.trim();

  function handleCreate() {
    if (!trimmedName) return;
    create.mutate(
      expiry === 'never'
        ? { name: trimmedName }
        : { name: trimmedName, expires_in_days: Number(expiry) },
    );
  }

  if (created) {
    return (
      <FormSheet
        inSheet
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
        <View style={styles.actions}>
          <GlassButton
            fill
            prominent
            label={copied ? t`Copied` : t`Copy token`}
            systemImage={copied ? 'checkmark' : 'doc.on.doc'}
            onPress={() => void copyToken(created.token)}
          />
          <GlassButton
            fill
            label={t`Share token`}
            systemImage="square.and.arrow.up"
            onPress={() => void Share.share({ message: created.token })}
          />
        </View>
      </FormSheet>
    );
  }

  return (
    <FormSheet
      inSheet
      title={t`New token`}
      saving={create.isPending}
      // Commit is the glass checkmark every other creation sheet uses — a
      // named capsule here read as a second title beside "New token".
      // Nothing to generate without a name — grey the action instead of
      // letting the tap raise an alert.
      saveDisabled={!trimmedName}
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
  actions: { gap: theme.spacing.sm },
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
