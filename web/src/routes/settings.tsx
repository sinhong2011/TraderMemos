import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { SettingsView } from "@/app/screens/SettingsView";
import { settingsApi } from "@/lib/api/settings";
import { useAccounts, useCreateAccount } from "@/lib/hooks/useAccounts";
import { useCash, useCreateCash, useDeleteCash, useUpdateCash } from "@/lib/hooks/useCash";
import { useRiskRules, useSaveRiskRules } from "@/lib/hooks/useRiskRules";
import { useAnnualGoal, useClearAnnualGoal, useSaveAnnualGoal } from "@/lib/hooks/useAnnualGoal";
import { useCreateTag, useDeleteTag, useTags, useUpdateTag } from "@/lib/hooks/useTags";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const goalYear = new Date().getFullYear();

  // Accounts
  const accountsQ = useAccounts();
  const createAccountM = useCreateAccount();

  // Cash - list all cash for selected accounts (no filter = empty filters)
  const cashQ = useCash({});
  const createCashM = useCreateCash();
  const updateCashM = useUpdateCash();
  const deleteCashM = useDeleteCash();

  // Tags
  const tagsQ = useTags();
  const createTagM = useCreateTag();
  const updateTagM = useUpdateTag();
  const deleteTagM = useDeleteTag();

  // Risk rules
  const riskRulesQ = useRiskRules();
  const saveRiskRulesM = useSaveRiskRules();

  // Annual P&L goal
  const annualGoalQ = useAnnualGoal(goalYear);
  const saveAnnualGoalM = useSaveAnnualGoal();
  const clearAnnualGoalM = useClearAnnualGoal();

  // Checklist template
  const checklistQ = useQuery({
    queryKey: ["settings", "checklist-template"],
    queryFn: () => settingsApi.getChecklistTemplate(),
  });
  const saveChecklistM = useMutation({
    mutationFn: (body: { items?: string[]; content: string }) =>
      settingsApi.putChecklistTemplate(body),
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
      onUpdateTag={async (id, body) => {
        await updateTagM.mutateAsync({ id, body });
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
      annualGoal={annualGoalQ.data}
      annualGoalLoading={annualGoalQ.isLoading}
      annualGoalError={annualGoalQ.isError}
      annualGoalSaving={saveAnnualGoalM.isPending || clearAnnualGoalM.isPending}
      onSaveAnnualGoal={async (body) => {
        await saveAnnualGoalM.mutateAsync(body);
      }}
      onClearAnnualGoal={async (year) => {
        await clearAnnualGoalM.mutateAsync(year);
      }}
      checklistItems={checklistQ.data?.items ?? []}
      checklistContent={checklistQ.data?.content ?? ""}
      checklistLoading={checklistQ.isLoading}
      checklistError={checklistQ.isError}
      checklistSaving={saveChecklistM.isPending}
      onSaveChecklist={async (body) => {
        await saveChecklistM.mutateAsync(body);
      }}
    />
  );
}
