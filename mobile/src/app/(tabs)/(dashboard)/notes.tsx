import { ContentUnavailableView, Host } from '@expo/ui/swift-ui';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { useNotes } from '@/api/hooks';
import type { Note } from '@/api/types';
import { Pill } from '@/components/pill';
import { Segmented } from '@/components/segmented';
import { Skeleton } from '@/components/skeleton';
import { t } from '@lingui/core/macro';
import { locale } from '@/i18n';
import { checklistProgress, noteExcerpt } from '@/lib/markdown';

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

function NoteRow({ note, onPress }: { note: Note; onPress: () => void }) {
  const excerpt = noteExcerpt(note.body);
  const progress = checklistProgress(note.body);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.rowHead}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {note.title || (note.type === 'daily_log' ? t`Daily log` : t`Untitled`)}
        </Text>
        <Text style={styles.rowDay}>{noteDayLabel(note.occurred_at)}</Text>
      </View>
      <View style={styles.rowMeta}>
        <Pill tone={note.type === 'daily_log' ? 'accent' : 'muted'}>
          {note.type === 'daily_log' ? t`Log` : t`Note`}
        </Pill>
        {progress ? (
          <Pill tone={progress.done === progress.total ? 'pos' : 'amber'}>
            {t`${progress.done}/${progress.total} checks`}
          </Pill>
        ) : null}
        {note.symbols.slice(0, 3).map((symbol) => (
          <Pill key={symbol.symbol} tone="muted">
            {symbol.symbol}
          </Pill>
        ))}
      </View>
      {excerpt ? (
        <Text style={styles.rowExcerpt} numberOfLines={2}>
          {excerpt}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** Journal notes and daily logs — browse, search, tap to edit. */
export default function NotesScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [type, setType] = useState<TypeFilter>('all');
  const notes = useNotes();

  const filters = [
    { value: 'all' as const, label: t`All` },
    { value: 'note' as const, label: t`Notes` },
    { value: 'daily_log' as const, label: t`Logs` },
  ];

  const rows = useMemo(() => {
    const q = search.trim();
    return (notes.data ?? [])
      .filter((note) => (type === 'all' || note.type === type) && matchesQuery(note, q))
      .sort(
        (a, b) =>
          b.occurred_at.localeCompare(a.occurred_at) || b.updated_at.localeCompare(a.updated_at),
      );
  }, [notes.data, search, type]);

  return (
    <>
      <Stack.Screen
        options={{
          title: t`Notes`,
          headerSearchBarOptions: {
            placeholder: t`Search notes`,
            hideWhenScrolling: true,
            onChangeText: (event) => setSearch(event.nativeEvent.text),
          },
        }}
      />
      {notes.isLoading ? (
        <View style={[styles.page, styles.skeletonPage]}>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} style={styles.skeletonRow} />
          ))}
        </View>
      ) : notes.error ? (
        <View style={styles.centered}>
          <Text selectable style={styles.muted}>
            {notes.error.message}
          </Text>
        </View>
      ) : (
        <FlashList
          data={rows}
          keyExtractor={(note) => note.id}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={notes.isRefetching} onRefresh={() => void notes.refetch()} />
          }
          renderItem={({ item }) => (
            <NoteRow
              note={item}
              onPress={() => router.push({ pathname: '/edit-note', params: { id: item.id } })}
            />
          )}
          ListHeaderComponent={
            <View style={styles.header}>
              <Segmented options={filters} value={type} onChange={setType} />
            </View>
          }
          ListEmptyComponent={
            <Host style={styles.empty}>
              <ContentUnavailableView
                title={search ? t`No matching notes` : t`No notes yet`}
                systemImage="note.text"
                description={
                  search
                    ? t`Try a different search.`
                    : t`Capture market thoughts or a daily log from the + menu.`
                }
              />
            </Host>
          }
        />
      )}
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  page: { flex: 1, backgroundColor: theme.colors.background },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl * 2,
    backgroundColor: theme.colors.background,
  },
  header: { paddingBottom: theme.spacing.md, alignItems: 'flex-start' },
  row: {
    gap: theme.spacing.xs + 2,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  pressed: { opacity: 0.7 },
  rowHead: { flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing.sm },
  rowTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.colors.foreground },
  rowDay: { fontSize: 12, color: theme.colors.mutedForeground, ...theme.numeric },
  rowMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs + 2 },
  rowExcerpt: { fontSize: 13, lineHeight: 18, color: theme.colors.mutedForeground },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.background,
  },
  muted: { color: theme.colors.mutedForeground, textAlign: 'center' },
  empty: { minHeight: 320 },
  skeletonPage: { paddingTop: 120, padding: theme.spacing.lg, gap: theme.spacing.sm },
  skeletonRow: { height: 92, borderRadius: theme.radius.lg },
}));
