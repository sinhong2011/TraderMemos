import { useLingui } from "@lingui/react/macro";
import { useEffect, useState } from "react";
import { useToastManager } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import type { BackupState, BackupStatus } from "@/lib/api/backup";
import { fmtBackupInterval, fmtBackupTimestamp, fmtRelativeAge } from "@/lib/backupFormat";
import { cn } from "@/lib/cn";
import { resolveDisplayTimezone, useDisplayTimePrefs } from "@/lib/displayPrefs";
import { fmtBytes } from "@/lib/formatBytes";
import { useBackupStatus, useRunBackup } from "@/lib/hooks/useBackup";
import { useLocale } from "@/i18n";
import { AboutCard, StatTile } from "./about-ui";
import { SettingsSection } from "./settings-ui";

/** Wall clock for relative ages, refreshed each minute. */
function useNow(stepMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), stepMs);
    return () => window.clearInterval(id);
  }, [stepMs]);
  return now;
}

const STATE_TONE: Record<BackupState, "ok" | "warn" | "error" | "muted"> = {
  ok: "ok",
  none: "muted",
  failed: "error",
  stale: "warn",
  disabled: "muted",
  unsupported: "muted",
};

function StatusLine({ state, label }: { state: BackupState; label: string }) {
  const tone = STATE_TONE[state];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[12px] font-medium",
        tone === "ok" && "text-profit",
        tone === "warn" && "text-chart-3",
        tone === "error" && "text-destructive",
        tone === "muted" && "text-muted-foreground",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          tone === "ok" && "bg-profit",
          tone === "warn" && "bg-chart-3",
          tone === "error" && "bg-destructive",
          tone === "muted" && "bg-muted-foreground",
        )}
      />
      {label}
    </span>
  );
}

/**
 * Settings → About → Backups: the server's scheduled SQLite snapshots.
 * Owner-only — the parent mounts it only for admins.
 */
export function BackupsSection() {
  const { t } = useLingui();
  const { intlLocale } = useLocale();
  const { timezone, timeFormat } = useDisplayTimePrefs();
  const timeZone = resolveDisplayTimezone(timezone);
  const hour12 = timeFormat === "h12";
  const now = useNow();
  const toast = useToastManager();
  const status = useBackupStatus(true);
  const run = useRunBackup();

  const data: BackupStatus | undefined = status.data;
  const title = t`Backups`;
  const description = t`Snapshots of the database, written to a folder on the server. Sync that folder off-site — a copy on the same disk doesn't survive the disk.`;

  function backUpNow() {
    run.mutate(undefined, {
      onSuccess: (next) => {
        toast.add({
          type: "success",
          title: t`Backup written`,
          description: next.latest?.name,
        });
      },
      onError: (err) => {
        const conflict = err instanceof ApiError && err.status === 409;
        toast.add({
          type: conflict ? "info" : "error",
          title: conflict ? t`A backup is already running` : t`Backup failed`,
          description: conflict ? undefined : err.message,
        });
      },
    });
  }

  if (status.isError) {
    return (
      <SettingsSection title={title} description={description}>
        <AboutCard className="px-5 py-4">
          <p className="m-0 text-[12px] text-muted-foreground">
            {t`Backup status is unavailable from this server.`}
          </p>
        </AboutCard>
      </SettingsSection>
    );
  }

  if (data?.status === "unsupported") {
    return (
      <SettingsSection title={title} description={description}>
        <AboutCard className="px-5 py-4">
          <p className="m-0 max-w-2xl text-[12px] leading-relaxed text-muted-foreground">
            {t`This server runs on Postgres. Built-in backups cover SQLite only — back up Postgres with pg_dump or your provider's snapshots.`}
          </p>
        </AboutCard>
      </SettingsSection>
    );
  }

  const busy = run.isPending || Boolean(data?.running);
  const stateLabel: Record<BackupState, string> = {
    ok: t`Backups are current`,
    none: t`No backup yet`,
    failed: t`Last backup failed`,
    stale: t`Backups are overdue`,
    disabled: t`Scheduled backups are off`,
    unsupported: "",
  };
  const interval = data ? fmtBackupInterval(data.interval_min) : "";
  const lastSuccess = data?.last_success_at ?? null;

  return (
    <SettingsSection
      title={title}
      description={description}
      action={
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || !data}
          onClick={backUpNow}
        >
          {busy ? t`Backing up…` : t`Back up now`}
        </Button>
      }
    >
      <AboutCard className="px-5 py-5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {data ? (
            <StatusLine state={data.status} label={stateLabel[data.status]} />
          ) : (
            <span className="text-[12px] text-muted-foreground">{t`Checking…`}</span>
          )}
          {data ? (
            <span className="text-[11px] text-muted-foreground">
              {data.enabled ? t`Every ${interval}` : t`Manual only`}
            </span>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile
            label={t`Last backup`}
            loading={status.isPending}
            tone={data?.status === "stale" ? "warn" : "default"}
            value={
              lastSuccess ? (
                fmtRelativeAge(lastSuccess, now, intlLocale)
              ) : (
                <span className="text-[12px] font-normal text-muted-foreground">{t`Never`}</span>
              )
            }
            sub={
              lastSuccess
                ? fmtBackupTimestamp(lastSuccess, intlLocale, timeZone, hour12)
                : undefined
            }
          />
          <StatTile
            label={t`Snapshots kept`}
            loading={status.isPending}
            value={data ? `${data.file_count} / ${data.keep}` : undefined}
            sub={data?.latest ? fmtBytes(data.latest.size_bytes) : undefined}
          />
          <StatTile
            label={t`Latest file`}
            loading={status.isPending}
            value={
              data?.latest ? (
                <span className="text-[13px]">{data.latest.name}</span>
              ) : (
                <span className="text-[12px] font-normal text-muted-foreground">{t`None`}</span>
              )
            }
          />
        </div>

        {data?.dir ? (
          <div className="mt-4">
            <p className="m-0 text-2xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {t`Directory`}
            </p>
            <code className="mt-1.5 block min-w-0 break-all text-[12px] text-foreground/85">
              {data.dir}
            </code>
          </div>
        ) : null}

        {data?.last_error ? (
          <div className="mt-4 rounded-lg bg-destructive/10 px-4 py-3">
            <p className="m-0 text-[12px] font-medium text-destructive">
              {data.last_attempt_at
                ? t`Failed ${fmtRelativeAge(data.last_attempt_at, now, intlLocale)}`
                : t`Failed`}
            </p>
            <p className="m-0 mt-1 break-words text-[12px] leading-relaxed text-foreground/85">
              {data.last_error}
            </p>
          </div>
        ) : null}
      </AboutCard>
    </SettingsSection>
  );
}
