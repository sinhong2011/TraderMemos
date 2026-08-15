import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Icon } from '@/components/icon';
import { useNote } from '@/api/hooks';
import type { Note, NoteBody } from '@/api/types';
import { ErrorState } from '@/components/error-state';
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
import { errorMessage } from '@/lib/errors';
import { applyPendingNotes, isQueuedNoteId, usePendingOps } from '@/lib/outbox';
import { useQueuedNoteOps } from '@/lib/use-outbox';

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
  // Queue-aware writes: unreachable-server saves land in the offline outbox,
  // and a note whose create is still queued is edited in place there.
  const { updateNote, deleteNote } = useQueuedNoteOps();
  const { theme } = useUnistyles();

  const [values, setValues] = useState<NoteFormValues>(() => valuesFromNote(note));
  const onChange = (patch: Partial<NoteFormValues>) =>
    setValues((prev) => ({ ...prev, ...patch }));

  const save = useMutation({
    // PATCH is a full replace on this endpoint — send every field back.
    mutationFn: (body: NoteBody) => updateNote(note.id, body),
    onSuccess: ({ queued }) => {
      if (!queued) void queryClient.invalidateQueries({ queryKey: ['notes'] });
      router.back();
    },
    onError: (err) => Alert.alert(t`Could not save`, errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: () => deleteNote(note.id),
    onSuccess: ({ queued }) => {
      if (!queued) void queryClient.invalidateQueries({ queryKey: ['notes'] });
      router.back();
    },
    onError: (err) => Alert.alert(t`Could not delete`, errorMessage(err)),
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
            <Icon name="trash" size={20} tintColor={theme.colors.destructive} />
          </Pressable>
        }
      />
    </FormSheet>
  );
}

export default function EditNoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queued = id != null && isQueuedNoteId(id);
  // A queued note has nothing to fetch — it exists only in the outbox.
  const note = useNote(queued ? '' : (id ?? ''));
  const ops = usePendingOps();

  // The note as the user last left it: the queued create itself, or the
  // fetched note with any still-pending edit applied — editing the server's
  // copy under a queued edit would silently roll that edit back on save.
  const overlaid = applyPendingNotes(note.data ? [note.data] : [], ops).find(
    (candidate) => candidate.id === id,
  );

  // Queued notes latch at mount: the outbox store is synchronous, and a drain
  // mid-edit (the create synced, its row vanished) must not tear the form down
  // under the user's fingers — `resolveNoteId` follows the id to the server on
  // save. Fetched notes need no latch; the query cache never takes data away.
  const [mountQueued] = useState<Note | undefined>(() => (queued ? overlaid : undefined));
  const resolved = queued ? mountQueued : overlaid;

  if (resolved != null) return <EditNoteForm note={resolved} />;

  if (!queued && note.isLoading) {
    return (
      <FormSheet title={t`Edit note`} onSave={() => {}}>
        <FormSkeleton />
      </FormSheet>
    );
  }
  // A cached note still edits — the save is what will fail, and it says so.
  if (note.error && !note.data) {
    return (
      <ErrorState
        error={note.error}
        onRetry={() => void note.refetch()}
        retrying={note.isRefetching}
      />
    );
  }
  // Nothing fetched and nothing queued under this id — a stale link.
  return (
    <FormSheet title={t`Edit note`} onSave={() => {}}>
      <Text style={styles.muted}>{t`Note not found`}</Text>
    </FormSheet>
  );
}

const styles = StyleSheet.create((theme) => ({
  pressed: { opacity: 0.6 },
  muted: { color: theme.colors.mutedForeground, textAlign: 'center' },
}));
