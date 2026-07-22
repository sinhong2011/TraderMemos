import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { SettingsView } from "../app/screens/SettingsView";
import { settingsApi } from "../lib/api/settings";
import {
  useAccounts,
  useClearAccountTrades,
  useCreateAccount,
  useDeleteAccount,
  useUpdateAccount,
} from "../lib/hooks/useAccounts";
import { useCash, useCreateCash, useDeleteCash, useUpdateCash } from "../lib/hooks/useCash";
import { useRiskRules, useSaveRiskRules } from "../lib/hooks/useRiskRules";
import { useCreateTag, useDeleteTag, useTags } from "../lib/hooks/useTags";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();

  // Accounts
  const accountsQ = useAccounts();
  const createAccountM = useCreateAccount();
  const updateAccountM = useUpdateAccount();
  const deleteAccountM = useDeleteAccount();
  const clearAccountTradesM = useClearAccountTrades();

  // Cash - list all cash for selected accounts (no filter = empty filters)
  const cashQ = useCash({});
  const createCashM = useCreateCash();
  const updateCashM = useUpdateCash();
  const deleteCashM = useDeleteCash();

  // Tags
  const tagsQ = useTags();
  const createTagM = useCreateTag();
  const deleteTagM = useDeleteTag();

  // Risk rules
  const riskRulesQ = useRiskRules();
  const saveRiskRulesM = useSaveRiskRules();

  // Checklist template
  const checklistQ = useQuery({
    queryKey: ["settings", "checklist-template"],
    queryFn: () => settingsApi.getChecklistTemplate(),
  });
  const saveChecklistM = useMutation({
    mutationFn: (items: string[]) => settingsApi.putChecklistTemplate({ items }),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["settings", "checklist-template"],
      });
    },
  });

  return (
    <SettingsView
      accounts={accountsQ.data ?? []}
      accountsLoading={accountsQ.isLoading}
      accountsError={accountsQ.isError}
      onCreateAccount={async (body) => {
        await createAccountM.mutateAsync(body);
      }}
      onDeleteAccount={async (id) => {
        await deleteAccountM.mutateAsync(id);
      }}
      onUpdateAccount={async (id, body) => {
        await updateAccountM.mutateAsync({ id, body });
      }}
      onClearAccountTrades={async (id) => {
        await clearAccountTradesM.mutateAsync(id);
      }}
      cashTransactions={cashQ.data ?? []}
      cashLoading={cashQ.isLoading}
      cashError={cashQ.isError}
      onCreateCash={async (body) => {
        await createCashM.mutateAsync(body);
      }}
      onUpdateCash={async (id, body) => {
        await updateCashM.mutateAsync({ id, body });
      }}
      onDeleteCash={async (id) => {
        await deleteCashM.mutateAsync(id);
      }}
      tags={tagsQ.data ?? []}
      tagsLoading={tagsQ.isLoading}
      tagsError={tagsQ.isError}
      onCreateTag={async (body) => {
        await createTagM.mutateAsync(body);
      }}
      onDeleteTag={async (id) => {
        await deleteTagM.mutateAsync(id);
      }}
      riskRules={riskRulesQ.data}
      riskRulesLoading={riskRulesQ.isLoading}
      riskRulesError={riskRulesQ.isError}
      riskRulesSaving={saveRiskRulesM.isPending}
      onSaveRiskRules={async (body) => {
        await saveRiskRulesM.mutateAsync(body);
      }}
      checklistItems={checklistQ.data?.items ?? []}
      checklistLoading={checklistQ.isLoading}
      checklistError={checklistQ.isError}
      checklistSaving={saveChecklistM.isPending}
      onSaveChecklist={async (items) => {
        await saveChecklistM.mutateAsync(items);
      }}
    />
  );
}
