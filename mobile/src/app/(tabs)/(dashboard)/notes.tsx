
import { FlashList } from '@shopify/flash-list';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { Card, Skeleton, Swipe, type SwipeHandle } from 'panelui-native';
import { useMemo, useRef, useState } from 'react';
import { Alert, Pressable, RefreshControl, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { useNotes } from '@/api/hooks';
import type { Note } from '@/api/types';
import { ErrorState } from '@/components/error-state';
import { Pill } from '@/components/pill';
import { FloatingSearchBar, SearchToggle } from '@/components/search-bar';
import { TradeFilterMenu } from '@/components/trade-filter-menu';
import { t } from '@lingui/core/macro';
import { locale } from '@/i18n';
import { errorMessage } from '@/lib/errors';
import { checklistProgress, noteExcerpt } from '@/lib/markdown';
import { noteMediaIds } from '@/lib/note-media';
import { applyPendingNotes, pendingNoteIds, usePendingOps } from '@/lib/outbox';
import { useQueuedNoteOps } from '@/lib/use-outbox';

type TypeFilter = 'all' | 'note' | 'daily_log';

/** Case-insensitive match over title, body and symbol tickers (web matchesQuery). */
function matchesQuery(note: Note, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  if (note.title.toLowerCase().includes(needle)) return true;
  if (note.body.toLowerCase().includes(needle)) return true;
  return note.symbols.some(
    (s) => s.symbol.toLowerCase().includes(needle) || s.body.toLowerCase().includes(needle),
  );
}

function noteDayLabel(occurredAt: string): string {
  const day = occurredAt.slice(0, 10);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (day === today) return t`Today`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  if (day === yKey) return t`Yesterday`;
  return new Date(`${day}T12:00:00Z`).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: day.slice(0, 4) === today.slice(0, 4) ? undefined : 'numeric',
    timeZone: 'UTC',
  });
}

/** One note: tap to edit, trailing swipe to delete (the api-tokens idiom). */
function NoteRow({
  note,
  pending,
  onPress,
  onDelete,
}: {
  note: Note;
  /** A queued create or edit is waiting for the server — say so on the row. */
  pending: boolean;
  onPress: () => void;
  onDelete: () => void;
}) {
  const swipeable = useRef<SwipeHandle>(null);
  const excerpt = noteExcerpt(note.body);
  const progress = checklistProgress(note.body);
  // The excerpt strips image markdown, so a chart-only note would read as an
  // empty row without this.
  const charts = noteMediaIds(note.body).length;

  return (
    // No full swipe: deleting a note is destructive and should not fire from a
    // hard drag alone.
    <Swipe ref={swipeable} fullSwipe={false}>
      <Swipe.End>
        <Swipe.Action
          color="destructive"
          icon={<Icon name="trash.fill" size={17} tintColor="#FFFFFF" />}
          label={t`Delete`}
          onPress={() => {
            swipeable.current?.close();
            onDelete();
          }}
        />
      </Swipe.End>
      <Pressable onPress={onPress} accessibilityRole="button" className="active:opacity-70">
        <Card className="gap-1.5 rounded-lg border-0 p-4">
          <View className="flex-row items-baseline gap-2">
            <Text className="flex-1 text-[15px] font-semibold text-foreground" numberOfLines={1}>
              {note.title || (note.type === 'daily_log' ? t`Daily log` : t`Untitled`)}
            </Text>
            <Text className="text-xs text-muted-foreground tabular-nums">
              {noteDayLabel(note.occurred_at)}
            </Text>
          </View>
          <View className="flex-row flex-wrap gap-1.5">
            <Pill tone={note.type === 'daily_log' ? 'accent' : 'muted'}>
              {note.type === 'daily_log' ? t`Log` : t`Note`}
            </Pill>
            {pending ? <Pill tone="amber">{t`Waiting to sync`}</Pill> : null}
            {progress ? (
              <Pill tone={progress.done === progress.total ? 'pos' : 'amber'}>
                {t`${progress.done}/${progress.total} checks`}
              </Pill>
            ) : null}
            {charts > 0 ? (
              <Pill tone="muted">{charts === 1 ? t`1 chart` : t`${charts} charts`}</Pill>
            ) : null}
            {note.symbols.slice(0, 3).map((symbol) => (
              <Pill key={symbol.symbol} tone="muted">
                {symbol.symbol}
              </Pill>
            ))}
          </View>
          {excerpt ? (
            <Text className="text-[13px] leading-[18px] text-muted-foreground" numberOfLines={2}>
              {excerpt}
            </Text>
          ) : null}
        </Card>
      </Pressable>
    </Swipe>
  );
}

/** Journal notes and daily logs — browse, search, tap to edit. */
export default function NotesScreen() {
  const router = useRouter();
  // `FlashList` is not a core component Uniwind can take a `className` on, so
  // its content fill has to be a JS value.
  const [background, foreground] = useCSSVariable([
    '--color-background',
    '--color-foreground',
  ]) as [string, string];
  const queryClient = useQueryClient();
  // Queue-aware delete, plus the pending overlay: notes written while the
  // server was unreachable render here from the outbox (lib/outbox.ts).
  const { deleteNote } = useQueuedNoteOps();
  const pendingOps = usePendingOps();
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [type, setType] = useState<TypeFilter>('all');
  const notes = useNotes();

  const remove = useMutation({
    mutationFn: (id: string) => deleteNote(id),
    onSuccess: ({ queued }) => {
      if (!queued) void queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
    onError: (err) => Alert.alert(t`Could not delete note`, errorMessage(err)),
  });

  function confirmDelete(note: Note) {
    const label = note.title || (note.type === 'daily_log' ? t`Daily log` : t`Untitled`);
    Alert.alert(t`Delete note?`, t`“${label}” is removed for good. This cannot be undone.`, [
      { text: t`Cancel`, style: 'cancel' },
      { text: t`Delete`, style: 'destructive', onPress: () => remove.mutate(note.id) },
    ]);
  }

  const addButton = (
    <Pressable
      onPress={() => router.push('/new-note')}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={t`New note`}
      className="h-8 w-8 items-center justify-center active:opacity-70"
    >
      <Icon name="plus" size={18} tintColor={foreground} weight="semibold" />
    </Pressable>
  );

  const filters = [
    { value: 'all', label: t`All` },
    { value: 'note', label: t`Notes` },
    { value: 'daily_log', label: t`Logs` },
  ];

  /*
    The type filter is a nav-bar pull-down, not a segmented control above the
    list (the Trades/Reports idiom): three permanent buttons cost a row at the
    top of a list you mostly scroll, and "All" is the answer nearly every time.
  */
  const headerActions = (
    <View className="flex-row items-center gap-3">
      <TradeFilterMenu
        active={type !== 'all'}
        onReset={() => setType('all')}
        groups={[
          {
            key: 'type',
            options: filters,
            value: type,
            onChange: (value) => setType(value as TypeFilter),
          },
        ]}
      />
      <SearchToggle
        open={searching}
        active={search.trim().length > 0}
        label={t`Search notes`}
        onPress={() => {
          if (searching) setSearch('');
          setSearching((open) => !open);
        }}
      />
      {addButton}
    </View>
  );

  const pendingIds = useMemo(() => pendingNoteIds(pendingOps), [pendingOps]);
  const rows = useMemo(() => {
    const q = search.trim();
    return applyPendingNotes(notes.data, pendingOps)
      .filter((note) => (type === 'all' || note.type === type) && matchesQuery(note, q))
      .sort(
        (a, b) =>
          b.occurred_at.localeCompare(a.occurred_at) || b.updated_at.localeCompare(a.updated_at),
      );
  }, [notes.data, pendingOps, search, type]);

  return (
    <>
      <Stack.Screen
        options={{
          title: t`Notes`,
          // Search is a header button, not `headerSearchBarOptions`: the native
          // bar holds a permanent slot at the top of a list you mostly scroll,
          // and hiding it on scroll leaves its inset behind (see search-bar.tsx).
          headerRight: () => headerActions,
        }}
      />
      {notes.isLoading ? (
        <View className="flex-1 gap-2 bg-background p-4 pt-[120px]">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton
              key={i}
              className="h-[92px] rounded-lg"
              label={i === 0 ? t`Loading your notes` : undefined}
            />
          ))}
        </View>
      ) : notes.error && notes.data == null && rows.length === 0 ? (
        // Only when the persisted cache has nothing either — a dropped
        // connection over notes you already loaded should still let you read
        // them, and the offline banner says the list may be behind. Queued
        // notes count as content too: an offline cold start still journals.
        <ErrorState
          error={notes.error}
          onRetry={() => void notes.refetch()}
          retrying={notes.isRefetching}
        />
      ) : (
        <FlashList
          data={rows}
          keyExtractor={(note) => note.id}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 48,
            backgroundColor: background,
          }}
          // Inline title, not large — see the note in (settings)/funding.tsx. A
          // native RefreshControl on a pushed `headerLargeTitle` screen leaks
          // its 60pt height into the stack's top inset on every push, so the
          // list starts lower each time the screen is entered.
          refreshControl={
            <RefreshControl refreshing={notes.isRefetching} onRefresh={() => void notes.refetch()} />
          }
          renderItem={({ item }) => (
            <NoteRow
              note={item}
              pending={pendingIds.has(item.id)}
              onPress={() => router.push({ pathname: '/edit-note', params: { id: item.id } })}
              onDelete={() => confirmDelete(item)}
            />
          )}
          ItemSeparatorComponent={() => <View className="h-2" />}
          ListEmptyComponent={
            <View className="min-h-[320px]">
              {/* The filter now lives in a pull-down, so an empty list has to
                  say it is narrowed — otherwise a stray "Logs" filter reads as
                  having no notes at all. */}
              <EmptyState
                title={search || type !== 'all' ? t`No matching notes` : t`No notes yet`}
                systemImage="note.text"
                description={
                  search
                    ? t`Try a different search.`
                    : type !== 'all'
                      ? t`Try a different filter.`
                      : t`Capture market thoughts or a daily log from the + menu.`
                }
              />
            </View>
          }
        />
      )}
      <FloatingSearchBar
        open={searching}
        value={search}
        placeholder={t`Search notes`}
        onChangeText={setSearch}
        onClose={() => {
          setSearch('');
          setSearching(false);
        }}
      />
    </>
  );
}
