import {
  LabeledContent,
  Section,
  Text as UIText,
  TextField,
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  autocorrectionDisabled,
  keyboardType,
  scrollDismissesKeyboard,
  textContentType,
  textInputAutocapitalization,
} from '@expo/ui/swift-ui/modifiers';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useRef } from 'react';
import { Alert } from 'react-native';

import { useSystemInfo } from '@/api/hooks';
import { AppHost } from '@/components/app-host';
import { CenteredButton } from '@/components/centered-button';
import { HeaderIconButton } from '@/components/header-icon-button';
import { SettingsForm } from '@/components/settings-form';
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

  // The native field owns its text after mount; the ref is what Save reads.
  const fieldState = useNativeState<string>(stored ?? '');
  const fieldText = useRef(stored ?? '');

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
          fieldState.set('');
          fieldText.current = '';
        },
      },
    ]);
  }

  return (
    <AppHost style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          // Pushed settings forms put their commit action in the nav bar
          // (the account-form / ai idiom), not a filled row in the list.
          headerRight: () => (
            <HeaderIconButton systemImage="checkmark" label={t`Save`} onPress={save} />
          ),
        }}
      />
      <SettingsForm modifiers={[scrollDismissesKeyboard('immediately')]}>
        <Section
          title={t`Share links`}
          footer={
            <UIText>
              {advertised
                ? t`Your server reports ${advertised}. Set an address here only to override it.`
                : t`Your server doesn't report one, so share links need this address. Use the domain your web app is served from — not the API address.`}
            </UIText>
          }
        >
          <LabeledContent label={t`Address`}>
            <TextField
              placeholder="https://tm.example.com"
              text={fieldState}
              modifiers={[
                keyboardType('url'),
                textContentType('URL'),
                textInputAutocapitalization('never'),
                autocorrectionDisabled(),
              ]}
              onTextChange={(text) => {
                fieldText.current = text;
              }}
            />
          </LabeledContent>
        </Section>

        {stored != null ? (
          <Section>
            <CenteredButton
              role="destructive"
              label={t`Clear address`}
              onPress={confirmClear}
            />
          </Section>
        ) : null}
      </SettingsForm>
    </AppHost>
  );
}
