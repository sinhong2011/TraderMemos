import { createFileRoute } from "@tanstack/react-router";
import { PlaybookView } from "../app/screens/PlaybookView";
import { useToastManager } from "../components/Toast";
import { useFilterParams, useFilters } from "../lib/filters";
import { useAccounts } from "../lib/hooks/useAccounts";
import { useBreakdown } from "../lib/hooks/useAnalytics";
import { useCreateSetup, useDeleteSetup, useSetups, useUpdateSetup } from "../lib/hooks/useSetups";

export const Route = createFileRoute("/playbook")({
  component: PlaybookPage,
});

function PlaybookPage() {
  const toast = useToastManager();
  const filters = useFilterParams();
  const accountId = useFilters((s) => s.accountId);

  const setupsQ = useSetups();
  const breakdownQ = useBreakdown("setup", filters);
  const accountsQ = useAccounts();
  const currency = (accountsQ.data ?? []).find((a) => a.id === accountId)?.base_currency ?? "USD";

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
      onCreate={async (body) => {
        try {
          await createM.mutateAsync(body);
          toast.add({
            title: "Setup created",
            description: body.name,
          });
        } catch (err) {
          toast.add({
            title: "Could not create setup",
            description: err instanceof Error ? err.message : "Request failed",
          });
          throw err;
        }
      }}
      onUpdate={async (id, body) => {
        try {
          await updateM.mutateAsync({ id, body });
          toast.add({
            title: "Setup updated",
            description: body.name,
          });
        } catch (err) {
          toast.add({
            title: "Could not update setup",
            description: err instanceof Error ? err.message : "Request failed",
          });
          throw err;
        }
      }}
      onDelete={async (id) => {
        const name = setupsQ.data?.find((setup) => setup.id === id)?.name ?? "Setup";
        try {
          await deleteM.mutateAsync(id);
          toast.add({
            title: "Setup deleted",
            description: name,
          });
        } catch (err) {
          toast.add({
            title: "Could not delete setup",
            description: err instanceof Error ? err.message : "Request failed",
          });
          throw err;
        }
      }}
    />
  );
}
