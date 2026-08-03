import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { useApiRequest } from '@/api/hooks';
import { FormField, FormInput, FormSheet } from '@/components/form-sheet';
import { t } from '@lingui/core/macro';

/** Quick journal note — full editing and symbol linking live on the web app. */
export default function NewNoteScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiRequest();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const save = useMutation({
    mutationFn: () =>
      api('/notes', {
        method: 'POST',
        body: {
          type: 'note',
          occurred_at: new Date().toISOString(),
          title: title.trim(),
          body: body.trim(),
          symbols: [],
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notes'] });
      router.back();
    },
    onError: (err) => Alert.alert(t`Could not save`, err.message),
  });

  function handleSave() {
    if (!body.trim() && !title.trim()) {
      Alert.alert(t`Could not save`, t`Write something first.`);
      return;
    }
    save.mutate();
  }

  return (
    <FormSheet title={t`New note`} saving={save.isPending} onSave={handleSave}>
      <FormField label={t`Title`}>
        <FormInput value={title} onChangeText={setTitle} placeholder={t`Optional title`} />
      </FormField>
      <FormField label={t`Note`}>
        <FormInput
          value={body}
          onChangeText={setBody}
          placeholder={t`What happened today?`}
          multiline
        />
      </FormField>
    </FormSheet>
  );
}
