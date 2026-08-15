import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { Toaster } from "@/components/Toaster";
import type { Account } from "@/lib/api/types";
import { ConnectView } from "./ConnectView";

const account: Account = {
  id: "a1",
  user_id: "u1",
  name: "Main",
  broker: "IBKR",
  account_type: "margin",
  base_currency: "USD",
  starting_balance: 10000,
  created_at: "2026-01-01T00:00:00Z",
};

const created: Account = { ...account, id: "a2", name: "Webull", broker: "Webull" };

const listed = vi.hoisted(() => ({ accounts: [] as Account[] }));
const createAccount = vi.hoisted(() => vi.fn(async () => ({}) as Account));

vi.mock("@/lib/hooks/useAccounts", () => ({
  useAccounts: () => ({ data: listed.accounts, isLoading: false }),
  useCreateAccount: () => ({ mutateAsync: createAccount }),
}));

const flexSave = vi.hoisted(() => vi.fn(async () => ({})));
const flexRun = vi.hoisted(() =>
  vi.fn(async () => ({ inserted: 3, skipped: 1, trades: 2, rows: 4 })),
);

vi.mock("@/lib/api/flexSync", () => ({
  flexSyncApi: {
    save: (...args: unknown[]) => flexSave(...(args as [])),
    run: (...args: unknown[]) => flexRun(...(args as [])),
  },
}));

function Wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <Toaster>{children}</Toaster>
    </QueryClientProvider>
  );
}

function renderConnect(props: Partial<ComponentProps<typeof ConnectView>> = {}) {
  const merged: ComponentProps<typeof ConnectView> = {
    onSelectBroker: vi.fn(),
    onImport: vi.fn(),
    onDone: vi.fn(),
    ...props,
  };
  render(
    <Wrapper>
      <ConnectView {...merged} />
    </Wrapper>,
  );
  return merged;
}

describe("ConnectView", () => {
  it("opens on the broker picker when no broker is chosen", () => {
    listed.accounts = [];
    renderConnect();

    expect(screen.getByRole("heading", { name: "Connect a broker" })).toBeInTheDocument();
    expect(screen.getByLabelText("Search brokers")).toBeInTheDocument();
  });

  it("shows the chosen broker's export steps instead of a generic file prompt", () => {
    listed.accounts = [];
    renderConnect({ brokerKey: "webull" });

    expect(screen.getByRole("heading", { name: "Webull" })).toBeInTheDocument();
    expect(screen.getByText(/desktop app \(the phone app cannot export\)/)).toBeInTheDocument();
  });

  it("creates the account and hands the import step both ids", async () => {
    const user = userEvent.setup();
    listed.accounts = [];
    createAccount.mockResolvedValueOnce(created);
    const props = renderConnect({ brokerKey: "webull" });

    // The name is pre-filled from the broker, so the default path is one click.
    await user.click(screen.getByRole("button", { name: /Continue to upload/ }));

    await waitFor(() => expect(props.onImport).toHaveBeenCalledWith("a2", "webull"));
    expect(createAccount).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Webull", broker: "Webull", base_currency: "USD" }),
    );
  });

  it("uses an existing account rather than creating a duplicate", async () => {
    const user = userEvent.setup();
    listed.accounts = [account];
    createAccount.mockClear();
    const props = renderConnect({ brokerKey: "webull" });

    await user.click(screen.getByRole("button", { name: /Continue to upload/ }));

    await waitFor(() => expect(props.onImport).toHaveBeenCalledWith("a1", "webull"));
    expect(createAccount).not.toHaveBeenCalled();
  });

  it("saves the Flex credentials and runs the first sync in one action", async () => {
    const user = userEvent.setup();
    listed.accounts = [account];
    renderConnect({ brokerKey: "ibkr" });

    await user.type(screen.getByLabelText("Flex Query ID"), "123456");
    await user.type(screen.getByLabelText("Flex Web Service token"), "tok_abc");
    await user.click(screen.getByRole("button", { name: /Connect and sync/ }));

    await waitFor(() =>
      expect(flexSave).toHaveBeenCalledWith("a1", {
        query_id: "123456",
        token: "tok_abc",
        enabled: true,
      }),
    );
    expect(flexRun).toHaveBeenCalledWith("a1");
    // Reported twice on purpose: inline on the card, and as a toast.
    expect(
      await screen.findByText("Connected — 3 executions imported, 1 duplicate skipped."),
    ).toBeInTheDocument();
    expect(await screen.findByText("Interactive Brokers connected")).toBeInTheDocument();
  });

  it("refuses to save half a Flex connection", async () => {
    const user = userEvent.setup();
    listed.accounts = [account];
    flexSave.mockClear();
    renderConnect({ brokerKey: "ibkr" });

    await user.type(screen.getByLabelText("Flex Query ID"), "123456");
    await user.click(screen.getByRole("button", { name: /Connect and sync/ }));

    expect(screen.getByText("Flex Web Service token is required.")).toBeInTheDocument();
    expect(flexSave).not.toHaveBeenCalled();
  });
});
