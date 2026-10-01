import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import type { NoteBody } from '@/api/types';
import { FormSheet } from '@/components/form-sheet';
import {
  emptyNoteValues,
  noteHasContent,
  NoteEditor,
  noteSymbolsFor,
  NoteTypeSwitch,
  type NoteFormValues,
} from '@/components/note-form';
import { t } from '@lingui/core/macro';
import { errorMessage } from '@/lib/errors';
import { useQueuedNoteOps } from '@/lib/use-outbox';

/**
 * New note / daily log. The routine is not written into the log any more —
 * its ticks are routine checks of their own (see use-checklist-run.ts), and
 * the notes list reads a log's day of routine from them.
 *
 * Optional `date` (YYYY-MM-DD) and `type` params seed the form — the day
 * review journals the day being reviewed, not today.
 */
export default function NewNoteScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  // Queue-aware save: with the server unreachable the note lands in the
  // offline outbox instead of an error alert (lib/outbox.ts).
  const { createNote } = useQueuedNoteOps();
  const params = useLocalSearchParams<{
    date?: string;
    type?: string;
    title?: string;
    body?: string;
  }>();

  const [values, setValues] = useState<NoteFormValues>(() => ({
    ...emptyNoteValues(),
    ...(params.type === 'daily_log' || params.type === 'note' ? { type: params.type } : {}),
    ...(params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? { occurredAt: params.date }
      : {}),
    ...(params.title ? { title: params.title } : {}),
    ...(params.body ? { body: params.body } : {}),
  }));
  const onChange = (patch: Partial<NoteFormValues>) =>
    setValues((prev) => ({ ...prev, ...patch }));

  const save = useMutation({
    mutationFn: (body: NoteBody) => createNote(body),
    onSuccess: ({ queued }) => {
      // A queued save changed nothing server-side; the pending overlay puts
      // the note in the list until the queue drains.
      if (!queued) void queryClient.invalidateQueries({ queryKey: ['notes'] });
      router.back();
    },
    onError: (err) => Alert.alert(t`Could not save`, errorMessage(err)),
  });

  function handleSave() {
    const body = values.body.trim();
    save.mutate({
      type: values.type,
      occurred_at: values.occurredAt,
      title: values.title.trim(),
      body,
      symbols: noteSymbolsFor(values),
    });
  }

  return (
    <FormSheet
      title={values.type === 'daily_log' ? t`New daily log` : t`New note`}
      titleControl={
        <NoteTypeSwitch value={values.type} onChange={(type) => onChange({ type })} />
      }
      saving={save.isPending}
      // Nothing to save on a blank note — grey the action instead of letting
      // the tap raise an alert (the token sheet's rule).
      saveDisabled={!noteHasContent(values)}
      // The editor owns the whole screen and its own scrolling — the body is
      // the scroller, so a form scroll around it would nest two of them.
      scroll={false}
      onSave={handleSave}
    >
      <NoteEditor values={values} onChange={onChange} />
    </FormSheet>
  );
}
