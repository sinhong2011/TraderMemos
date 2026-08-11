import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { FormSkeleton } from '@/components/skeleton';

import { useApiRequest, useTags, useTrade, useTrades } from '@/api/hooks';
import type { Tag, Trade, TradeDetail } from '@/api/types';
import { ChipGroup } from '@/components/chips';
import { FormField, FormInput, FormSheet } from '@/components/form-sheet';
import { Pill } from '@/components/pill';
import { errorMessage } from '@/lib/errors';
import { useFormatters } from '@/lib/format';
import { useProUnlocked } from '@/lib/pro';
import { pnlColor } from '@/styles/unistyles';
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
  const entryReason = notes.entryReason.trim();
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
    onError: (err) => Alert.alert(t`Could not save`, errorMessage(err)),
  });

  return (
    // Title is just "Review": the sheet header truncates at 55% width, and the
    // trade it belongs to is stated properly in the summary below anyway.
    <FormSheet title={t`Review`} saving={save.isPending} onSave={() => save.mutate()}>
      <TradeSummary trade={trade} />
      {entryReason ? (
        // What you told yourself at entry — the thing the review is measured
        // against. Read-only here; editing it belongs in the full trade form.
        <View style={styles.recall}>
          <Text style={styles.recallLabel}>{t`Entry reason`}</Text>
          <Text style={styles.recallBody}>{entryReason}</Text>
        </View>
      ) : null}
      <FormField label={t`Review notes`}>
        <FormInput
          value={reviewNotes}
          onChangeText={setReviewNotes}
          placeholder={t`What would you do differently?`}
          multiline
          autoFocus
        />
      </FormField>
      <FormField label={t`Execution rating`}>
        <ChipGroup
          options={TRADE_GRADES.map((g) => ({ value: g, label: g }))}
          selected={grade ? [grade] : []}
          onToggle={(g) => setGrade(g === grade ? '' : g)}
          select="single"
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
    </FormSheet>
  );
}

/**
 * What am I reviewing? The sheet opens from a swipe on a list row, so without
 * this the only anchor was a symbol in a truncating title.
 */
function TradeSummary({ trade }: { trade: TradeDetail }) {
  const { theme } = useUnistyles();
  // Formatters bound to the display prefs (see lib/format.ts).
  const { formatDate, formatPnl } = useFormatters();
  const isOpen = trade.status === 'open';
  const isLong = trade.direction === 'long';
  return (
    <View style={styles.summary}>
      <View style={styles.summaryTop}>
        <Text style={styles.symbol} numberOfLines={1}>
          {trade.symbol}
        </Text>
        <Text
          style={[
            styles.pnl,
            { color: isOpen ? theme.colors.mutedForeground : pnlColor(theme.colors, trade.net_pnl) },
          ]}
        >
          {isOpen ? t`Open` : formatPnl(trade.net_pnl, trade.pnl_currency)}
        </Text>
      </View>
      <View style={styles.summaryMeta}>
        <Pill tone={isLong ? 'pos' : 'neg'}>{isLong ? t`LONG` : t`SHORT`}</Pill>
        <Text style={styles.summaryDate}>{formatDate(trade.opened_at)}</Text>
      </View>
    </View>
  );
}

/**
 * The trade an id-less launch reviews: most recently closed, or newest overall
 * while nothing has closed yet. The list arrives opened_at-desc, so the closed
 * pass has to compare closed_at itself.
 */
function latestReviewableTrade(trades: Trade[]): Trade | undefined {
  let latestClosed: Trade | undefined;
  for (const trade of trades) {
    if (trade.status !== 'closed' || !trade.closed_at) continue;
    if (!latestClosed || Date.parse(trade.closed_at) > Date.parse(latestClosed.closed_at!)) {
      latestClosed = trade;
    }
  }
  return latestClosed ?? trades[0];
}

export default function QuickJournalScreen() {
  // Opened either from a trade row with an explicit id, or id-less from the
  // App Intents surfaces (Siri / Action Button / Control Center deep-link
  // tradermemos://quick-journal?latest=1) — then the latest trade is resolved
  // here. That intent wrapper is the Pro candidate (docs/mobile-monetization-plan.md
  // #3), hence the seam on the id-less path only.
  const { id } = useLocalSearchParams<{ id?: string }>();
  const unlocked = useProUnlocked('appIntents');
  const wantLatest = !id && unlocked;
  const { data: trades, isLoading: tradesLoading } = useTrades({}, { enabled: wantLatest });
  const resolvedId = id ?? (wantLatest && trades ? latestReviewableTrade(trades)?.id : undefined);
  const { data: trade, isLoading } = useTrade(resolvedId ?? '');
  const { data: tags } = useTags();

  if (!resolvedId && !(wantLatest && tradesLoading)) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>{t`No trades to review yet`}</Text>
      </View>
    );
  }

  if (isLoading || tradesLoading || !trade || !tags) {
    return isLoading || tradesLoading || !tags ? (
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
  summary: {
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.card,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  symbol: { flexShrink: 1, fontSize: 20, fontWeight: '700', color: theme.colors.foreground },
  pnl: { fontSize: 20, fontWeight: '700', letterSpacing: -0.4, ...theme.numeric },
  summaryMeta: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  summaryDate: { fontSize: 13, color: theme.colors.mutedForeground, ...theme.numeric },
  recall: { gap: theme.spacing.xs },
  recallLabel: { fontSize: 12, color: theme.colors.mutedForeground },
  recallBody: { fontSize: 14, lineHeight: 20, color: theme.colors.mutedForeground },
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
