import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { AdminUser } from "@/lib/api/admin";
import { renderWithI18n } from "@/test/renderWithI18n";
import { UsersTab } from "./users-tab";

const me = vi.hoisted(() => ({
  data: { id: "u1", email: "owner", is_admin: true, created_at: "2026-01-01T00:00:00Z" },
  isLoading: false,
}));

const users = vi.hoisted(() => ({
  list: [] as AdminUser[],
  create: vi.fn(),
  setAdmin: vi.fn(),
  reset: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/lib/hooks/useMe", () => ({ useMe: () => me }));

vi.mock("@/lib/hooks/useAdminUsers", () => ({
  useAdminUsers: (enabled: boolean) => ({
    data: enabled ? users.list : undefined,
    isLoading: false,
    isError: false,
    error: null,
  }),
  useCreateUser: () => ({ mutate: users.create, isPending: false }),
  useSetUserAdmin: () => ({ mutate: users.setAdmin, isPending: false }),
  useResetUserPassword: () => ({ mutate: users.reset, isPending: false }),
  useDeleteUser: () => ({ mutate: users.remove, isPending: false }),
}));

function user(over: Partial<AdminUser> = {}): AdminUser {
  return {
    id: "u2",
    email: "member",
    is_admin: false,
    created_at: "2026-02-01T00:00:00Z",
    totp_enabled: false,
    ...over,
  };
}

beforeEach(() => {
  me.data = { id: "u1", email: "owner", is_admin: true, created_at: "2026-01-01T00:00:00Z" };
  me.isLoading = false;
  users.list = [user({ id: "u1", email: "owner", is_admin: true }), user()];
  users.create.mockReset();
  users.setAdmin.mockReset();
  users.reset.mockReset();
  users.remove.mockReset();
});

describe("UsersTab", () => {
  it("lists every account with its role", async () => {
    renderWithI18n(<UsersTab />);
    expect(await screen.findByText("owner")).toBeTruthy();
    expect(screen.getByText("member")).toBeTruthy();
    expect(screen.getByText("Owner")).toBeTruthy();
    expect(screen.getByText("Member")).toBeTruthy();
    expect(screen.getByText("You")).toBeTruthy();
  });

  // A member hitting #users directly must land somewhere sane, not on a
  // section that fires an owner-only request and shows the 403.
  it("tells a member the section is not theirs and asks for no data", () => {
    me.data = { id: "u2", email: "member", is_admin: false, created_at: "2026-02-01T00:00:00Z" };
    renderWithI18n(<UsersTab />);
    expect(screen.getByText("You are signed in as a member")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add user" })).toBeNull();
  });

  it("never offers to delete the signed-in owner", () => {
    renderWithI18n(<UsersTab />);
    // One Delete button — the member's. The owner's own row has none.
    expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(1);
  });

  it("promotes a member", async () => {
    renderWithI18n(<UsersTab />);
    await userEvent.click(screen.getByRole("button", { name: "Make owner" }));
    expect(users.setAdmin).toHaveBeenCalledWith({ id: "u2", isAdmin: true }, expect.anything());
  });

  it("refuses a short password when adding a user", async () => {
    renderWithI18n(<UsersTab />);
    await userEvent.click(screen.getByRole("button", { name: "Add user" }));
    await userEvent.type(await screen.findByLabelText("Username"), "newbie");
    await userEvent.type(screen.getByLabelText("Temporary password"), "short");
    await userEvent.click(screen.getByRole("button", { name: "Add user" }));
    expect(await screen.findByText("Use at least 10 characters.")).toBeTruthy();
    expect(users.create).not.toHaveBeenCalled();
  });

  it("creates a user, owner flag included", async () => {
    renderWithI18n(<UsersTab />);
    await userEvent.click(screen.getByRole("button", { name: "Add user" }));
    await userEvent.type(await screen.findByLabelText("Username"), "newbie");
    await userEvent.type(screen.getByLabelText("Temporary password"), "correct-horse-battery");
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Add user" }));
    expect(users.create).toHaveBeenCalledWith(
      { email: "newbie", password: "correct-horse-battery", is_admin: true },
      expect.anything(),
    );
  });

  // Deleting a user cascades their whole journal away, so the button stays
  // dead until the name is typed back.
  it("holds the delete until the username is typed", async () => {
    renderWithI18n(<UsersTab />);
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    const confirm = await screen.findByRole("button", { name: "Delete user" });
    expect(confirm.hasAttribute("disabled")).toBe(true);

    await userEvent.type(screen.getByLabelText("Type member to confirm"), "member");
    await waitFor(() => expect(confirm.hasAttribute("disabled")).toBe(false));
    await userEvent.click(confirm);
    expect(users.remove).toHaveBeenCalledWith("u2", expect.anything());
  });
});
