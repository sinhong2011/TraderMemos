import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { FormSkeleton } from '@/components/skeleton';

import { useApiRequest, useTags, useTrade } from '@/api/hooks';
import type { Tag, TradeDetail } from '@/api/types';
import { ChipGroup } from '@/components/chips';
import { FormField, FormInput, FormSheet } from '@/components/form-sheet';
import { t } from '@lingui/core/macro';
import {
  TRADE_GRADES,
  buildStructuredJournalNotes,
  gradeFromInt,
  intFromGrade,
  parseJournalNotes,
} from '@/lib/journal';

/**
 * Swipe-action "quick journal": just the post-trade reflection fields (review
 * notes, mistake tags, execution grade), merged into the trade's journal
 * without touching setups/plan/entry-exit reasons.
 */
function QuickJournalForm({ trade, mistakeTags }: { trade: TradeDetail; mistakeTags: Tag[] }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiRequest();

  const notes = parseJournalNotes(trade.notes);
  const [reviewNotes, setReviewNotes] = useState(notes.reviewNotes);
  const [mistakeIds, setMistakeIds] = useState<string[]>(
    trade.tags.filter((tag) => tag.kind === 'mistake').map((tag) => tag.id),
  );
  const [grade, setGrade] = useState(gradeFromInt(trade.trade_quality));
  const keptTagIds = trade.tags.filter((tag) => tag.kind !== 'mistake').map((tag) => tag.id);

  const save = useMutation({
    mutationFn: () =>
      api(`/trades/${trade.id}`, {
        method: 'PATCH',
        body: {
          notes: buildStructuredJournalNotes({
            session: notes.session,
            entryReason: notes.entryReason,
            exitReason: notes.exitReason,
            reviewNotes,
            legacy: notes.legacy,
          }),
          trade_quality: intFromGrade(grade) ?? 0,
          // tag_ids replaces the full set — keep the non-mistake tags as-is.
          tag_ids: [...keptTagIds, ...mistakeIds],
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      router.back();
    },
    onError: (err) => Alert.alert(t`Could not save`, err.message),
  });

  return (
    <FormSheet
      title={t`Quick journal · ${trade.symbol}`}
      saving={save.isPending}
      onSave={() => save.mutate()}
    >
      <FormField label={t`Review notes`}>
        <FormInput
          value={reviewNotes}
          onChangeText={setReviewNotes}
          placeholder={t`What would you do differently?`}
          multiline
          autoFocus
        />
      </FormField>
      {mistakeTags.length > 0 ? (
        <FormField label={t`Mistake type`}>
          <ChipGroup
            options={mistakeTags.map((tag) => ({ value: tag.id, label: tag.name }))}
            selected={mistakeIds}
            onToggle={(id) =>
              setMistakeIds((ids) =>
                ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
              )
            }
            tone="neg"
          />
        </FormField>
      ) : null}
      <FormField label={t`Execution rating`}>
        <ChipGroup
          options={TRADE_GRADES.map((g) => ({ value: g, label: g }))}
          selected={grade ? [grade] : []}
          onToggle={(g) => setGrade(g === grade ? '' : g)}
        />
      </FormField>
    </FormSheet>
  );
}

export default function QuickJournalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: trade, isLoading } = useTrade(id);
  const { data: tags } = useTags();

  if (isLoading || !trade || !tags) {
    return isLoading || !tags ? (
      <View style={styles.loading}>
        <FormSkeleton fields={3} />
      </View>
    ) : (
      <View style={styles.centered}>
        <Text style={styles.muted}>{t`Trade not found`}</Text>
      </View>
    );
  }

  return (
    <QuickJournalForm trade={trade} mistakeTags={tags.filter((tag) => tag.kind === 'mistake')} />
  );
}

const styles = StyleSheet.create((theme) => ({
  loading: { flex: 1, backgroundColor: theme.colors.background },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.background,
  },
  muted: { color: theme.colors.mutedForeground, textAlign: 'center' },
}));
