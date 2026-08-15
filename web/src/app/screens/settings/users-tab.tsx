import { useState } from "react";
import { Modal } from "@/components/Modal";
import { Pill } from "@/components/Pill";
import { Skeleton } from "@/components/Skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdminUser } from "@/lib/api/admin";
import { fmtDate } from "@/lib/format";
import {
  useAdminUsers,
  useCreateUser,
  useDeleteUser,
  useResetUserPassword,
  useSetUserAdmin,
} from "@/lib/hooks/useAdminUsers";
import { useMe } from "@/lib/hooks/useMe";
import { SettingsGroup, SettingsRow, SettingsSection } from "./settings-ui";

/** Matches the server's `auth.MinPasswordLen`. */
const MIN_LENGTH = 10;

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-[12px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function AddUserModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateUser();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setUsername("");
    setPassword("");
    setIsAdmin(false);
    setError(null);
    onOpenChange(false);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password.length < MIN_LENGTH) {
      setError(`Use at least ${MIN_LENGTH} characters.`);
      return;
    }
    create.mutate(
      { email: username.trim(), password, is_admin: isAdmin },
      { onSuccess: close, onError: (err) => setError(errorText(err)) },
    );
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Add user">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field id="new-user-name" label="Username">
          <Input
            id="new-user-name"
            autoComplete="off"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </Field>
        <Field
          id="new-user-password"
          label="Temporary password"
          hint="Hand this to them out of band. They can change it from their own account page."
        >
          <Input
            id="new-user-password"
            type="text"
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <label className="flex items-start gap-2.5 text-[13px]">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={isAdmin}
            onChange={(e) => setIsAdmin(e.target.checked)}
          />
          <span>
            Make them an owner
            <span className="mt-0.5 block text-[12px] text-muted-foreground">
              Owners can add, remove and reset anyone on this server, including you.
            </span>
          </span>
        </label>
        {error ? <p className="text-[13px] text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={!username.trim()} loading={create.isPending}>
            Add user
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({
  user,
  onOpenChange,
}: {
  user: AdminUser | null;
  onOpenChange: (open: boolean) => void;
}) {
  const reset = useResetUserPassword();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function close() {
    setPassword("");
    setError(null);
    setDone(false);
    onOpenChange(false);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    setError(null);
    if (password.length < MIN_LENGTH) {
      setError(`Use at least ${MIN_LENGTH} characters.`);
      return;
    }
    reset.mutate(
      { id: user.id, password },
      { onSuccess: () => setDone(true), onError: (err) => setError(errorText(err)) },
    );
  }

  return (
    <Modal
      open={user !== null}
      onOpenChange={(next) => (next ? undefined : close())}
      title="Reset password"
    >
      {done ? (
        <div className="flex flex-col gap-3">
          <p className="text-[13px]">
            <strong>{user?.email}</strong> now signs in with the password you set. Their other
            sessions will be signed out.
          </p>
          <div className="flex justify-end">
            <Button type="button" onClick={close}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <p className="text-[13px] text-muted-foreground">
            Sets a new password for <strong className="text-foreground">{user?.email}</strong>{" "}
            without their current one. Use it when someone is locked out.
          </p>
          <Field id="reset-password" label="New password">
            <Input
              id="reset-password"
              type="text"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error ? <p className="text-[13px] text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" loading={reset.isPending}>
              Reset password
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/**
 * Deleting a user takes their trades, notes and attachments with it (the
 * schema cascades from `users`). Typing the name is the only thing standing
 * between a misplaced click and someone's whole journal.
 */
function DeleteUserModal({
  user,
  onOpenChange,
}: {
  user: AdminUser | null;
  onOpenChange: (open: boolean) => void;
}) {
  const remove = useDeleteUser();
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);

  function close() {
    setTyped("");
    setError(null);
    onOpenChange(false);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    remove.mutate(user.id, { onSuccess: close, onError: (err) => setError(errorText(err)) });
  }

  return (
    <Modal
      open={user !== null}
      onOpenChange={(next) => (next ? undefined : close())}
      title="Delete user"
    >
      <form onSubmit={submit} className="flex flex-col gap-3">
        <p className="text-[13px]">
          This permanently deletes <strong>{user?.email}</strong> along with every account, trade,
          note and screenshot they own. There is no undo.
        </p>
        <Field id="delete-confirm" label={`Type ${user?.email ?? ""} to confirm`}>
          <Input
            id="delete-confirm"
            autoComplete="off"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
        </Field>
        {error ? <p className="text-[13px] text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="destructive"
            disabled={typed !== user?.email}
            loading={remove.isPending}
          >
            Delete user
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function UserRow({
  user,
  isSelf,
  onReset,
  onDelete,
}: {
  user: AdminUser;
  isSelf: boolean;
  onReset: () => void;
  onDelete: () => void;
}) {
  const setAdmin = useSetUserAdmin();
  const [error, setError] = useState<string | null>(null);

  return (
    <SettingsRow
      primary={
        <span className="flex flex-wrap items-center gap-2">
          {user.email}
          <Pill tone={user.is_admin ? "accent" : "muted"}>
            {user.is_admin ? "Owner" : "Member"}
          </Pill>
          {isSelf ? <Pill tone="muted">You</Pill> : null}
          {user.totp_enabled ? <Pill tone="pos">2FA</Pill> : null}
        </span>
      }
      secondary={
        error ? (
          <span className="text-destructive">{error}</span>
        ) : (
          `Added ${fmtDate(user.created_at)}`
        )
      }
      actions={
        <>
          <Button type="button" variant="outline" size="xs" onClick={onReset}>
            Reset password
          </Button>
          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={setAdmin.isPending}
            onClick={() => {
              setError(null);
              setAdmin.mutate(
                { id: user.id, isAdmin: !user.is_admin },
                { onError: (err) => setError(errorText(err)) },
              );
            }}
          >
            {user.is_admin ? "Make member" : "Make owner"}
          </Button>
          {/* Deleting yourself is refused by the server anyway — the account
              page owns that, where the consequences are your own. */}
          {isSelf ? null : (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="text-muted-foreground hover:text-destructive"
              onClick={onDelete}
            >
              Delete
            </Button>
          )}
        </>
      }
    />
  );
}

/**
 * Everyone with an account on this server. Owner-only: the nav hides it for
 * members and every route behind it answers 403, so a member who guesses the
 * hash lands on the empty state rather than an error wall.
 */
export function UsersTab() {
  const me = useMe();
  const isOwner = me.data?.is_admin ?? false;
  const users = useAdminUsers(isOwner);
  const [addOpen, setAddOpen] = useState(false);
  const [resetting, setResetting] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);

  if (me.isLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  if (!isOwner) {
    return (
      <SettingsSection
        title="People"
        description="Only an owner can see and manage the accounts on this server."
      >
        <SettingsGroup>
          <SettingsRow
            primary="You are signed in as a member"
            secondary="Ask an owner for access."
          />
        </SettingsGroup>
      </SettingsSection>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <SettingsSection
        title="People"
        description="Everyone with an account on this server. Members see only their own trades; owners can also manage accounts here."
        action={
          <Button type="button" size="sm" onClick={() => setAddOpen(true)}>
            Add user
          </Button>
        }
      >
        <SettingsGroup>
          {users.isLoading ? (
            <div className="flex flex-col gap-2 px-5 py-4">
              <Skeleton className="h-5 w-56" />
              <Skeleton className="h-5 w-40" />
            </div>
          ) : users.isError ? (
            <SettingsRow primary="Could not load users" secondary={errorText(users.error)} />
          ) : (
            (users.data ?? []).map((u) => (
              <UserRow
                key={u.id}
                user={u}
                isSelf={u.id === me.data?.id}
                onReset={() => setResetting(u)}
                onDelete={() => setDeleting(u)}
              />
            ))
          )}
        </SettingsGroup>
      </SettingsSection>

      <AddUserModal open={addOpen} onOpenChange={setAddOpen} />
      <ResetPasswordModal user={resetting} onOpenChange={() => setResetting(null)} />
      <DeleteUserModal user={deleting} onOpenChange={() => setDeleting(null)} />
    </div>
  );
}
