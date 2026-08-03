import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { useApiRequest, useNote } from '@/api/hooks';
import type { Note, NoteBody } from '@/api/types';
import { FormSheet } from '@/components/form-sheet';
import { FormSkeleton } from '@/components/skeleton';
import { NoteFormFields, type NoteFormValues } from '@/components/note-form';
import { t } from '@lingui/core/macro';

function valuesFromNote(note: Note): NoteFormValues {
  return {
    type: note.type,
    occurredAt: note.occurred_at.slice(0, 10),
    title: note.title,
    body: note.body,
    symbols: note.symbols,
  };
}

function EditNoteForm({ note }: { note: Note }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiRequest();

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
    if (!values.body.trim() && !values.title.trim() && values.symbols.length === 0) {
      Alert.alert(t`Could not save`, t`Write something first.`);
      return;
    }
    save.mutate({
      type: values.type,
      occurred_at: values.occurredAt,
      title: values.title.trim(),
      body: values.body,
      symbols: values.type === 'daily_log' ? values.symbols.filter((s) => s.symbol.trim()) : [],
    });
  }

  function confirmDelete() {
    Alert.alert(t`Delete note?`, t`This cannot be undone.`, [
      { text: t`Cancel`, style: 'cancel' },
      { text: t`Delete`, style: 'destructive', onPress: () => remove.mutate() },
    ]);
  }

  return (
    <FormSheet title={t`Edit note`} saving={save.isPending} onSave={handleSave}>
      <NoteFormFields values={values} onChange={onChange} />
      <View style={styles.dangerZone}>
        <Pressable
          onPress={confirmDelete}
          disabled={remove.isPending}
          accessibilityRole="button"
          style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
        >
          <Text style={styles.deleteLabel}>
            {remove.isPending ? t`Deleting…` : t`Delete note`}
          </Text>
        </Pressable>
      </View>
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
  dangerZone: { paddingTop: theme.spacing.xl, alignItems: 'center' },
  deleteButton: { paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.lg },
  pressed: { opacity: 0.6 },
  deleteLabel: { fontSize: 15, fontWeight: '500', color: theme.colors.destructive },
  muted: { color: theme.colors.mutedForeground, textAlign: 'center' },
}));
