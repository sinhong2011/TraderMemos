import { useMutation } from '@tanstack/react-query';
import { Spinner, cn } from 'panelui-native';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { useApiRequest, useLlmSettings } from '@/api/hooks';
import type { CoachReview, TradeDetail } from '@/api/types';
import { DashboardCard } from '@/components/dashboard-card';
import { InlineError } from '@/components/error-state';
import { GlassButton } from '@/components/glass-button';
import { t } from '@lingui/core/macro';
import {
  computeTradeInsights,
  generateTradeCoachNotes,
  type CoachTone,
  type TradeCoachNote,
} from '@/lib/trade-insights';

/** Tone tint for the leading word — `warn` takes the section-title accent. */
const TONE_CLASS: Record<CoachTone, string> = {
  neg: 'text-destructive',
  warn: 'text-heading',
  pos: 'text-profit',
  tip: 'text-primary',
};

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
  return (
    <View className="gap-1 rounded-md bg-muted px-3 py-2.5">
      <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Text className={cn('font-bold', TONE_CLASS[note.tone])}>{toneLabel(note.tone)}</Text>
        <Text className="text-muted-foreground"> · </Text>
        {note.headline}
      </Text>
      <Text className="text-[13px] leading-[18px] text-muted-foreground">{note.detail}</Text>
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

  const [review, setReview] = useState<CoachReview | null>(null);

  const generate = useMutation({
    mutationFn: () => api<CoachReview>(`/trades/${trade.id}/coach`, { method: 'POST' }),
    onSuccess: setReview,
  });

  const insights = computeTradeInsights(trade);
  const localNotes = generateTradeCoachNotes(trade, insights);
  const llmNotes = review?.source === 'llm' ? review.notes : [];

  if (localNotes.length === 0 && !coachConfigured) return null;

  return (
    <DashboardCard title={t`Coach`}>
      {localNotes.map((note) => (
        <NoteRow key={note.id} note={note} />
      ))}

      {llmNotes.length > 0 ? (
        <>
          <Text className="pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t`AI review`}
          </Text>
          {llmNotes.map((note) => (
            <NoteRow key={note.id} note={note} />
          ))}
        </>
      ) : null}

      {review?.source === 'error' ? (
        <Text className="text-[13px] text-muted-foreground">
          {review.error || t`The AI review failed — try again.`}
        </Text>
      ) : null}
      {review?.source === 'off' ? (
        <Text className="text-[13px] text-muted-foreground">
          {t`AI coach is turned off — enable it under Settings → AI.`}
        </Text>
      ) : null}
      {generate.error ? (
        <InlineError error={generate.error} onRetry={() => generate.mutate()} />
      ) : null}

      {coachConfigured ? (
        // Standalone actions center (the CenteredButton idiom).
        <View className="items-center pt-1">
          {generate.isPending ? (
            <Spinner />
          ) : (
            <GlassButton
              label={llmNotes.length > 0 ? t`Regenerate` : t`Ask AI`}
              systemImage="sparkles"
              onPress={() => generate.mutate()}
            />
          )}
        </View>
      ) : localNotes.length > 0 ? (
        <Text className="text-xs text-muted-foreground">
          {t`Add an AI endpoint under Settings → AI for a model-written review.`}
        </Text>
      ) : null}
    </DashboardCard>
  );
}
