import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Alert, Pressable, Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useApiRequest, useNote } from '@/api/hooks';
import type { Note, NoteBody } from '@/api/types';
import { FormSheet } from '@/components/form-sheet';
import { FormSkeleton } from '@/components/skeleton';
import {
  noteHasContent,
  NoteEditor,
  noteSymbolsFor,
  NoteTypeSwitch,
  symbolDrafts,
  type NoteFormValues,
} from '@/components/note-form';
import { t } from '@lingui/core/macro';

function valuesFromNote(note: Note): NoteFormValues {
  return {
    type: note.type,
    occurredAt: note.occurred_at.slice(0, 10),
    title: note.title,
    body: note.body,
    symbols: symbolDrafts(note.symbols),
  };
}

function EditNoteForm({ note }: { note: Note }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiRequest();
  const { theme } = useUnistyles();

  const [values, setValues] = useState<NoteFormValues>(() => valuesFromNote(note));
  const onChange = (patch: Partial<NoteFormValues>) =>
    setValues((prev) => ({ ...prev, ...patch }));

  const save = useMutation({
    // PATCH is a full replace on this endpoint — send every field back.
    mutationFn: (body: NoteBody) => api(`/notes/${note.id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notes'] });
      router.back();
    },
    onError: (err) => Alert.alert(t`Could not save`, err.message),
  });

  const remove = useMutation({
    mutationFn: () => api<void>(`/notes/${note.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notes'] });
      router.back();
    },
    onError: (err) => Alert.alert(t`Could not delete`, err.message),
  });

  function handleSave() {
    save.mutate({
      type: values.type,
      occurred_at: values.occurredAt,
      title: values.title.trim(),
      body: values.body,
      symbols: noteSymbolsFor(values),
    });
  }

  function confirmDelete() {
    Alert.alert(t`Delete note?`, t`This cannot be undone.`, [
      { text: t`Cancel`, style: 'cancel' },
      { text: t`Delete`, style: 'destructive', onPress: () => remove.mutate() },
    ]);
  }

  return (
    <FormSheet
      title={t`Edit note`}
      titleControl={
        <NoteTypeSwitch value={values.type} onChange={(type) => onChange({ type })} />
      }
      saving={save.isPending}
      // Emptying a note is a delete, not a save — the toolbar button says so.
      saveDisabled={!noteHasContent(values)}
      scroll={false}
      onSave={handleSave}
    >
      <NoteEditor
        values={values}
        onChange={onChange}
        // Delete rides the editor's toolbar rather than a "danger zone" below
        // the fields: the editor fills the screen, so there is no below.
        trailingAction={
          <Pressable
            onPress={confirmDelete}
            disabled={remove.isPending}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t`Delete note`}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <SymbolView name="trash" size={20} tintColor={theme.colors.destructive} />
          </Pressable>
        }
      />
    </FormSheet>
  );
}

export default function EditNoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const note = useNote(id ?? '');

  if (note.isLoading) {
    return (
      <FormSheet title={t`Edit note`} onSave={() => {}}>
        <FormSkeleton />
      </FormSheet>
    );
  }
  if (note.error || !note.data) {
    return (
      <FormSheet title={t`Edit note`} onSave={() => {}}>
        <Text style={styles.muted} selectable>
          {note.error?.message ?? t`Note not found`}
        </Text>
      </FormSheet>
    );
  }
  return <EditNoteForm note={note.data} />;
}

const styles = StyleSheet.create((theme) => ({
  pressed: { opacity: 0.6 },
  muted: { color: theme.colors.mutedForeground, textAlign: 'center' },
}));
