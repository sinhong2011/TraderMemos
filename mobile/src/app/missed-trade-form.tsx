import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { queryKeys, useAccounts, useApiRequest, useMissedTrades, useSetups } from '@/api/hooks';
import type { MissedOutcome, MissedReason, MissedTrade, MissedTradeBody } from '@/api/types';
import { DateField } from '@/components/date-field';
import { FormPicker } from '@/components/form-kit';
import { FormField, FormFootnote, FormInput, FormSheet } from '@/components/form-sheet';
import { Segmented } from '@/components/segmented';
import { FormSkeleton } from '@/components/skeleton';
import { t } from '@lingui/core/macro';
import { parseAmount } from '@/lib/amount';
import { errorMessage } from '@/lib/errors';
import { isoToWallClock, wallClockToIso } from '@/lib/prefs';
import { missedOutcomes, missedReasons, planProblem, plannedR } from '@/lib/missed';

/**
 * Log / edit a missed trade — a setup seen and not taken. Pushed from the
 * Missed trades list's + and its rows (the cash-form shape). Misses never
 * touch trade stats; with a full plan and an outcome they price what passing
 * cost (or saved) in R.
 */
export default function MissedTradeFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const list = useMissedTrades();
  const editing = id ? list.data?.find((m) => m.id === id) : undefined;

  // The fields initialize from the row, so the form waits for it (no prefill
  // effects) — the cash-form rule.
  if (id != null && !editing) {
    return (
      <FormSheet pushed title={t`Missed trade`} onSave={() => {}}>
        <FormSkeleton fields={6} />
      </FormSheet>
    );
  }
  return <MissedTradeForm editing={editing} />;
}

const priceText = (v: number | null | undefined) => (v == null ? '' : String(v));

/**
 * The picker edits a device-local Date, but times read in the display timezone
 * everywhere else (the list included). So the field carries the display-zone
 * wall clock as if it were local, and saving reads it back in that zone — the
 * same wall-clock contract as the trade form.
 */
function displayWallDate(iso: string): Date {
  // An offsetless ISO string parses as device-local time.
  return new Date(isoToWallClock(iso));
}

function wallDateToIso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const wall = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
  return wallClockToIso(wall);
}

function MissedTradeForm({ editing }: { editing: MissedTrade | undefined }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiRequest();
  const { data: setups } = useSetups();
  const { data: accounts } = useAccounts();

  const [symbol, setSymbol] = useState(editing?.symbol ?? '');
  const [direction, setDirection] = useState<'long' | 'short'>(editing?.direction ?? 'long');
  const [observed, setObserved] = useState(() =>
    displayWallDate(editing?.observed_at ?? new Date().toISOString()),
  );
  const [entry, setEntry] = useState(priceText(editing?.entry));
  const [stop, setStop] = useState(priceText(editing?.stop));
  const [target, setTarget] = useState(priceText(editing?.target));
  const [reason, setReason] = useState<MissedReason>(editing?.reason ?? '');
  const [outcome, setOutcome] = useState<MissedOutcome>(editing?.outcome ?? 'unknown');
  const [setupId, setSetupId] = useState(editing?.setup_id ?? '');
  const [accountId, setAccountId] = useState(
    editing ? (editing.account_id ?? '') : accounts?.length === 1 ? accounts[0].id : '',
  );
  const [notes, setNotes] = useState(editing?.notes ?? '');

  const prices = { entry: parseAmount(entry), stop: parseAmount(stop), target: parseAmount(target) };
  const problem = planProblem({ direction, ...prices });
  const planned = problem ? null : plannedR({ direction, ...prices });

  const save = useMutation({
    mutationFn: (body: MissedTradeBody) =>
      editing
        ? api<MissedTrade>(`/missed-trades/${editing.id}`, { method: 'PUT', body })
        : api<MissedTrade>('/missed-trades', { method: 'POST', body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.missedTrades() });
      router.back();
    },
    onError: (err) => Alert.alert(t`Could not save`, errorMessage(err)),
  });

  const trimmed = symbol.trim();

  function handleSave() {
    if (!trimmed || problem) return;
    save.mutate({
      symbol: trimmed.toUpperCase(),
      direction,
      observed_at: wallDateToIso(observed),
      // planProblem already refused undefined (an unparseable price).
      entry: prices.entry ?? null,
      stop: prices.stop ?? null,
      target: prices.target ?? null,
      reason,
      outcome,
      setup_id: setupId || null,
      account_id: accountId || null,
      notes: notes.trim(),
    });
  }

  return (
    <FormSheet
      pushed
      title={editing ? t`Edit missed trade` : t`Log a missed trade`}
      saving={save.isPending}
      saveDisabled={!trimmed || problem != null}
      onSave={handleSave}
    >
      <FormFootnote>{t`A setup you saw and didn't take. It stays out of your trade stats.`}</FormFootnote>
      <FormField quiet label={t`Symbol`}>
        <FormInput
          value={symbol}
          onChangeText={setSymbol}
          placeholder="NVDA"
          autoCapitalize="characters"
          autoCorrect={false}
        />
      </FormField>
      <FormField quiet label={t`Side`}>
        <Segmented
          fill
          options={[
            { value: 'long' as const, label: t`Long` },
            { value: 'short' as const, label: t`Short` },
          ]}
          value={direction}
          onChange={setDirection}
        />
      </FormField>
      <FormField quiet label={t`When you saw it`}>
        <View className="flex-row">
          <DateField
            selection={observed}
            displayedComponents={['date', 'hourAndMinute']}
            onDateChange={(date) => setObserved(new Date(date))}
          />
        </View>
      </FormField>
      <View className="flex-row gap-2">
        <View className="flex-1">
          <FormField quiet label={t`Entry`}>
            <FormInput value={entry} onChangeText={setEntry} placeholder="0.00" numeric />
          </FormField>
        </View>
        <View className="flex-1">
          <FormField quiet label={t`Stop`}>
            <FormInput value={stop} onChangeText={setStop} placeholder="0.00" numeric />
          </FormField>
        </View>
        <View className="flex-1">
          <FormField quiet label={t`Target`}>
            <FormInput value={target} onChangeText={setTarget} placeholder="0.00" numeric />
          </FormField>
        </View>
      </View>
      <FormFootnote>
        {problem ??
          (planned != null
            ? t`Planned ${planned.toFixed(2)}R`
            : t`Entry, stop and target price the miss in R.`)}
      </FormFootnote>
      <FormField quiet label={t`Why you passed`}>
        <FormPicker
          label={t`Why you passed`}
          selectedValue={reason}
          onValueChange={setReason}
          items={missedReasons()}
        />
      </FormField>
      <FormField quiet label={t`How it played out`}>
        <FormPicker
          label={t`How it played out`}
          selectedValue={outcome}
          onValueChange={setOutcome}
          items={missedOutcomes()}
        />
      </FormField>
      {setups && setups.length > 0 ? (
        <FormField quiet label={t`Setup`}>
          <FormPicker
            label={t`Setup`}
            selectedValue={setupId}
            onValueChange={setSetupId}
            items={[
              { value: '', label: t`No setup` },
              ...setups.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
        </FormField>
      ) : null}
      {accounts && accounts.length > 1 ? (
        <FormField quiet label={t`Account`}>
          <FormPicker
            label={t`Account`}
            selectedValue={accountId}
            onValueChange={setAccountId}
            items={[
              { value: '', label: t`No account` },
              ...accounts.map((a) => ({ value: a.id, label: a.name })),
            ]}
          />
        </FormField>
      ) : null}
      <FormField quiet label={t`Notes`}>
        <FormInput multiline value={notes} onChangeText={setNotes} placeholder={t`Optional note`} />
      </FormField>
    </FormSheet>
  );
}
