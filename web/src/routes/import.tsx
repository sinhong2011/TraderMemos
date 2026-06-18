import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ImportView } from "../app/screens/ImportView";
import { useAccounts } from "../lib/hooks/useAccounts";
import { useImportPreview, useImportCommit } from "../lib/hooks/useImports";

export const Route = createFileRoute("/import")({
  component: ImportPage,
});

function ImportPage() {
  const navigate = useNavigate();

  const accountsQ = useAccounts();
  const previewM = useImportPreview();
  const commitM = useImportCommit();

  return (
    <ImportView
      accounts={accountsQ.data ?? []}
      accountsLoading={accountsQ.isLoading}
      onPreview={async (formData) => {
        return await previewM.mutateAsync(formData);
      }}
      onCommit={async (batchId, formData) => {
        return await commitM.mutateAsync({ id: batchId, formData });
      }}
      onDone={() => { void navigate({ to: "/dashboard" }); }}
    />
  );
}
