import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { DayReviewView } from "@/app/screens/DayReviewView";
import { TradeDetailSheet } from "@/components/TradeDetailSheet";
import { accountBaseCurrency } from "@/lib/displayPrefs";
import { normalizeFilterDate, useFilterParams, useFilters } from "@/lib/filters";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { useBehavior, useCompliance, useSummary } from "@/lib/hooks/useAnalytics";
import { useMoneyFx } from "@/lib/hooks/useMoneyFx";
import { useNotes } from "@/lib/hooks/useNotes";
import { useTrades } from "@/lib/hooks/useTrades";
import { useUI } from "@/lib/ui";

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

function DayReviewPage() {
  const { date } = Route.useParams();
  const navigate = useNavigate();
  const filters = useFilterParams();
  const accountIds = useFilters((s) => s.accountIds);
  const openModal = useUI((s) => s.openModal);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);

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
  const notesQ = useNotes({ from: dayFilters.from, to: dayFilters.to });
  const accountsQ = useAccounts();
  const baseCurrency = accountBaseCurrency(accountsQ.data ?? [], accountIds);
  const { currency, rate } = useMoneyFx(baseCurrency);

  const goToDay = (d: string) => void navigate({ to: "/day/$date", params: { date: d } });

  return (
    <>
      <DayReviewView
        date={date}
        trades={tradesQ.data ?? []}
        tradesLoading={tradesQ.isLoading}
        tradesError={tradesQ.isError}
        summary={summaryQ.data}
        summaryLoading={summaryQ.isLoading}
        compliance={complianceQ.data}
        behavior={behaviorQ.data}
        notes={notesQ.data ?? []}
        notesLoading={notesQ.isLoading}
        currency={currency}
        fxRate={rate ?? 1}
        onSelectTrade={(t) => setSelectedTradeId(t.id)}
        onPrevDay={() => goToDay(shiftDay(date, -1))}
        onNextDay={() => goToDay(shiftDay(date, 1))}
        onOpenCalendar={() => void navigate({ to: "/calendar" })}
        onOpenNotes={() => void navigate({ to: "/notes" })}
        onNewNote={() => openModal("new-note")}
      />
      <TradeDetailSheet tradeId={selectedTradeId} onClose={() => setSelectedTradeId(null)} />
    </>
  );
}
