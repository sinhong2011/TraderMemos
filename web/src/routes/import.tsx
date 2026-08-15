import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ImportView } from "@/app/screens/ImportView";
import { findBroker } from "@/lib/brokers";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { useImportCommit, useImportPreview } from "@/lib/hooks/useImports";
import { soleAccountId, useFilters } from "@/lib/filters";
import { useUI } from "@/lib/ui";

/**
 * `broker` and `account` are set when the Connect flow hands off — they carry
 * the broker's export instructions and the account it just prepared, so the
 * upload step doesn't re-ask what was already answered.
 */
export function validateImportSearch(search: Record<string, unknown>): {
  broker?: string;
  account?: string;
} {
  const broker =
    typeof search.broker === "string" && findBroker(search.broker) ? search.broker : "";
  const account = typeof search.account === "string" ? search.account.trim() : "";
  return {
    ...(broker ? { broker } : {}),
    ...(account ? { account } : {}),
  };
}

export const Route = createFileRoute("/import")({
  validateSearch: validateImportSearch,
  component: ImportPage,
});

function ImportPage() {
  const navigate = useNavigate();
  const openModal = useUI((s) => s.openModal);
  const { broker, account } = Route.useSearch();

  const filterAccountId = useFilters((s) => soleAccountId(s.accountIds));

  const accountsQ = useAccounts();
  const previewM = useImportPreview();
  const commitM = useImportCommit();

  return (
    <ImportView
      accounts={accountsQ.data ?? []}
      accountsLoading={accountsQ.isLoading}
      defaultAccountId={account ?? filterAccountId}
      brokerKey={broker}
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
      onChangeBroker={() => void navigate({ to: "/connect" })}
    />
  );
}
