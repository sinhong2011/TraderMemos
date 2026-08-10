import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { YearWrappedView } from "@/app/screens/YearWrappedView";
import { ytdFiltersForYear } from "@/lib/annualGoal";
import { accountBaseCurrency } from "@/lib/displayPrefs";
import { useFilters } from "@/lib/filters";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { useMoneyFx } from "@/lib/hooks/useMoneyFx";
import { useTrades } from "@/lib/hooks/useTrades";
import { computeYearWrapped } from "@/lib/wrapped";

const MIN_YEAR = 2000;

export function validateWrappedSearch(search: Record<string, unknown>): { year: number } {
  const now = new Date().getFullYear();
  const raw = Number(search.year);
  return { year: Number.isInteger(raw) && raw >= MIN_YEAR && raw <= now ? raw : now };
}

export const Route = createFileRoute("/wrapped")({
  validateSearch: validateWrappedSearch,
  component: WrappedPage,
});

function WrappedPage() {
  const { year } = Route.useSearch();
  const navigate = Route.useNavigate();
  const accountIds = useFilters((s) => s.accountIds);

  // Whole calendar year (YTD for the current one); honors the account filter
  // so the recap matches the rest of the app's scope.
  const filters = useMemo(
    () => ytdFiltersForYear(accountIds?.length ? { account_id: accountIds.join(",") } : {}, year),
    [accountIds, year],
  );
  const tradesQ = useTrades(filters);
  const accountsQ = useAccounts();
  const baseCurrency = accountBaseCurrency(accountsQ.data ?? [], accountIds);
  const { currency, rate } = useMoneyFx(baseCurrency);

  const wrapped = useMemo(() => computeYearWrapped(tradesQ.data ?? [], year), [tradesQ.data, year]);

  return (
    <YearWrappedView
      wrapped={wrapped}
      loading={tradesQ.isLoading}
      error={tradesQ.isError}
      year={year}
      currentYear={new Date().getFullYear()}
      onYearChange={(next) =>
        void navigate({ to: "/wrapped", search: (prev) => ({ ...prev, year: next }) })
      }
      currency={currency}
      fxRate={rate ?? 1}
    />
  );
}
