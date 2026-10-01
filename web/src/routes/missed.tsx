import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  MissedListCard,
  MissedSummaryCard,
  MissedTradeDrawer,
  MissedTradesView,
} from "@/app/screens/MissedTradesView";
import { useToastManager } from "@/components/Toast";
import type { MissedTrade } from "@/lib/api/missedTrades";
import { useFilterParams, useFilters } from "@/lib/filters";
import { useAccounts } from "@/lib/hooks/useAccounts";
import {
  useDeleteMissedTrade,
  useMissedSummary,
  useMissedTrades,
  useSaveMissedTrade,
} from "@/lib/hooks/useMissedTrades";
import { useSetups } from "@/lib/hooks/useSetups";

export const Route = createFileRoute("/missed")({
  component: MissedPage,
});

function MissedPage() {
  const toast = useToastManager();
  const params = useFilterParams();
  const filters = { account_id: params.account_id, from: params.from, to: params.to };
  const accountIds = useFilters((s) => s.accountIds);
  const listQ = useMissedTrades(filters);
  const summaryQ = useMissedSummary(filters);
  const setupsQ = useSetups();
  const accountsQ = useAccounts();
  const save = useSaveMissedTrade();
  const del = useDeleteMissedTrade();
  const [drawer, setDrawer] = useState<{ open: boolean; editing: MissedTrade | null }>({
    open: false,
    editing: null,
  });

  const setups = setupsQ.data ?? [];
  const setupName = (id: string) => setups.find((s) => s.id === id)?.name ?? "Deleted setup";
  // A miss logged while one account is in scope belongs to it by default.
  const defaultAccount = accountIds?.length === 1 ? accountIds[0] : "";
  const failed = (title: string) => (err: unknown) =>
    toast.add({ title, description: err instanceof Error ? err.message : "Request failed" });

  const bodyOf = (t: MissedTrade) => ({
    symbol: t.symbol,
    direction: t.direction,
    observed_at: t.observed_at,
    entry: t.entry,
    stop: t.stop,
    target: t.target,
    setup_id: t.setup_id,
    account_id: t.account_id,
    reason: t.reason,
    outcome: t.outcome,
    notes: t.notes,
  });

  return (
    <MissedTradesView>
      <MissedSummaryCard
        summary={summaryQ.data}
        loading={summaryQ.isLoading}
        error={summaryQ.isError}
        setupName={setupName}
      />
      <MissedListCard
        trades={listQ.data ?? []}
        loading={listQ.isLoading}
        error={listQ.isError}
        setupName={setupName}
        onAdd={() => setDrawer({ open: true, editing: null })}
        onEdit={(t) => setDrawer({ open: true, editing: t })}
        onDelete={(t) =>
          del.mutate(t.id, {
            onSuccess: () => toast.add({ title: "Missed trade deleted", description: t.symbol }),
            onError: failed("Could not delete"),
          })
        }
        onOutcome={(t, outcome) =>
          save.mutate(
            { id: t.id, body: { ...bodyOf(t), outcome } },
            { onError: failed("Could not save the outcome") },
          )
        }
      />
      <MissedTradeDrawer
        open={drawer.open}
        editing={drawer.editing}
        setups={setups}
        accounts={accountsQ.data ?? []}
        defaultAccount={defaultAccount}
        onClose={() => setDrawer((d) => ({ ...d, open: false }))}
        onSave={async (id, body) => {
          await save.mutateAsync({ id, body });
          toast.add({
            title: id ? "Missed trade saved" : "Missed trade logged",
            description: body.symbol,
          });
        }}
      />
    </MissedTradesView>
  );
}
