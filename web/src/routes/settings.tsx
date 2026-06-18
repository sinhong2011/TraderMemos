import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SettingsView } from "../app/screens/SettingsView";
import { useAccounts, useCreateAccount, useDeleteAccount } from "../lib/hooks/useAccounts";
import { useCash, useCreateCash, useDeleteCash } from "../lib/hooks/useCash";
import { useTags, useCreateTag, useDeleteTag } from "../lib/hooks/useTags";
import { useSetups, useCreateSetup, useDeleteSetup } from "../lib/hooks/useSetups";
import { loadLocale, i18n } from "../i18n";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const [currentLocale, setCurrentLocale] = useState(() => i18n.locale || "en");

  // Accounts
  const accountsQ = useAccounts();
  const createAccountM = useCreateAccount();
  const deleteAccountM = useDeleteAccount();

  // Cash - list all cash for selected accounts (no filter = empty filters)
  const cashQ = useCash({});
  const createCashM = useCreateCash();
  const deleteCashM = useDeleteCash();

  // Tags
  const tagsQ = useTags();
  const createTagM = useCreateTag();
  const deleteTagM = useDeleteTag();

  // Setups
  const setupsQ = useSetups();
  const createSetupM = useCreateSetup();
  const deleteSetupM = useDeleteSetup();

  function handleLocaleChange(locale: string) {
    loadLocale(locale);
    setCurrentLocale(locale);
  }

  return (
    <SettingsView
      accounts={accountsQ.data ?? []}
      accountsLoading={accountsQ.isLoading}
      accountsError={accountsQ.isError}
      onCreateAccount={async (body) => { await createAccountM.mutateAsync(body); }}
      onDeleteAccount={async (id) => { await deleteAccountM.mutateAsync(id); }}

      cashTransactions={cashQ.data ?? []}
      cashLoading={cashQ.isLoading}
      cashError={cashQ.isError}
      onCreateCash={async (body) => { await createCashM.mutateAsync(body); }}
      onDeleteCash={async (id) => { await deleteCashM.mutateAsync(id); }}

      tags={tagsQ.data ?? []}
      tagsLoading={tagsQ.isLoading}
      tagsError={tagsQ.isError}
      onCreateTag={async (body) => { await createTagM.mutateAsync(body); }}
      onDeleteTag={async (id) => { await deleteTagM.mutateAsync(id); }}

      setups={setupsQ.data ?? []}
      setupsLoading={setupsQ.isLoading}
      setupsError={setupsQ.isError}
      onCreateSetup={async (name, description) => { await createSetupM.mutateAsync({ name, description }); }}
      onDeleteSetup={async (id) => { await deleteSetupM.mutateAsync(id); }}

      currentLocale={currentLocale}
      onLocaleChange={handleLocaleChange}
    />
  );
}
