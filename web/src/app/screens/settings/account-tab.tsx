import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { Pill } from "@/components/Pill";
import { Skeleton } from "@/components/Skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TotpSetup } from "@/lib/api/auth";
import { getBaseUrl } from "@/lib/api/client";
import { fmtDate } from "@/lib/format";
import {
  useChangePassword,
  useConfirmTotp,
  useDisableTotp,
  useMe,
  useStartTotp,
} from "@/lib/hooks/useMe";
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

/** Stacked label + control. Only inside modals — settings rows put the label
 *  left and the control right, which is too cramped for a dialog. */
function ModalField({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function ChangePasswordModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const change = useChangePassword();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  function close() {
    setCurrent("");
    setNext("");
    setConfirm("");
    setError(null);
    onOpenChange(false);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
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
        onSuccess: close,
        onError: (err) => setError(err instanceof Error ? err.message : String(err)),
      },
    );
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Change password">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <ModalField id="current-password" label="Current password">
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </ModalField>
        <ModalField id="new-password" label="New password">
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </ModalField>
        <ModalField id="confirm-password" label="Confirm new password">
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </ModalField>

        <p className="text-[12px] text-muted-foreground">
          Your other devices are signed out — this browser stays signed in.
        </p>
        {error ? <p className="text-[13px] text-destructive">{error}</p> : null}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={!current || !next || !confirm || change.isPending}>
            {change.isPending ? "Changing…" : "Change password"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** QR for the otpauth URL — scanning from a desktop is the whole point. */
function TotpQr({ url }: { url: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Always dark-on-white, whatever the app theme: inverting a QR is a
    // well-known way to make it unreadable to some scanners.
    void QRCode.toDataURL(url, {
      margin: 2,
      width: 200,
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then((out) => {
        if (!cancelled) setDataUrl(out);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!dataUrl) return <Skeleton className="size-[200px] rounded-lg" />;
  return (
    <img
      src={dataUrl}
      alt="Authenticator setup QR code"
      width={200}
      height={200}
      className="rounded-lg bg-white p-2"
    />
  );
}

function TwoFactorModal({
  open,
  onOpenChange,
  enabled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enabled: boolean;
}) {
  const start = useStartTotp();
  const confirm = useConfirmTotp();
  const disable = useDisableTotp();

  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function close() {
    onOpenChange(false);
  }

  function fail(err: unknown) {
    setError(err instanceof Error ? err.message : String(err));
  }

  // Enrolment begins with the modal — a button inside that only reveals the QR
  // is a click that does nothing the modal did not already promise. Opening
  // also clears the previous attempt, so a reopen never reuses a stale
  // candidate secret (the component stays mounted, so nothing resets itself).
  const startMutate = start.mutate;
  useEffect(() => {
    if (!open) return;
    setCode("");
    setPassword("");
    setError(null);
    if (enabled) return;
    setSetup(null);
    startMutate(undefined, { onSuccess: setSetup, onError: fail });
  }, [open, enabled, startMutate]);

  if (enabled) {
    return (
      <Modal open={open} onOpenChange={onOpenChange} title="Turn off two-factor">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            disable.mutate({ password, code }, { onSuccess: close, onError: fail });
          }}
        >
          <ModalField id="totp-off-password" label="Password">
            <Input
              id="totp-off-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </ModalField>
          <ModalField id="totp-off-code" label="Authenticator code">
            <Input
              id="totp-off-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </ModalField>
          <p className="text-[12px] text-muted-foreground">
            Both are required so a borrowed session can&apos;t strip the factor. Lost your
            authenticator? Run{" "}
            <code className="rounded bg-muted px-1 py-0.5">tradermemos disable-totp --email …</code>{" "}
            on the server — there are deliberately no recovery codes to lose.
          </p>
          {error ? <p className="text-[13px] text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={!password || !code || disable.isPending}
            >
              {disable.isPending ? "Turning off…" : "Turn off"}
            </Button>
          </div>
        </form>
      </Modal>
    );
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Set up two-factor">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!setup) return;
          setError(null);
          confirm.mutate({ secret: setup.secret, code }, { onSuccess: close, onError: fail });
        }}
      >
        <div className="flex flex-col items-center gap-3">
          {setup ? (
            <TotpQr url={setup.otpauth_url} />
          ) : (
            <Skeleton className="size-[200px] rounded-lg" />
          )}
          <p className="text-center text-[12px] text-muted-foreground">
            Scan with your authenticator app, or enter this key by hand:
          </p>
          <code className="break-all rounded bg-muted px-2 py-1 text-center text-[12px]">
            {setup?.secret ?? "…"}
          </code>
        </div>

        <ModalField id="totp-code" label="Enter a code to confirm">
          <Input
            id="totp-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </ModalField>
        {error ? <p className="text-[13px] text-destructive">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={!setup || code.length < 6 || confirm.isPending}>
            {confirm.isPending ? "Confirming…" : "Turn on"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * The signed-in account. Read-only apart from the password and the second
 * factor, both of which edit in a modal — short, focused tasks that left the
 * page a wall of inputs when they were inline.
 *
 * "Username", not "Email": the wire field is `email`, but nothing validates it
 * as one and the sign-in screen asks for a username, so that is what this
 * account actually has.
 */
export function AccountTab() {
  const me = useMe();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [totpOpen, setTotpOpen] = useState(false);
  const enabled = me.data?.totp_enabled ?? false;

  return (
    <div className="flex flex-col gap-6">
      <SettingsSection
        title="Signed in as"
        description="The account this browser is authenticated with."
      >
        <SettingsGroup>
          <SettingsGroupRow label="Username">
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
              <Pill tone={me.data?.is_admin ? "accent" : "muted"}>
                {me.data?.is_admin ? "Owner" : "Member"}
              </Pill>
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

      <SettingsSection title="Security" description="How this account is protected.">
        <SettingsGroup>
          <SettingsGroupRow label="Password" detail="Changing it signs out your other devices">
            <Button type="button" variant="outline" size="sm" onClick={() => setPasswordOpen(true)}>
              Change
            </Button>
          </SettingsGroupRow>
          <SettingsGroupRow
            label="Two-factor authentication"
            detail="A 6-digit code from an authenticator app, on top of your password"
            badge={<Pill tone={enabled ? "pos" : "muted"}>{enabled ? "On" : "Off"}</Pill>}
            last
          >
            <Button
              type="button"
              variant={enabled ? "outline" : "default"}
              size="sm"
              onClick={() => setTotpOpen(true)}
            >
              {enabled ? "Turn off" : "Set up"}
            </Button>
          </SettingsGroupRow>
        </SettingsGroup>
      </SettingsSection>

      {/* Both stay mounted and are driven by `open`. Mounting a Base UI Dialog
          that is already open renders nothing — it needs the false→true
          transition — so a conditional mount silently does nothing at all.
          TwoFactorModal resets itself when `open` flips instead, which is what
          keeps a reopen from reusing a stale candidate secret. */}
      <ChangePasswordModal open={passwordOpen} onOpenChange={setPasswordOpen} />
      <TwoFactorModal open={totpOpen} onOpenChange={setTotpOpen} enabled={enabled} />
    </div>
  );
}
