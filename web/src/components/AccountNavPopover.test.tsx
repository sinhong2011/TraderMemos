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

  it("lists accounts and sets the filter", async () => {
    const user = userEvent.setup();
    wrap(<AccountNavPopover />);

    await user.click(screen.getByRole("button", { name: /Account: All accounts/i }));
    expect(screen.getByRole("button", { name: "Live" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Live" }));

    expect(useFilters.getState().accountId).toBe("a1");
  });
});
