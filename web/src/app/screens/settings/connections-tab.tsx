import { useState } from "react";
import { RefreshCw, Undo2 } from "lucide-react";
import { Badge } from "@/components/reui/badge";
import { BrokerMark } from "@/components/BrokerMark";
import { FlexSyncButton } from "@/components/FlexSyncModal";
import { Modal } from "@/components/Modal";
import { useToastManager } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import type { Account, ImportBatch } from "@/lib/api/types";
import { type FlexSyncConnection, flexSyncFailed } from "@/lib/api/flexSync";
import { useFlexSyncConnections, useRunFlexSync } from "@/lib/hooks/useFlexSync";
import { useDeleteImport, useImports } from "@/lib/hooks/useImports";
import { findBroker } from "@/lib/brokers";
import { EmptyState } from "@/components/EmptyState";
import { SettingsGroup, SettingsSection } from "./settings-ui";

/** Human name for an import batch's source key. */
function sourceLabel(source: string): string {
  if (source === "ibkr-flex-sync") return "IBKR Flex sync";
  if (source === "csv" || source === "file") return "File import";
  return source;
}

function ConnectionStatus({ conn }: { conn: FlexSyncConnection }) {
  if (flexSyncFailed(conn)) return <Badge variant="destructive-light">Sync failing</Badge>;
  if (!conn.enabled) return <Badge variant="secondary">Manual only</Badge>;
  return <Badge variant="success-light">Healthy</Badge>;
}

function ConnectionRow({ conn }: { conn: FlexSyncConnection }) {
  const toast = useToastManager();
  const run = useRunFlexSync(conn.account_id);
  const ibkr = findBroker("ibkr");

  function handleRun() {
    run.mutate(undefined, {
      onSuccess: (res) =>
        toast.add({
          title: "Sync complete",
          description: `${res.inserted} new execution${res.inserted === 1 ? "" : "s"}, ${res.skipped} duplicate${res.skipped === 1 ? "" : "s"}`,
        }),
      onError: (err) =>
        toast.add({
          title: "Sync failed",
          description: err instanceof Error ? err.message : "Sync failed",
        }),
    });
  }

  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        {ibkr ? <BrokerMark broker={ibkr} size="sm" /> : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13px] font-medium">{conn.account_name}</span>
            <ConnectionStatus conn={conn} />
          </div>
          <p className="m-0 text-[12px] text-muted-foreground">
            {conn.last_synced_at
              ? `Last sync ${new Date(conn.last_synced_at).toLocaleString()} — ${conn.last_status || "done"}`
              : "Never synced yet."}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRun}
            disabled={run.isPending}
          >
            <RefreshCw
              size={13}
              strokeWidth={1.5}
              className={run.isPending ? "animate-spin" : ""}
            />
            {run.isPending ? "Syncing…" : "Sync now"}
          </Button>
          <FlexSyncButton
            accountId={conn.account_id}
            accountName={conn.account_name}
            label="Configure"
          />
        </div>
      </div>
      {conn.last_error ? (
        <p className="m-0 text-[12px] text-destructive">{conn.last_error}</p>
      ) : null}
    </div>
  );
}

function RollbackButton({ batch, accountName }: { batch: ImportBatch; accountName: string }) {
  const [open, setOpen] = useState(false);
  const toast = useToastManager();
  const rollback = useDeleteImport();

  function handleRollback() {
    rollback.mutate(batch.id, {
      onSuccess: () => {
        setOpen(false);
        toast.add({ title: "Import rolled back", description: `${batch.row_count} rows removed` });
      },
      onError: (err) =>
        toast.add({
          title: "Could not roll back",
          description: err instanceof Error ? err.message : "Rollback failed",
        }),
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-destructive"
        onClick={() => setOpen(true)}
      >
        <Undo2 size={13} strokeWidth={1.5} />
        Roll back
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Roll back this import?"
        className="max-w-[min(420px,94vw)]"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleRollback}
              disabled={rollback.isPending}
            >
              {rollback.isPending ? "Rolling back…" : "Roll back"}
            </Button>
          </>
        }
      >
        <p className="m-0 text-[13px] leading-relaxed text-muted-foreground">
          The {batch.row_count} execution{batch.row_count === 1 ? "" : "s"} imported into{" "}
          {accountName} by this batch will be deleted and trades regrouped. A later sync can import
          them again.
        </p>
      </Modal>
    </>
  );
}

export function ConnectionsTab({ accounts }: { accounts: Account[] }) {
  const connections = useFlexSyncConnections();
  const imports = useImports();

  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? "Deleted account";
  const history = [...(imports.data ?? [])].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );

  return (
    <>
      <SettingsSection
        id="connections"
        title="Connected brokers"
        description="Broker links that pull fills into an account automatically."
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            render={<a href="/connect" className="no-underline" />}
          >
            Connect a broker
          </Button>
        }
      >
        {connections.isError ? (
          <EmptyState title="Could not load connections" hint="Check the server and try again." />
        ) : (connections.data?.length ?? 0) === 0 ? (
          <EmptyState
            title="No broker connected"
            hint="Connect Interactive Brokers to sync fills on a schedule, or import statements by file."
          />
        ) : (
          <SettingsGroup>
            {connections.data?.map((conn) => (
              <ConnectionRow key={conn.account_id} conn={conn} />
            ))}
          </SettingsGroup>
        )}
      </SettingsSection>

      <SettingsSection
        id="import-history"
        title="Sync & import history"
        description="Every batch of imported executions — scheduled syncs, manual syncs, and file imports. Rolling one back deletes its executions."
      >
        {imports.isError ? (
          <EmptyState title="Could not load history" hint="Check the server and try again." />
        ) : history.length === 0 ? (
          <EmptyState
            title="Nothing imported yet"
            hint="Batches appear here after a sync or file import."
          />
        ) : (
          <SettingsGroup>
            {history.map((batch) => (
              <div key={batch.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-medium">
                      {sourceLabel(batch.source)}
                    </span>
                    {batch.status === "reversed" ? (
                      <Badge variant="secondary">Rolled back</Badge>
                    ) : null}
                  </div>
                  <p className="m-0 text-[12px] text-muted-foreground">
                    {accountName(batch.account_id)}
                    {batch.filename ? ` · ${batch.filename}` : ""} · {batch.row_count} row
                    {batch.row_count === 1 ? "" : "s"} ·{" "}
                    {new Date(batch.created_at).toLocaleString()}
                  </p>
                </div>
                {batch.status !== "reversed" ? (
                  <RollbackButton batch={batch} accountName={accountName(batch.account_id)} />
                ) : null}
              </div>
            ))}
          </SettingsGroup>
        )}
      </SettingsSection>
    </>
  );
}
