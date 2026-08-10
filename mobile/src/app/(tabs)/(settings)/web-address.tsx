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
  textContentType,
  textInputAutocapitalization,
} from '@expo/ui/swift-ui/modifiers';
import { useRouter } from 'expo-router';
import { useRef } from 'react';
import { Alert, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { useSystemInfo } from '@/api/hooks';
import { AppHost } from '@/components/app-host';
import { CenteredButton } from '@/components/centered-button';
import { SettingsForm } from '@/components/settings-form';
import { t } from '@lingui/core/macro';
import { normalizeWebBaseUrl, setWebBaseUrl, useWebBaseUrl } from '@/lib/share-prefs';

/**
 * Where share links point. A pushed page rather than an `Alert.prompt`: a URL
 * is long enough to want a real field, and the page has room to say what the
 * server already advertises so the override is an informed choice.
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

  function clear() {
    setWebBaseUrl(null);
    fieldState.set('');
    fieldText.current = '';
  }

  return (
    <View style={styles.page}>
      <AppHost style={{ flex: 1 }}>
        <SettingsForm>
          <Section
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
            <CenteredButton label={t`Save`} onPress={save} />
          </Section>

          {stored != null ? (
            <Section
              footer={
                <UIText>{t`Clearing falls back to the address your server reports.`}</UIText>
              }
            >
              <CenteredButton label={t`Clear override`} role="destructive" onPress={clear} />
            </Section>
          ) : null}
        </SettingsForm>
      </AppHost>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  page: { flex: 1, backgroundColor: theme.colors.background },
}));
