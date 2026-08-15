import { useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { Frame, Input } from 'panelui-native';
import { useRef, useState } from 'react';
import { Alert } from 'react-native';

import { useSystemInfo } from '@/api/hooks';
import { CenteredButton } from '@/components/centered-button';
import { HeaderIconButton } from '@/components/header-icon-button';
import { SettingsForm } from '@/components/settings-form';
import { SettingsSection } from '@/components/settings-rows';
import { t } from '@lingui/core/macro';
import { normalizeWebBaseUrl, setWebBaseUrl, useWebBaseUrl } from '@/lib/share-prefs';

/**
 * Where share links point. A pushed page rather than an `Alert.prompt`: a URL
 * wants a real field, and the page has room to name what the server already
 * advertises so overriding it is an informed choice.
 */
export default function WebAddressScreen() {
  const router = useRouter();
  const stored = useWebBaseUrl();
  const advertised = useSystemInfo().data?.web_url;

  // The field owns its text after mount; the ref is what Save reads. Clearing
  // is the one thing that has to push a value back into it, and remounting on
  // a changed `key` is how an uncontrolled field takes one.
  const fieldText = useRef(stored ?? '');
  const [cleared, setCleared] = useState(false);

  function save() {
    try {
      setWebBaseUrl(normalizeWebBaseUrl(fieldText.current));
      router.back();
    } catch {
      Alert.alert(t`Could not save`, t`Enter a web address like https://tm.example.com.`);
    }
  }

  function confirmClear() {
    Alert.alert(t`Clear this address?`, t`Share links will use whatever your server reports.`, [
      { text: t`Cancel`, style: 'cancel' },
      {
        text: t`Clear`,
        style: 'destructive',
        onPress: () => {
          setWebBaseUrl(null);
          fieldText.current = '';
          setCleared(true);
        },
      },
    ]);
  }

  return (
    <>
      <Stack.Screen
        options={{
          // Pushed settings forms put their commit action in the nav bar
          // (the account-form / ai idiom), not a filled row in the list.
          headerRight: () => (
            <HeaderIconButton systemImage="checkmark" label={t`Save`} onPress={save} />
          ),
        }}
      />
      <SettingsForm>
        <SettingsSection
          title={t`Share links`}
          footer={
            advertised
              ? t`Your server reports ${advertised}. Set an address here only to override it.`
              : t`Your server doesn't report one, so share links need this address. Use the domain your web app is served from — not the API address.`
          }
        >
          {/* The row is `SettingsInput`'s shape with the affordances a URL
              needs on top — no autocapitalisation, no autocorrect, and the
              keyboard with the slash on it. */}
          <Frame.Row>
            <Frame.Content>
              <Frame.Title>{t`Address`}</Frame.Title>
            </Frame.Content>
            <Frame.Actions className="min-w-0 shrink grow justify-end">
              <Input
                key={cleared ? 'cleared' : 'stored'}
                variant="filled"
                size="sm"
                defaultValue={cleared ? '' : (stored ?? '')}
                onChangeText={(text) => {
                  fieldText.current = text;
                }}
                placeholder="https://tm.example.com"
                keyboardType="url"
                textContentType="URL"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel={t`Address`}
                className="text-right"
                containerClassName="w-auto min-w-0 shrink grow"
              />
            </Frame.Actions>
          </Frame.Row>
        </SettingsSection>

        {stored != null ? (
          <CenteredButton role="destructive" label={t`Clear address`} onPress={confirmClear} />
        ) : null}
      </SettingsForm>
    </>
  );
}
