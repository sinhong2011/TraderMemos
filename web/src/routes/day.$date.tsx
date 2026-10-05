import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { DayReviewView } from "@/app/screens/DayReviewView";
import { MissedListCard, MissedTradeDrawer } from "@/app/screens/MissedTradesView";
import { RoutineDayCard } from "@/app/screens/RoutinesView";
import { DailyLossCard } from "@/components/DailyLossCard";
import { OpenPositionsCard } from "@/components/OpenPositionsCard";
import { useToastManager } from "@/components/Toast";
import { TradeDetailSheet } from "@/components/TradeDetailSheet";
import type { MissedTrade } from "@/lib/api/missedTrades";
import { accountBaseCurrency, wallClockToIso } from "@/lib/displayPrefs";
import { normalizeFilterDate, useFilterParams, useFilters } from "@/lib/filters";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { useBehavior, useMistakeTax, useCompliance, useSummary } from "@/lib/hooks/useAnalytics";
import {
  useDeleteMissedTrade,
  useMissedTrades,
  useSaveMissedTrade,
} from "@/lib/hooks/useMissedTrades";
import { useMoneyFx } from "@/lib/hooks/useMoneyFx";
import { useNotes } from "@/lib/hooks/useNotes";
import { useCheckRoutine, useRoutineDay, useRoutineItems } from "@/lib/hooks/useRoutines";
import { useSetups } from "@/lib/hooks/useSetups";
import { useTrades } from "@/lib/hooks/useTrades";
import { useReviewInbox } from "@/lib/hooks/useReviewInbox";
import { useMarketToday } from "@/lib/today";
import { useUI } from "@/lib/ui";
import { WeeklyFocusCard } from "@/components/WeeklyFocusCard";
import { notesApi } from "@/lib/api/notes";
import { useWeeklyFocus } from "@/lib/hooks/useWeeklyFocus";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const Route = createFileRoute("/day/$date")({
  beforeLoad: ({ params }) => {
    if (!DATE_RE.test(params.date) || Number.isNaN(Date.parse(`${params.date}T00:00:00Z`))) {
      throw redirect({ to: "/calendar" });
    }
  },
  component: DayReviewPage,
});

function shiftDay(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const sectionLink = "text-xs font-medium text-muted-foreground no-underline hover:text-foreground";

/**
 * The trading day in one place: the routine that opens it, the live desk while
 * it runs, what happened, what was passed on, and the log that closes it.
 * `/today` resolves here.
 */
function DayReviewPage() {
  const { date } = Route.useParams();
  const navigate = useNavigate();
  const toast = useToastManager();
  const filters = useFilterParams();
  const accountIds = useFilters((s) => s.accountIds);
  const openModal = useUI((s) => s.openModal);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [missedDrawer, setMissedDrawer] = useState<{
    open: boolean;
    editing: MissedTrade | null;
  }>({ open: false, editing: null });

  const today = useMarketToday();
  const isToday = date === today;

  const dayFilters = useMemo(
    () => ({
      ...filters,
      from: normalizeFilterDate(date, "start", filters.tz),
      to: normalizeFilterDate(date, "end", filters.tz),
    }),
    [filters, date],
  );

  const tradesQ = useTrades(dayFilters);
  const summaryQ = useSummary(dayFilters);
  const complianceQ = useCompliance(dayFilters);
  const behaviorQ = useBehavior(dayFilters);
  const mistakeTaxQ = useMistakeTax(dayFilters);
  const reviewQ = useReviewInbox(filters.account_id);
  const notesQ = useNotes({ from: dayFilters.from, to: dayFilters.to });
  const accountsQ = useAccounts();
  const baseCurrency = accountBaseCurrency(accountsQ.data ?? [], accountIds);
  const { currency, rate } = useMoneyFx(baseCurrency);
  const fxRate = rate ?? 1;

  // Open positions are whatever is on the book now, whenever it was opened:
  // the global filters apply, the date range does not.
  const openQ = useTrades({ ...filters, from: undefined, to: undefined, status: "open" });

  // Routine ticks are keyed by the market trading day, like everything else on
  // this page, so a post-session tick after local midnight still lands here.
  const focusQ = useWeeklyFocus();
  const openNoteEdit = useUI((s) => s.openNoteEdit);
  const routineItemsQ = useRoutineItems(date);
  const routineDayQ = useRoutineDay(date);
  const checkRoutine = useCheckRoutine();

  const missedFilters = {
    account_id: filters.account_id,
    from: dayFilters.from,
    to: dayFilters.to,
  };
  const missedQ = useMissedTrades(missedFilters);
  const setupsQ = useSetups();
  const saveMissed = useSaveMissedTrade();
  const deleteMissed = useDeleteMissedTrade();
  const setups = setupsQ.data ?? [];
  const setupName = (id: string) => setups.find((s) => s.id === id)?.name ?? "Deleted setup";

  const failed = (title: string) => (err: unknown) =>
    toast.add({ title, description: err instanceof Error ? err.message : "Request failed" });

  const goToDay = (d: string) => void navigate({ to: "/day/$date", params: { date: d } });

  const routineItems = routineItemsQ.data?.items ?? [];
  const routine = (
    <RoutineDayCard
      title="Routine"
      day={date}
      today={today}
      data={routineDayQ.data}
      loading={routineDayQ.isLoading || routineItemsQ.isLoading}
      error={routineDayQ.isError}
      hasItems={routineItems.length > 0 || (routineDayQ.data?.total ?? 0) > 0}
      onCheck={(id, done) =>
        checkRoutine.mutate({ day: date, id, done }, { onError: failed("Could not save the tick") })
      }
      trailing={
        <Link to="/routines" className={sectionLink}>
          Edit
        </Link>
      }
    />
  );

  const todayNet = summaryQ.data?.net_pnl ?? 0;
  const desk = isToday ? (
    <>
      <DailyLossCard todayNetPnl={todayNet} currency={currency} fxRate={fxRate} />
      <OpenPositionsCard
        trades={openQ.data ?? []}
        loading={openQ.isLoading}
        error={openQ.isError}
        currency={currency}
        fxRate={fxRate}
        onSelect={(t) => setSelectedTradeId(t.id)}
      />
    </>
  ) : null;

  const bodyOf = (t: MissedTrade) => ({
    symbol: t.symbol,
    direction: t.direction,
    observed_at: t.observed_at,
    entry: t.entry,
    stop: t.stop,
    target: t.target,
    setup_id: t.setup_id,
    account_id: t.account_id,
    reason: t.reason,
    outcome: t.outcome,
    notes: t.notes,
  });

  const missed = (
    <MissedListCard
      trades={missedQ.data ?? []}
      loading={missedQ.isLoading}
      error={missedQ.isError}
      setupName={setupName}
      emptyTitle="No missed trades logged on this day"
      trailing={
        <Link to="/missed" className={sectionLink}>
          All
        </Link>
      }
      onAdd={() => setMissedDrawer({ open: true, editing: null })}
      onEdit={(t) => setMissedDrawer({ open: true, editing: t })}
      onDelete={(t) =>
        deleteMissed.mutate(t.id, {
          onSuccess: () => toast.add({ title: "Missed trade deleted", description: t.symbol }),
          onError: failed("Could not delete"),
        })
      }
      onOutcome={(t, outcome) =>
        saveMissed.mutate(
          { id: t.id, body: { ...bodyOf(t), outcome } },
          { onError: failed("Could not save the outcome") },
        )
      }
    />
  );

  return (
    <>
      <DayReviewView
        date={date}
        isToday={isToday}
        onToday={() => goToDay(today)}
        focus={
          date === today && focusQ.data ? (
            <WeeklyFocusCard
              items={focusQ.data.items}
              onOpenReview={
                focusQ.data.note_id
                  ? async () => {
                      const note = await notesApi.get(focusQ.data!.note_id);
                      openNoteEdit({
                        id: note.id,
                        type: note.type ?? "weekly_review",
                        occurredAt: note.occurred_at,
                        title: note.title,
                        body: note.body,
                        symbols: note.symbols ?? [],
                      });
                    }
                  : undefined
              }
            />
          ) : null
        }
        routine={routine}
        desk={desk}
        missed={missed}
        trades={tradesQ.data ?? []}
        tradesLoading={tradesQ.isLoading}
        tradesError={tradesQ.isError}
        summary={summaryQ.data}
        summaryLoading={summaryQ.isLoading}
        compliance={complianceQ.data}
        behavior={behaviorQ.data}
        mistakeTax={mistakeTaxQ.data}
        reviewCount={reviewQ.data?.items.length}
        notes={notesQ.data ?? []}
        notesLoading={notesQ.isLoading}
        currency={currency}
        fxRate={fxRate}
        onSelectTrade={(t) => setSelectedTradeId(t.id)}
        onPrevDay={() => goToDay(shiftDay(date, -1))}
        onNextDay={() => goToDay(shiftDay(date, 1))}
        onOpenCalendar={() => void navigate({ to: "/calendar" })}
        onOpenNotes={() => void navigate({ to: "/notes" })}
        onNewNote={() => openModal("new-note")}
      />
      <MissedTradeDrawer
        open={missedDrawer.open}
        editing={missedDrawer.editing}
        setups={setups}
        accounts={accountsQ.data ?? []}
        defaultAccount={accountIds?.length === 1 ? accountIds[0] : ""}
        // A miss logged from a past day belongs to that day, not to now.
        defaultObservedAt={isToday ? undefined : wallClockToIso(`${date}T12:00:00`, filters.tz)}
        onClose={() => setMissedDrawer((d) => ({ ...d, open: false }))}
        onSave={async (id, body) => {
          await saveMissed.mutateAsync({ id, body });
          toast.add({
            title: id ? "Missed trade saved" : "Missed trade logged",
            description: body.symbol,
          });
        }}
      />
      <TradeDetailSheet tradeId={selectedTradeId} onClose={() => setSelectedTradeId(null)} />
    </>
  );
}
