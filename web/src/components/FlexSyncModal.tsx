import { useEffect, useState } from "react";
import {
  useDeleteFlexSync,
  useFlexSync,
  useRunFlexSync,
  useSaveFlexSync,
} from "@/lib/hooks/useFlexSync";
import { Field } from "./Field";
import { FormInput, PasswordInput } from "./FormInput";
import { Modal } from "./Modal";
import { useToastManager } from "./Toast";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";

export interface FlexSyncButtonProps {
  accountId: string;
  accountName: string;
}

/**
 * IBKR Flex auto-sync settings for one account: a Flex Web Service token and
 * Flex Query ID (Trades → Executions section, CSV format). Once enabled, the
 * background job pulls new fills on a schedule; "Sync now" runs one pass
 * immediately.
 */
export function FlexSyncButton({ accountId, accountName }: FlexSyncButtonProps) {
  const [open, setOpen] = useState(false);
  const toast = useToastManager();
  const settingsQ = useFlexSync(accountId, open);
  const save = useSaveFlexSync(accountId);
  const remove = useDeleteFlexSync(accountId);
  const run = useRunFlexSync(accountId);

  const [queryId, setQueryId] = useState("");
  const [token, setToken] = useState("");
  const [enabled, setEnabled] = useState(true);

  const s = settingsQ.data;
  useEffect(() => {
    if (!s) return;
    setQueryId(s.query_id ?? "");
    setEnabled(s.configured ? s.enabled : true);
    setToken("");
  }, [s]);

  function handleSave() {
    if (queryId.trim() === "") {
      toast.add({ title: "Query ID is required" });
      return;
    }
    if (!s?.token_set && token.trim() === "") {
      toast.add({ title: "Token is required", description: "Paste your Flex Web Service token." });
      return;
    }
    save.mutate(
      {
        query_id: queryId.trim(),
        enabled,
        ...(token.trim() !== "" ? { token: token.trim() } : {}),
      },
      {
        onSuccess: () => toast.add({ title: "Flex sync saved", description: accountName }),
        onError: (err) =>
          toast.add({
            title: "Could not save flex sync",
            description: err instanceof Error ? err.message : "Save failed",
          }),
      },
    );
  }

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

  function handleDisconnect() {
    remove.mutate(undefined, {
      onSuccess: () => {
        toast.add({ title: "Flex sync removed", description: accountName });
        setQueryId("");
        setToken("");
      },
    });
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        IBKR sync
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={`IBKR Flex sync — ${accountName}`}
        className="max-w-[min(460px,94vw)]"
        footer={
          <>
            {s?.configured ? (
              <Button
                type="button"
                variant="ghost"
                className="mr-auto text-destructive"
                onClick={handleDisconnect}
                disabled={remove.isPending}
              >
                Remove
              </Button>
            ) : null}
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="m-0 text-[12px] leading-relaxed text-muted-foreground">
            In IBKR Client Portal, create a Flex Query with the Trades → Executions section in CSV
            format, and enable the Flex Web Service to get a token. New fills import automatically
            and duplicates are skipped.
          </p>
          <Field label="Flex Query ID">
            <FormInput
              value={queryId}
              onChange={(e) => setQueryId(e.target.value)}
              placeholder="123456"
              aria-label="Flex Query ID"
            />
          </Field>
          <Field
            label="Flex Web Service token"
            description={
              s?.token_set
                ? `Saved (${s.token_hint ?? "hidden"}) — leave blank to keep it.`
                : undefined
            }
          >
            <PasswordInput
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={s?.token_set ? "••••••••" : "Paste token"}
              aria-label="Flex Web Service token"
            />
          </Field>
          <Field label="Scheduled sync">
            <div className="flex items-center gap-2">
              <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Scheduled sync" />
              <span className="text-[12px] text-muted-foreground">
                {enabled ? "Runs automatically in the background" : "Manual sync only"}
              </span>
            </div>
          </Field>

          {s?.configured ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3">
                <p className="m-0 text-[12px] text-muted-foreground">
                  {s.last_synced_at
                    ? `Last sync ${new Date(s.last_synced_at).toLocaleString()} — ${
                        s.last_status || "done"
                      }`
                    : "Never synced yet."}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRun}
                  disabled={run.isPending}
                >
                  {run.isPending ? "Syncing…" : "Sync now"}
                </Button>
              </div>
              {s.last_error ? (
                <p className="m-0 text-[12px] text-destructive">{s.last_error}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
