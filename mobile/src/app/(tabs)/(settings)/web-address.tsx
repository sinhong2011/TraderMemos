import { useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { Button } from 'panelui-native';
import { useRef, useState } from 'react';
import { Alert } from 'react-native';

import { useSystemInfo } from '@/api/hooks';
import { FormField, FormInput, FormScreen } from '@/components/form-kit';
import { HeaderIconButton } from '@/components/header-icon-button';
import { t } from '@lingui/core/macro';
import { normalizeWebBaseUrl, setWebBaseUrl, useWebBaseUrl } from '@/lib/share-prefs';

/**
 * Where share links point. A pushed entry form (the form kit) rather than an
 * `Alert.prompt`: a URL wants a real field, and the page has room to name what
 * the server already advertises so overriding it is an informed choice.
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
  const [error, setError] = useState<string | null>(null);

  function save() {
    try {
      setWebBaseUrl(normalizeWebBaseUrl(fieldText.current));
      router.back();
    } catch {
      setError(t`Enter a web address like https://tm.example.com.`);
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
          // Pushed forms put their commit action in the nav bar (the
          // account-form idiom), not a filled row in the list.
          headerRight: () => (
            <HeaderIconButton systemImage="checkmark" label={t`Save`} onPress={save} />
          ),
        }}
      />
      <FormScreen>
        <FormField label={t`Address`}>
          <FormInput
            key={cleared ? 'cleared' : 'stored'}
            defaultValue={cleared ? '' : (stored ?? '')}
            onChangeText={(text) => {
              fieldText.current = text;
              if (error) setError(null);
            }}
            placeholder="https://tm.example.com"
            description={
              advertised
                ? t`Your server reports ${advertised}. Set an address here only to override it.`
                : t`Your server doesn't report one, so share links need this address. Use the domain your web app is served from — not the API address.`
            }
            errorMessage={error ?? undefined}
            keyboardType="url"
            textContentType="URL"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel={t`Address`}
          />
        </FormField>

        {stored != null ? (
          /* Quiet destructive action — red text, no filled slab; the field
             above is the subject and Clear is the escape hatch. */
          <Button variant="ghost" fullWidth labelClassName="text-destructive" onPress={confirmClear}>
            {t`Clear address`}
          </Button>
        ) : null}
      </FormScreen>
    </>
  );
}
