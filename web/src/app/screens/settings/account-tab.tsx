import { useState } from "react";
import { Pill } from "@/components/Pill";
import { Skeleton } from "@/components/Skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getBaseUrl } from "@/lib/api/client";
import { fmtDate } from "@/lib/format";
import { useChangePassword, useMe } from "@/lib/hooks/useMe";
import { SettingsGroup, SettingsGroupRow, SettingsSection } from "./settings-ui";

/** Matches the server's `auth.MinPasswordLen`. */
const MIN_LENGTH = 10;

/** `https://host:port/path` → `host` — the part that identifies the server. */
function serverHost(url: string): string {
  try {
    return new URL(url, window.location.origin).host;
  } catch {
    return url || window.location.host;
  }
}

function ChangePasswordForm() {
  const change = useChangePassword();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setDone(false);
    // Checked here so the common mistakes never reach the network; the server
    // remains the authority on the current password.
    if (next !== confirm) {
      setError("The new passwords don't match.");
      return;
    }
    if (next.length < MIN_LENGTH) {
      setError(`Use at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (next === current) {
      setError("That is already your password.");
      return;
    }
    change.mutate(
      { current, next },
      {
        onSuccess: () => {
          setCurrent("");
          setNext("");
          setConfirm("");
          setDone(true);
        },
        onError: (err) => setError(err instanceof Error ? err.message : String(err)),
      },
    );
  }

  return (
    <form onSubmit={submit} className="flex max-w-sm flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="current-password">Current password</Label>
        <Input
          id="current-password"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>

      {error ? <p className="text-[13px] text-destructive">{error}</p> : null}
      {done ? (
        <p className="text-[13px] text-profit">
          Password changed. Your other devices will be signed out the next time they reconnect.
        </p>
      ) : null}

      <Button
        type="submit"
        className="w-fit"
        disabled={!current || !next || !confirm || change.isPending}
      >
        {change.isPending ? "Changing…" : "Change password"}
      </Button>
    </form>
  );
}

/**
 * The signed-in account. Read-only apart from the password — email changes and
 * two-factor need server work that does not exist yet.
 */
export function AccountTab() {
  const me = useMe();

  return (
    <div className="flex flex-col gap-6">
      <SettingsSection
        title="Signed in as"
        description="The account this browser is authenticated with."
      >
        <SettingsGroup>
          <SettingsGroupRow label="Email">
            {me.isLoading ? (
              <Skeleton className="h-4 w-40" />
            ) : (
              <span className="text-[13px]">{me.data?.email ?? "—"}</span>
            )}
          </SettingsGroupRow>
          <SettingsGroupRow label="Role">
            {me.isLoading ? (
              <Skeleton className="h-4 w-16" />
            ) : (
              <Pill>{me.data?.is_admin ? "Owner" : "Member"}</Pill>
            )}
          </SettingsGroupRow>
          <SettingsGroupRow label="Member since">
            {me.isLoading ? (
              <Skeleton className="h-4 w-24" />
            ) : (
              <span className="text-[13px]">{me.data ? fmtDate(me.data.created_at) : "—"}</span>
            )}
          </SettingsGroupRow>
          <SettingsGroupRow label="Server" last>
            <span className="text-[13px]">{serverHost(getBaseUrl())}</span>
          </SettingsGroupRow>
        </SettingsGroup>
      </SettingsSection>

      <SettingsSection
        title="Password"
        description={
          me.data?.totp_enabled
            ? "Two-factor authentication is on."
            : "Changing your password signs out your other devices — this browser stays signed in. Two-factor authentication isn't available yet."
        }
      >
        <ChangePasswordForm />
      </SettingsSection>
    </div>
  );
}
