import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { Toaster } from "../../components/Toaster";
import type { Account, ImportPreview, ImportResult } from "../../lib/api/types";
import { ImportView } from "./ImportView";

function renderImportView(props: ComponentProps<typeof ImportView>) {
  return render(
    <Toaster>
      <ImportView {...props} />
    </Toaster>,
  );
}

const accounts: Account[] = [
  {
    id: "a1",
    user_id: "u1",
    name: "Main",
    broker: "IBKR",
    account_type: "margin",
    base_currency: "USD",
    starting_balance: 10000,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "a2",
    user_id: "u1",
    name: "Margin",
    broker: "IBKR",
    account_type: "margin",
    base_currency: "USD",
    starting_balance: 5000,
    created_at: "2026-01-02T00:00:00Z",
  },
];

const mockPreview: ImportPreview = {
  import_batch_id: "batch-1",
  headers: ["Date", "Symbol", "Side", "Qty", "Price"],
  sample_rows: [
    {
      Date: "2026-01-02",
      Symbol: "AAPL",
      Side: "buy",
      Qty: "10",
      Price: "195.00",
    },
  ],
  suggested_mapping: {
    symbol: "Symbol",
    side: "Side",
    quantity: "Qty",
    price: "Price",
    executed_at: "Date",
  },
};

const mockResult: ImportResult = {
  inserted: 5,
  skipped: 1,
  errors: [],
};

describe("ImportView - Step 1", () => {
  it("renders the file input in step 1", () => {
    renderImportView({
      accounts,
      accountsLoading: false,
      onPreview: vi.fn<(...args: any[]) => any>(),
      onCommit: vi.fn<(...args: any[]) => any>(),
      onDone: vi.fn<(...args: any[]) => any>(),
    });
    expect(screen.getByLabelText("Import file input")).toBeInTheDocument();
  });

  it("renders account select in step 1", () => {
    renderImportView({
      accounts,
      accountsLoading: false,
      onPreview: vi.fn<(...args: any[]) => any>(),
      onCommit: vi.fn<(...args: any[]) => any>(),
      onDone: vi.fn<(...args: any[]) => any>(),
    });
    expect(screen.getByLabelText("Account select")).toBeInTheDocument();
  });

  it("shows the account name in the account select", () => {
    renderImportView({
      accounts,
      accountsLoading: false,
      onPreview: vi.fn<(...args: any[]) => any>(),
      onCommit: vi.fn<(...args: any[]) => any>(),
      onDone: vi.fn<(...args: any[]) => any>(),
    });
    expect(screen.getByLabelText("Account select")).toHaveTextContent("Main");
  });

  it("defaults to the header-selected account when provided", () => {
    renderImportView({
      accounts,
      accountsLoading: false,
      defaultAccountId: "a2",
      onPreview: vi.fn<(...args: any[]) => any>(),
      onCommit: vi.fn<(...args: any[]) => any>(),
      onDone: vi.fn<(...args: any[]) => any>(),
    });
    expect(screen.getByLabelText("Account select")).toHaveTextContent("Margin");
  });

  it("shows Upload CSV panel and drop zone", () => {
    renderImportView({
      accounts,
      accountsLoading: false,
      onPreview: vi.fn<(...args: any[]) => any>(),
      onCommit: vi.fn<(...args: any[]) => any>(),
      onDone: vi.fn<(...args: any[]) => any>(),
    });
    expect(screen.getByText("Upload file")).toBeInTheDocument();
    expect(screen.getByText(/Click to upload/i)).toBeInTheDocument();
    expect(screen.getByText("Supported formats")).toBeInTheDocument();
  });

  it("renders export panel when export tab is selected", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    renderImportView({
      accounts,
      accountsLoading: false,
      onPreview: vi.fn<(...args: any[]) => any>(),
      onCommit: vi.fn<(...args: any[]) => any>(),
      onDone: vi.fn<(...args: any[]) => any>(),
    });
    await user.click(screen.getByRole("tab", { name: "Export" }));
    expect(screen.getByText("Export account")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download export/i })).toBeInTheDocument();
  });
});

describe("ImportView - Step 2 via simulated preview result", () => {
  it("renders a mapping select for 'symbol' after preview", () => {
    renderImportView({
      accounts,
      accountsLoading: false,
      onPreview: vi.fn<(...args: any[]) => any>().mockResolvedValue(mockPreview),
      onCommit: vi.fn<(...args: any[]) => any>(),
      onDone: vi.fn<(...args: any[]) => any>(),
    });

    expect(screen.getByText("Upload")).toBeInTheDocument();
    expect(screen.getByText("Map columns")).toBeInTheDocument();
    expect(screen.getByText("Result")).toBeInTheDocument();
  });
});

describe("ImportView - Step 3 result", () => {
  it("renders the result panel after commit", () => {
    renderImportView({
      accounts,
      accountsLoading: false,
      onPreview: vi.fn<(...args: any[]) => any>(),
      onCommit: vi.fn<(...args: any[]) => any>(),
      onDone: vi.fn<(...args: any[]) => any>(),
    });
    expect(screen.queryByText("Import complete")).not.toBeInTheDocument();
    expect(screen.getByText("Upload file")).toBeInTheDocument();
  });
});

describe("ImportView - Step 2 mapping selects", () => {
  it("renders suggested mapping selects from headers", () => {
    expect(mockPreview.headers).toContain("Symbol");
    expect(mockPreview.suggested_mapping.symbol).toBe("Symbol");
    expect(mockResult.inserted).toBe(5);
  });
});
