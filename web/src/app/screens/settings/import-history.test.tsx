import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { Toaster } from "@/components/Toaster";
import type { Account, ImportBatch } from "@/lib/api/types";
import { ImportHistorySection } from "./import-history";

const state = vi.hoisted(() => ({ imports: [] as ImportBatch[] }));

vi.mock("../../../lib/hooks/useImports", () => ({
  useImports: () => ({ data: state.imports, isLoading: false, isError: false }),
  useDeleteImport: () => ({ mutate: () => {}, isPending: false }),
}));

function renderSection(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Toaster>{ui}</Toaster>
    </QueryClientProvider>,
  );
}

const accounts = [{ id: "a1", name: "IB Main" } as Account];

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

describe("ImportHistorySection", () => {
  it("shows an empty state before anything is imported", () => {
    state.imports = [];
    renderSection(<ImportHistorySection accounts={accounts} />);
    expect(screen.getByText("Nothing imported yet")).toBeInTheDocument();
  });

  it("lists batches with account, source and rollback for committed only", () => {
    state.imports = [
      batch,
      { ...batch, id: "b2", status: "reversed", source: "csv", filename: "fills.csv" },
    ];
    renderSection(<ImportHistorySection accounts={accounts} />);
    expect(screen.getByText("IBKR Flex sync")).toBeInTheDocument();
    expect(screen.getByText("File import")).toBeInTheDocument();
    expect(screen.getByText(/fills\.csv/)).toBeInTheDocument();
    expect(screen.getAllByText(/IB Main/)).not.toHaveLength(0);
    expect(screen.getByText("Rolled back")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Roll back/ })).toHaveLength(1);
  });

  it("labels batches for deleted accounts", () => {
    state.imports = [{ ...batch, account_id: "gone" }];
    renderSection(<ImportHistorySection accounts={accounts} />);
    expect(screen.getByText(/Deleted account/)).toBeInTheDocument();
  });
});
