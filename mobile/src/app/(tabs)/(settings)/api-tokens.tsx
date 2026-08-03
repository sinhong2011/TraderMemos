import {
  Button,
  Host,
  HStack,
  LabeledContent,
  Picker,
  Section,
  Spacer,
  Text as UIText,
  TextField,
  useNativeState,
  VStack,
} from '@expo/ui/swift-ui';
import {
  font,
  foregroundStyle,
  monospacedDigit,
  scrollDismissesKeyboard,
  tag,
} from '@expo/ui/swift-ui/modifiers';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Alert, Share } from 'react-native';

import { queryKeys, useAccessTokens, useApiRequest } from '@/api/hooks';
import type { AccessToken, CreatedAccessToken } from '@/api/types';
import { CenteredButton } from '@/components/centered-button';
import { t } from '@lingui/core/macro';
import { SettingsForm } from '@/components/settings-form';
import { formatDate } from '@/lib/format';

const EXPIRY_OPTIONS = [
  { value: 'never', label: () => t`Never expires` },
  { value: '30', label: () => t`30 days` },
  { value: '90', label: () => t`90 days` },
  { value: '365', label: () => t`1 year` },
];

/**
 * Personal access tokens (web ApiTab parity). The secret is shown once, right
 * after creation — hand it off through the share sheet (no clipboard module in
 * the dev-client build), then it is gone for good. Tap a token to revoke it.
 */
export default function ApiTokensScreen() {
  const queryClient = useQueryClient();
  const api = useApiRequest();
  const tokens = useAccessTokens();

  const nameState = useNativeState('');
  const nameText = useRef('');
  const [expiry, setExpiry] = useState('never');
  const [created, setCreated] = useState<CreatedAccessToken | null>(null);

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: queryKeys.accessTokens() });

  const create = useMutation({
    mutationFn: (body: { name: string; expires_in_days?: number }) =>
      api<CreatedAccessToken>('/access-tokens', { method: 'POST', body }),
    onSuccess: (row) => {
      invalidate();
      setCreated(row);
      nameState.set('');
      nameText.current = '';
    },
    onError: (err) => Alert.alert(t`Could not create token`, err.message),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api(`/access-tokens/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
    onError: (err) => Alert.alert(t`Could not revoke token`, err.message),
  });

  function handleCreate() {
    const name = nameText.current.trim();
    if (!name) {
      Alert.alert(t`Could not create token`, t`Token name is required.`);
      return;
    }
    create.mutate(expiry === 'never' ? { name } : { name, expires_in_days: Number(expiry) });
  }

  function confirmRevoke(token: AccessToken) {
    Alert.alert(
      t`Revoke token?`,
      t`“${token.name}” stops working immediately. This cannot be undone.`,
      [
        { text: t`Cancel`, style: 'cancel' },
        { text: t`Revoke`, style: 'destructive', onPress: () => revoke.mutate(token.id) },
      ],
    );
  }

  return (
    <Host style={{ flex: 1 }}>
      <SettingsForm modifiers={[scrollDismissesKeyboard('immediately')]}>
        {created ? (
          <Section
            title={t`New token`}
            footer={
              <UIText>{t`Copy it now — the secret is shown only once and cannot be recovered.`}</UIText>
            }
          >
            <UIText modifiers={[font({ size: 13 }), monospacedDigit()]}>{created.token}</UIText>
            <CenteredButton
              label={t`Share token`}
              onPress={() => void Share.share({ message: created.token })}
            />
            <CenteredButton label={t`Done`} onPress={() => setCreated(null)} />
          </Section>
        ) : (
          <Section
            title={t`Create token`}
            footer={
              <UIText>{t`Tokens authenticate scripts and integrations against your server's API.`}</UIText>
            }
          >
            <LabeledContent label={t`Name`}>
              <TextField
                placeholder={t`e.g. CLI import`}
                text={nameState}
                onTextChange={(text) => {
                  nameText.current = text;
                }}
              />
            </LabeledContent>
            <Picker label={t`Expiry`} selection={expiry} onSelectionChange={setExpiry}>
              {EXPIRY_OPTIONS.map((option) => (
                <UIText key={option.value} modifiers={[tag(option.value)]}>
                  {option.label()}
                </UIText>
              ))}
            </Picker>
            <CenteredButton
              label={create.isPending ? t`Creating…` : t`Generate token`}
              onPress={handleCreate}
            />
          </Section>
        )}

        <Section title={t`Active tokens`} footer={<UIText>{t`Tap a token to revoke it.`}</UIText>}>
          {(tokens.data ?? []).map((token) => (
            <Button key={token.id} onPress={() => confirmRevoke(token)}>
              <HStack spacing={8}>
                <TokenRow token={token} />
                <Spacer />
                <UIText
                  modifiers={[
                    font({ size: 13 }),
                    monospacedDigit(),
                    foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                  ]}
                >
                  {`${token.token_prefix}…`}
                </UIText>
              </HStack>
            </Button>
          ))}
          {(tokens.data ?? []).length === 0 ? (
            <UIText modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
              {tokens.isLoading ? t`Loading…` : t`No tokens yet`}
            </UIText>
          ) : null}
        </Section>
      </SettingsForm>
    </Host>
  );
}

function TokenRow({ token }: { token: AccessToken }) {
  const expires = token.expires_at ? formatDate(token.expires_at) : t`never`;
  const lastUsed = token.last_used_at ? formatDate(token.last_used_at) : t`never`;
  return (
    <VStack alignment="leading" spacing={2}>
      <UIText modifiers={[foregroundStyle({ type: 'hierarchical', style: 'primary' })]}>
        {token.name}
      </UIText>
      <UIText
        modifiers={[
          font({ size: 13 }),
          foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
        ]}
      >
        {t`Expires ${expires} · Last used ${lastUsed}`}
      </UIText>
    </VStack>
  );
}
