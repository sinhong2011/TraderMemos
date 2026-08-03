import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { useApiRequest } from '@/api/hooks';
import { FormField, FormInput, FormSheet } from '@/components/form-sheet';
import { t } from '@lingui/core/macro';

/** Preset swatches — brand first, then distinct hues that read in both themes. */
const COLORS = ['#0490C8', '#54BF5C', '#F59E0B', '#FF6467', '#A78BFA', '#F472B6', '#737373'];

/** New playbook setup — a `setup`-kind tag, taggable on trades from the web. */
export default function NewSetupScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiRequest();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COLORS[0]);

  const save = useMutation({
    mutationFn: () =>
      api('/tags', {
        method: 'POST',
        body: { name: name.trim(), color, description: description.trim(), kind: 'setup' },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tags'] });
      router.back();
    },
    onError: (err) => Alert.alert(t`Could not save`, err.message),
  });

  function handleSave() {
    if (!name.trim()) {
      Alert.alert(t`Could not save`, t`Enter a setup name.`);
      return;
    }
    save.mutate();
  }

  return (
    <FormSheet title={t`New setup`} saving={save.isPending} onSave={handleSave}>
      <FormField label={t`Name`}>
        <FormInput
          value={name}
          onChangeText={setName}
          placeholder={t`Breakout pullback`}
          autoCorrect={false}
        />
      </FormField>
      <FormField label={t`Description`}>
        <FormInput
          value={description}
          onChangeText={setDescription}
          placeholder={t`Entry criteria, invalidation, targets…`}
          multiline
        />
      </FormField>
      <FormField label={t`Color`}>
        <View style={styles.swatches}>
          {COLORS.map((value) => (
            <Pressable
              key={value}
              onPress={() => setColor(value)}
              accessibilityRole="button"
              style={[
                styles.swatch,
                { backgroundColor: value },
                value === color && styles.swatchSelected,
              ]}
            />
          ))}
        </View>
      </FormField>
    </FormSheet>
  );
}

const styles = StyleSheet.create((theme) => ({
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: theme.radius.full,
  },
  swatchSelected: {
    borderWidth: 3,
    borderColor: theme.colors.foreground,
  },
}));
