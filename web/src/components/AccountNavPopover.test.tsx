import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { useFilters } from "@/lib/filters";
import { AccountNavPopover } from "./AccountNavPopover";

vi.mock("../lib/auth", () => ({
  useAuth: (sel: (s: { signOut: () => void }) => unknown) =>
    sel({ signOut: vi.fn<(...args: any[]) => any>() }),
}));

vi.mock("../lib/hooks/useAccounts", () => ({
  useAccounts: () => ({
    data: [
      { id: "a1", name: "Live", base_currency: "USD" },
      { id: "a2", name: "Paper", base_currency: "USD" },
      { id: "a3", name: "Euro", base_currency: "EUR" },
    ],
    isLoading: false,
  }),
}));

function wrap(ui: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("AccountNavPopover", () => {
  beforeEach(() => {
    useFilters.getState().reset();
  });

  it("lists accounts with their ledger currency and sets the filter", async () => {
    const user = userEvent.setup();
    wrap(<AccountNavPopover />);

    await user.click(screen.getByRole("button", { name: /Account: All accounts/i }));
    const all = await screen.findByRole("menuitemcheckbox", { name: /All accounts 3 accounts/ });
    expect(all).toBeChecked();
    const live = screen.getByRole("menuitemcheckbox", { name: /Live USD/ });
    await user.click(live);

    expect(useFilters.getState().accountIds).toEqual(["a1"]);
  });

  it("builds a same-currency portfolio and disables other-currency rows", async () => {
    const user = userEvent.setup();
    wrap(<AccountNavPopover />);

    await user.click(screen.getByRole("button", { name: /Account: All accounts/i }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: /Live USD/ }));
    await user.click(screen.getByRole("menuitemcheckbox", { name: /Paper USD/ }));
    expect(useFilters.getState().accountIds).toEqual(["a1", "a2"]);

    // The EUR account can't join a USD portfolio.
    expect(screen.getByRole("menuitemcheckbox", { name: /Euro EUR/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    // Deselecting one keeps the rest of the scope.
    await user.click(screen.getByRole("menuitemcheckbox", { name: /Live USD/ }));
    expect(useFilters.getState().accountIds).toEqual(["a2"]);
  });

  it("clears the scope from the All accounts row", async () => {
    const user = userEvent.setup();
    useFilters.getState().setAccounts(["a1", "a2"]);
    wrap(<AccountNavPopover />);

    await user.click(screen.getByRole("button", { name: /Account: 2 accounts/i }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: /All accounts/ }));
    expect(useFilters.getState().accountIds).toBeUndefined();
  });
});
