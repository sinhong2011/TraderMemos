import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useApiRequest, useLlmSettings } from '@/api/hooks';
import type { CoachReview, CoachReviewHistory, TradeDetail } from '@/api/types';
import { DashboardCard } from '@/components/dashboard-card';
import { InlineError } from '@/components/error-state';
import { GlassButton } from '@/components/glass-button';
import { useFormatters } from '@/lib/format';
import { resolveMarketTimezone, useDisplayPrefs } from '@/lib/prefs';
import { t } from '@lingui/core/macro';
import {
  computeTradeInsights,
  generateTradeCoachNotes,
  type CoachTone,
  type TradeCoachNote,
} from '@/lib/trade-insights';

function toneLabel(tone: CoachTone): string {
  switch (tone) {
    case 'neg':
      return t`Issue`;
    case 'warn':
      return t`Watch`;
    case 'pos':
      return t`Strength`;
    default:
      return t`Tip`;
  }
}

function NoteRow({ note }: { note: TradeCoachNote }) {
  const { theme } = useUnistyles();
  const toneColor: Record<CoachTone, string> = {
    neg: theme.colors.destructive,
    warn: theme.colors.accent,
    pos: theme.colors.profit,
    tip: theme.colors.primary,
  };
  return (
    <View style={styles.note}>
      <Text style={styles.noteHead}>
        <Text style={[styles.noteTone, { color: toneColor[note.tone] }]}>
          {toneLabel(note.tone)}
        </Text>
        <Text style={styles.noteDot}> · </Text>
        {note.headline}
      </Text>
      <Text style={styles.noteDetail}>{note.detail}</Text>
    </View>
  );
}

/**
 * Trade coach — deterministic rule notes always render (offline, instant);
 * the LLM review is an explicit opt-in tap that layers extra notes on top,
 * mirroring the web TradeCoachPanel.
 */
export function CoachCard({ trade }: { trade: TradeDetail }) {
  const api = useApiRequest();
  const coachSettings = useLlmSettings('coach');
  const coachConfigured = coachSettings.data?.enabled === true;
  const prefs = useDisplayPrefs();
  const { formatDate } = useFormatters();

  const [review, setReview] = useState<CoachReview | null>(null);

  // A review costs a model call, so the last one is read back from the server
  // rather than regenerated when the screen mounts.
  const stored = useQuery({
    queryKey: ['trade-coach-reviews', trade.id],
    queryFn: () => api<CoachReviewHistory>(`/trades/${trade.id}/coach/reviews`),
    enabled: coachConfigured,
  });

  // `tz` is the market timezone the server draws day and week boundaries in
  // when reconstructing the trader's state at this trade's entry.
  const marketTz = resolveMarketTimezone(prefs.marketTimezone);
  const generate = useMutation({
    mutationFn: () =>
      api<CoachReview>(`/trades/${trade.id}/coach?tz=${encodeURIComponent(marketTz)}`, {
        method: 'POST',
      }),
    onSuccess: setReview,
  });

  const insights = computeTradeInsights(trade);
  const localNotes = generateTradeCoachNotes(trade, insights);

  // A freshly generated review wins; otherwise fall back to the newest stored one.
  const latestStored = stored.data?.reviews?.[0];
  const shown: CoachReview | null =
    review ??
    (latestStored
      ? {
          source: 'llm',
          notes: latestStored.notes,
          next_action: latestStored.next_action,
          id: latestStored.id,
          created_at: latestStored.created_at,
        }
      : null);
  const fromStorage = review == null && latestStored != null;

  const llmNotes = shown?.source === 'llm' ? shown.notes : [];
  // Only ever shown alongside the model's own notes — pairing it with the
  // rule-based fallback would attribute the action to advice that never ran.
  const nextAction = shown?.source === 'llm' ? shown.next_action?.trim() : undefined;

  if (localNotes.length === 0 && !coachConfigured) return null;

  return (
    <DashboardCard title={t`Coach`}>
      {localNotes.map((note) => (
        <NoteRow key={note.id} note={note} />
      ))}

      {llmNotes.length > 0 ? (
        <>
          <Text style={styles.sectionLabel}>
            {fromStorage && shown?.created_at
              ? t`AI review · saved ${formatDate(shown.created_at)}`
              : t`AI review`}
          </Text>
          {llmNotes.map((note) => (
            <NoteRow key={note.id} note={note} />
          ))}
          {nextAction ? (
            <View style={styles.nextAction}>
              <Text style={styles.nextActionLabel}>{t`Next action`}</Text>
              <Text style={styles.nextActionBody}>{nextAction}</Text>
            </View>
          ) : null}
        </>
      ) : null}

      {review?.source === 'error' ? (
        <Text style={styles.muted}>{review.error || t`The AI review failed — try again.`}</Text>
      ) : null}
      {review?.source === 'off' ? (
        <Text style={styles.muted}>
          {t`AI coach is turned off — enable it under Settings → AI.`}
        </Text>
      ) : null}
      {generate.error ? (
        <InlineError error={generate.error} onRetry={() => generate.mutate()} />
      ) : null}

      {coachConfigured ? (
        <View style={styles.action}>
          {generate.isPending ? (
            <ActivityIndicator />
          ) : (
            <GlassButton
              label={llmNotes.length > 0 ? t`Regenerate` : t`Ask AI`}
              systemImage="sparkles"
              onPress={() => generate.mutate()}
            />
          )}
        </View>
      ) : localNotes.length > 0 ? (
        <Text style={styles.footnote}>
          {t`Add an AI endpoint under Settings → AI for a model-written review.`}
        </Text>
      ) : null}
    </DashboardCard>
  );
}

const styles = StyleSheet.create((theme) => ({
  note: {
    gap: 4,
    backgroundColor: theme.colors.muted,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 2,
  },
  noteHead: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
    color: theme.colors.mutedForeground,
    textTransform: 'uppercase',
  },
  noteTone: { fontWeight: '700' },
  noteDot: { color: theme.colors.mutedForeground },
  noteDetail: { fontSize: 13, lineHeight: 18, color: theme.colors.mutedForeground },
  nextAction: {
    gap: 4,
    // `fill` is the one surface token stronger than the `muted` the notes use,
    // which is what sets the action apart from them. Not `accent`: that is a
    // section-title *text* colour (amber in dark), and as a ground it reads as
    // a warning state — the exact misuse its token comment warns about.
    backgroundColor: theme.colors.fill,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 2,
  },
  nextActionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: theme.colors.primary,
  },
  nextActionBody: { fontSize: 13, lineHeight: 18, color: theme.colors.foreground },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: theme.colors.mutedForeground,
    paddingTop: theme.spacing.xs,
  },
  // Standalone actions center (the CenteredButton idiom).
  action: { alignItems: 'center', paddingTop: theme.spacing.xs },
  muted: { fontSize: 13, color: theme.colors.mutedForeground },
  footnote: { fontSize: 12, color: theme.colors.mutedForeground },
}));
