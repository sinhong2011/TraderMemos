import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ImportView } from "@/app/screens/ImportView";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { useImportCommit, useImportPreview } from "@/lib/hooks/useImports";
import { useFilters } from "@/lib/filters";
import { useUI } from "@/lib/ui";

export const Route = createFileRoute("/import")({
  component: ImportPage,
});

function ImportPage() {
  const navigate = useNavigate();
  const openModal = useUI((s) => s.openModal);

  const accountId = useFilters((s) => s.accountId);

  const accountsQ = useAccounts();
  const previewM = useImportPreview();
  const commitM = useImportCommit();

  return (
    <ImportView
      accounts={accountsQ.data ?? []}
      accountsLoading={accountsQ.isLoading}
      defaultAccountId={accountId}
      onPreview={async (formData) => {
        return await previewM.mutateAsync(formData);
      }}
      onCommit={async (batchId, formData) => {
        return await commitM.mutateAsync({ id: batchId, formData });
      }}
      onDone={() => {
        void navigate({ to: "/home" });
      }}
      onLogTrade={() => openModal("new-trade")}
    />
  );
}
