import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { Toaster } from "@/components/Toaster";
import type { Account, ImportPreview, ImportResult } from "@/lib/api/types";
import { ImportView, jsonFileHasAccountName } from "./ImportView";

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
  import_batch_id: "",
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
    expect(screen.getByLabelText("Account select")).toHaveValue("a1");
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
    expect(screen.getByLabelText("Account select")).toHaveValue("a2");
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
    expect(screen.getByText(/Drop a file here/i)).toBeInTheDocument();
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
    // SegmentedControl is a ToggleGroup — segments are buttons, not tabs.
    await user.click(screen.getByRole("button", { name: "Export" }));
    expect(screen.getByText("Export account")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download export/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/omit account details/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "CSV" }));
    expect(screen.queryByLabelText(/omit account details/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "ZIP" }));
    expect(screen.getByLabelText(/omit account details/i)).toBeInTheDocument();
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
  it("stays on upload until a file is committed", () => {
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

  it("renders the result card after preview and commit", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    renderImportView({
      accounts,
      accountsLoading: false,
      onPreview: vi.fn<(...args: any[]) => any>().mockResolvedValue(mockPreview),
      onCommit: vi.fn<(...args: any[]) => any>().mockResolvedValue(mockResult),
      onDone: vi.fn<(...args: any[]) => any>(),
    });

    const file = new File(["Date,Symbol\n2026-01-02,AAPL\n"], "fills.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText("Import file input"), { target: { files: [file] } });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /preview import/i })).toBeEnabled(),
    );

    await user.click(screen.getByRole("button", { name: /preview import/i }));
    // "Map columns" labels both the step indicator and the card — wait on the step 2 action.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /confirm import/i })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: /confirm import/i }));
    await waitFor(() => expect(screen.getByText("Import complete")).toBeInTheDocument());

    expect(screen.getByText("Import finished")).toBeInTheDocument();
    expect(screen.getByText("Inserted")).toBeInTheDocument();
    expect(screen.getByText("Skipped (duplicates)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /go to home/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /import another/i })).toBeInTheDocument();
  });
});

describe("ImportView - Step 2 mapping selects", () => {
  it("renders suggested mapping selects from headers", () => {
    expect(mockPreview.headers).toContain("Symbol");
    expect(mockPreview.suggested_mapping.symbol).toBe("Symbol");
    expect(mockResult.inserted).toBe(5);
  });
});

describe("jsonFileHasAccountName", () => {
  it("reads nested account.name from export JSON", () => {
    expect(
      jsonFileHasAccountName(
        JSON.stringify({ account: { name: "Testing", broker: "IBKR" }, trades: [] }),
      ),
    ).toBe("Testing");
  });

  it("reads legacy account_name", () => {
    expect(jsonFileHasAccountName(JSON.stringify({ account_name: "Legacy", trades: [] }))).toBe(
      "Legacy",
    );
  });

  it("returns null for arrays and JSON without account name", () => {
    expect(jsonFileHasAccountName("[]")).toBeNull();
    expect(jsonFileHasAccountName(JSON.stringify({ trades: [] }))).toBeNull();
  });
});

describe("ImportView - JSON account bypass", () => {
  it("enables Preview when there are no accounts but JSON includes account name", async () => {
    renderImportView({
      accounts: [],
      accountsLoading: false,
      onPreview: vi.fn<(...args: any[]) => any>(),
      onCommit: vi.fn<(...args: any[]) => any>(),
      onDone: vi.fn<(...args: any[]) => any>(),
    });

    expect(screen.getByRole("button", { name: /preview import/i })).toBeDisabled();

    const payload = JSON.stringify({
      account: { name: "Imported Backup", broker: "IBKR" },
      trades: [],
    });
    const file = new File([payload], "backup.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText("Import file input"), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(screen.getByText("backup.json")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /preview import/i })).toBeEnabled();
    });
    expect(screen.getByText(/from the json file/i)).toBeInTheDocument();
    expect(screen.getByText(/on confirm/i)).toBeInTheDocument();
  });
});
