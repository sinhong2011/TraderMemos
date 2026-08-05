import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { useApiRequest, useChecklistTemplate } from '@/api/hooks';
import type { NoteBody, NoteType } from '@/api/types';
import { FormSheet } from '@/components/form-sheet';
import { emptyNoteValues, NoteFormFields, type NoteFormValues } from '@/components/note-form';
import { t } from '@lingui/core/macro';
import { checklistProgress } from '@/lib/markdown';

/**
 * New note / daily log. Creating a daily log appends the checklist template
 * as markdown task items (create only — edits never re-append), mirroring the
 * web NewNoteDrawer.
 *
 * Optional `date` / `type` params prefill the form — the day review opens it
 * as a log already filed to the day being reviewed.
 */
export default function NewNoteScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiRequest();
  const checklist = useChecklistTemplate();
  const params = useLocalSearchParams<{ date?: string; type?: NoteType }>();

  const [values, setValues] = useState<NoteFormValues>(() => {
    const empty = emptyNoteValues();
    return {
      ...empty,
      type: params.type === 'daily_log' || params.type === 'note' ? params.type : empty.type,
      occurredAt: params.date ?? empty.occurredAt,
    };
  });
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
