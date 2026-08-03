import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { useApiRequest, useChecklistTemplate } from '@/api/hooks';
import type { NoteBody } from '@/api/types';
import { FormSheet } from '@/components/form-sheet';
import { emptyNoteValues, NoteFormFields, type NoteFormValues } from '@/components/note-form';
import { t } from '@lingui/core/macro';
import { checklistProgress } from '@/lib/markdown';

/**
 * New note / daily log. Creating a daily log appends the checklist template
 * as markdown task items (create only — edits never re-append), mirroring the
 * web NewNoteDrawer.
 */
export default function NewNoteScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiRequest();
  const checklist = useChecklistTemplate();

  const [values, setValues] = useState<NoteFormValues>(emptyNoteValues);
  const onChange = (patch: Partial<NoteFormValues>) =>
    setValues((prev) => ({ ...prev, ...patch }));

  const save = useMutation({
    mutationFn: (body: NoteBody) => api('/notes', { method: 'POST', body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notes'] });
      router.back();
    },
    onError: (err) => Alert.alert(t`Could not save`, err.message),
  });

  function handleSave() {
    const isLog = values.type === 'daily_log';
    let body = values.body.trim();
    if (!body && !values.title.trim() && values.symbols.length === 0) {
      Alert.alert(t`Could not save`, t`Write something first.`);
      return;
    }
    // Append the checklist template once, unless the body already has task items.
    const items = checklist.data?.items ?? [];
    if (isLog && items.length > 0 && checklistProgress(body) == null) {
      const block = items.map((item) => `- [ ] ${item}`).join('\n');
      body = body ? `${body}\n\n${t`Checklist`}:\n${block}` : `${t`Checklist`}:\n${block}`;
    }
    save.mutate({
      type: values.type,
      occurred_at: values.occurredAt,
      title: values.title.trim(),
      body,
      symbols: isLog ? values.symbols.filter((s) => s.symbol.trim()) : [],
    });
  }

  return (
    <FormSheet
      title={values.type === 'daily_log' ? t`New daily log` : t`New note`}
      saving={save.isPending}
      onSave={handleSave}
    >
      <NoteFormFields values={values} onChange={onChange} />
    </FormSheet>
  );
}
