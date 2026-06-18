import { createFileRoute } from "@tanstack/react-router";
import { PlaybookView } from "../app/screens/PlaybookView";
import { useSetups, useCreateSetup, useUpdateSetup, useDeleteSetup } from "../lib/hooks/useSetups";
import { useBreakdown } from "../lib/hooks/useAnalytics";
import { useAccounts } from "../lib/hooks/useAccounts";
import { useFilterParams, useFilters } from "../lib/filters";

export const Route = createFileRoute("/playbook")({
  component: PlaybookPage,
});

function PlaybookPage() {
  const filters = useFilterParams();
  const accountId = useFilters((s) => s.accountId);

  const setupsQ = useSetups();
  const breakdownQ = useBreakdown("setup", filters);
  const accountsQ = useAccounts();
  const currency =
    (accountsQ.data ?? []).find((a) => a.id === accountId)?.base_currency ?? "USD";

  const createM = useCreateSetup();
  const updateM = useUpdateSetup();
  const deleteM = useDeleteSetup();

  return (
    <PlaybookView
      setups={setupsQ.data ?? []}
      setupsLoading={setupsQ.isLoading}
      setupsError={setupsQ.isError}
      breakdown={breakdownQ.data ?? []}
      breakdownLoading={breakdownQ.isLoading}
      currency={currency}
      onCreate={async (name, description) => {
        await createM.mutateAsync({ name, description });
      }}
      onUpdate={async (id, name, description) => {
        await updateM.mutateAsync({ id, body: { name, description } });
      }}
      onDelete={async (id) => {
        await deleteM.mutateAsync(id);
      }}
    />
  );
}
