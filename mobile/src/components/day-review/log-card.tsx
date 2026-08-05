import { Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import type { Note } from '@/api/types';
import { DashboardCard } from '@/components/dashboard-card';
import { Pill } from '@/components/pill';
import { Skeleton } from '@/components/skeleton';
import { t } from '@lingui/core/macro';
import { checklistProgress, noteExcerpt } from '@/lib/markdown';

function LogRow({ note, onPress }: { note: Note; onPress: () => void }) {
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
        {progress ? (
          <Pill tone={progress.done === progress.total ? 'pos' : 'amber'}>
            {t`${progress.done}/${progress.total} checks`}
          </Pill>
        ) : null}
      </View>
      {excerpt ? (
        <Text style={styles.rowExcerpt} numberOfLines={2}>
          {excerpt}
        </Text>
      ) : null}
    </Pressable>
  );
}

/**
 * What you wrote down while the day was fresh. Daily logs win when the day has
 * both — a plain note from that date is a fallback, not the point.
 */
export function LogCard({
  notes,
  loading,
  onOpenNote,
  onNewLog,
}: {
  notes: Note[];
  loading: boolean;
  onOpenNote: (note: Note) => void;
  onNewLog: () => void;
}) {
  const logs = notes.filter((note) => note.type === 'daily_log');
  const shown = logs.length > 0 ? logs : notes;

  return (
    <DashboardCard title={t`Daily log`} action={{ label: t`New log`, onPress: onNewLog }}>
      {loading ? (
        <Skeleton style={styles.skeleton} />
      ) : shown.length === 0 ? (
        <Text style={styles.empty}>
          {t`Nothing journaled for this day yet. A two-minute recap while it's fresh beats a perfect writeup never written.`}
        </Text>
      ) : (
        <View style={styles.rows}>
          {shown.map((note) => (
            <LogRow key={note.id} note={note} onPress={() => onOpenNote(note)} />
          ))}
        </View>
      )}
    </DashboardCard>
  );
}

const styles = StyleSheet.create((theme) => ({
  rows: { gap: theme.spacing.xs },
  row: {
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
  },
  pressed: { backgroundColor: theme.colors.muted },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  rowTitle: { flexShrink: 1, fontSize: 14, fontWeight: '500', color: theme.colors.foreground },
  rowExcerpt: { fontSize: 13, lineHeight: 18, color: theme.colors.mutedForeground },
  empty: { fontSize: 13, lineHeight: 19, color: theme.colors.mutedForeground },
  skeleton: { height: 64 },
}));
