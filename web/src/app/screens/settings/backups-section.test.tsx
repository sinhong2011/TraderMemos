import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { Toaster } from "@/components/Toaster";
import type { BackupStatus } from "@/lib/api/backup";
import { ApiError } from "@/lib/api/client";
import { renderWithI18n } from "@/test/renderWithI18n";
import { BackupsSection } from "./backups-section";

type RunOpts = {
  onSuccess?: (s: BackupStatus) => void;
  onError?: (e: Error) => void;
};

const backup = vi.hoisted(() => ({
  status: {
    data: undefined as BackupStatus | undefined,
    isPending: false,
    isError: false,
  },
  run: {
    mutate: vi.fn<(v: undefined, opts?: RunOpts) => void>(),
    isPending: false,
  },
}));

vi.mock("@/lib/hooks/useBackup", () => ({
  useBackupStatus: () => backup.status,
  useRunBackup: () => backup.run,
}));

function status(over: Partial<BackupStatus> = {}): BackupStatus {
  return {
    enabled: true,
    driver: "sqlite",
    status: "ok",
    dir: "/srv/tm/backups",
    keep: 14,
    interval_min: 1440,
    running: false,
    last_success_at: new Date(Date.now() - 3 * 3_600_000).toISOString(),
    last_attempt_at: new Date(Date.now() - 3 * 3_600_000).toISOString(),
    latest: {
      name: "tradermemos-20261004-031500Z.db",
      size_bytes: 2_621_440,
      created_at: "2026-10-04T03:15:00Z",
    },
    file_count: 3,
    ...over,
  };
}

function renderSection() {
  return renderWithI18n(
    <Toaster>
      <BackupsSection />
    </Toaster>,
  );
}

beforeEach(() => {
  backup.status = { data: status(), isPending: false, isError: false };
  backup.run = { mutate: vi.fn<(v: undefined, opts?: RunOpts) => void>(), isPending: false };
});

describe("BackupsSection", () => {
  it("shows the last backup, retention, file and directory", () => {
    renderSection();
    expect(screen.getByText("Backups are current")).toBeTruthy();
    expect(screen.getByText("3 hours ago")).toBeTruthy();
    expect(screen.getByText("3 / 14")).toBeTruthy();
    expect(screen.getByText("2.5 MB")).toBeTruthy();
    expect(screen.getByText("tradermemos-20261004-031500Z.db")).toBeTruthy();
    expect(screen.getByText("/srv/tm/backups")).toBeTruthy();
    expect(screen.getByText("Every 24h")).toBeTruthy();
    expect(screen.queryByText(/^Failed/)).toBeNull();
  });

  it("surfaces the last error", () => {
    backup.status.data = status({
      status: "failed",
      last_error: "create backup dir: permission denied",
      last_attempt_at: new Date(Date.now() - 5 * 60_000).toISOString(),
    });
    renderSection();
    expect(screen.getByText("Last backup failed")).toBeTruthy();
    expect(screen.getByText("Failed 5 minutes ago")).toBeTruthy();
    expect(screen.getByText("create backup dir: permission denied")).toBeTruthy();
  });

  it("reads an empty directory as never backed up", () => {
    backup.status.data = status({
      status: "none",
      last_success_at: null,
      last_attempt_at: null,
      latest: null,
      file_count: 0,
    });
    renderSection();
    expect(screen.getByText("No backup yet")).toBeTruthy();
    expect(screen.getByText("Never")).toBeTruthy();
    expect(screen.getByText("0 / 14")).toBeTruthy();
  });

  it("marks a disabled schedule as manual-only", () => {
    backup.status.data = status({ status: "disabled", enabled: false });
    renderSection();
    expect(screen.getByText("Scheduled backups are off")).toBeTruthy();
    expect(screen.getByText("Manual only")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back up now" })).toBeTruthy();
  });

  it("explains Postgres quietly and offers no button", () => {
    backup.status.data = status({
      driver: "postgres",
      status: "unsupported",
      enabled: false,
      dir: undefined,
      latest: null,
      last_success_at: null,
      hint: "use pg_dump",
    });
    renderSection();
    expect(screen.getByText(/back up Postgres with pg_dump/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Back up now" })).toBeNull();
    expect(screen.queryByText("Last backup failed")).toBeNull();
  });

  it("runs a backup and toasts the new file", async () => {
    backup.run.mutate.mockImplementation((_v, opts) => opts?.onSuccess?.(status()));
    renderSection();
    await userEvent.click(screen.getByRole("button", { name: "Back up now" }));
    expect(backup.run.mutate).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Backup written")).toBeTruthy();
  });

  it("toasts a failed run with its reason", async () => {
    backup.run.mutate.mockImplementation((_v, opts) =>
      opts?.onError?.(new ApiError(500, "backup_failed", "disk full")),
    );
    renderSection();
    await userEvent.click(screen.getByRole("button", { name: "Back up now" }));
    expect(await screen.findByText("Backup failed")).toBeTruthy();
    expect(screen.getByText("disk full")).toBeTruthy();
  });

  it("tells the owner when a run is already in flight", async () => {
    backup.run.mutate.mockImplementation((_v, opts) =>
      opts?.onError?.(new ApiError(409, "conflict", "a backup is already running")),
    );
    renderSection();
    await userEvent.click(screen.getByRole("button", { name: "Back up now" }));
    expect(await screen.findByText("A backup is already running")).toBeTruthy();
  });

  it("disables the button while a backup runs", () => {
    backup.run.isPending = true;
    renderSection();
    const btn = screen.getByRole("button", { name: "Backing up…" });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("disables the button while the server reports a scheduled run", () => {
    backup.status.data = status({ running: true });
    renderSection();
    expect(
      (screen.getByRole("button", { name: "Backing up…" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
