import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { Toaster } from "@/components/Toaster";
import type { FlexSyncConnection } from "@/lib/api/flexSync";
import type { Account, ImportBatch } from "@/lib/api/types";
import { ConnectionsTab } from "./connections-tab";

const state = vi.hoisted(() => ({
  connections: [] as FlexSyncConnection[],
  imports: [] as ImportBatch[],
}));

vi.mock("../../../lib/hooks/useFlexSync", () => ({
  useFlexSyncConnections: () => ({ data: state.connections, isLoading: false, isError: false }),
  useRunFlexSync: () => ({ mutate: () => {}, isPending: false }),
}));

vi.mock("../../../lib/hooks/useImports", () => ({
  useImports: () => ({ data: state.imports, isLoading: false, isError: false }),
  useDeleteImport: () => ({ mutate: () => {}, isPending: false }),
}));

vi.mock("../../../components/FlexSyncModal", () => ({
  FlexSyncButton: ({ label }: { label?: string }) => <button type="button">{label}</button>,
}));

function renderTab(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Toaster>{ui}</Toaster>
    </QueryClientProvider>,
  );
}

const accounts = [{ id: "a1", name: "IB Main" } as Account];

const healthy: FlexSyncConnection = {
  account_id: "a1",
  account_name: "IB Main",
  configured: true,
  enabled: true,
  query_id: "q1",
  token_set: true,
  last_synced_at: "2026-08-01T10:00:00Z",
  last_status: "3 new, 1 duplicate of 4 rows",
};

const batch: ImportBatch = {
  id: "b1",
  user_id: "u1",
  account_id: "a1",
  source: "ibkr-flex-sync",
  filename: null,
  column_mapping: null,
  row_count: 4,
  status: "committed",
  created_at: "2026-08-01T10:00:00Z",
};

describe("ConnectionsTab", () => {
  it("shows empty states when nothing is connected or imported", () => {
    state.connections = [];
    state.imports = [];
    renderTab(<ConnectionsTab accounts={accounts} />);
    expect(screen.getByText("No broker connected")).toBeInTheDocument();
    expect(screen.getByText("Nothing imported yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Connect a broker" })).toHaveAttribute(
      "href",
      "/connect",
    );
  });

  it("lists a healthy connection with its account and status", () => {
    state.connections = [healthy];
    state.imports = [];
    renderTab(<ConnectionsTab accounts={accounts} />);
    expect(screen.getByText("IB Main")).toBeInTheDocument();
    expect(screen.getByText("Healthy")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sync now" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Configure" })).toBeInTheDocument();
  });

  it("marks a failing connection and surfaces the error", () => {
    state.connections = [{ ...healthy, last_status: "error", last_error: "token expired" }];
    state.imports = [];
    renderTab(<ConnectionsTab accounts={accounts} />);
    expect(screen.getByText("Sync failing")).toBeInTheDocument();
    expect(screen.getByText("token expired")).toBeInTheDocument();
  });

  it("lists import history with rollback for committed batches only", () => {
    state.connections = [];
    state.imports = [batch, { ...batch, id: "b2", status: "reversed" }];
    renderTab(<ConnectionsTab accounts={accounts} />);
    expect(screen.getAllByText("IBKR Flex sync")).toHaveLength(2);
    expect(screen.getByText("Rolled back")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Roll back/ })).toHaveLength(1);
  });
});
