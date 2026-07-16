import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { executionsApi } from "../../lib/api/executions";
import { ocrApi } from "../../lib/api/ocr";
import { tradesApi } from "../../lib/api/trades";
import { useUI } from "../../lib/ui";
import { NewTradeDrawer, rowsFromOcrExtract } from "./NewTradeDrawer";

vi.mock("../../lib/api/executions", () => ({
  executionsApi: { create: vi.fn() },
}));
vi.mock("../../lib/api/trades", () => ({
  tradesApi: { patch: vi.fn() },
}));
vi.mock("../../lib/api/cash", () => ({
  cashApi: { create: vi.fn() },
}));
vi.mock("../../lib/api/attachments", () => ({
  attachmentsApi: { upload: vi.fn() },
}));
vi.mock("../../lib/api/ocr", () => ({
  ocrApi: { parse: vi.fn() },
}));
vi.mock("../../lib/hooks/useAccounts", () => ({
  useAccounts: () => ({
    data: [
      { id: "a1", name: "Default", base_currency: "USD" },
      { id: "a2", name: "Swing", base_currency: "USD" },
    ],
  }),
}));
vi.mock("../../lib/hooks/useSetups", () => ({
  useSetups: () => ({ data: [] }),
}));
vi.mock("../../lib/hooks/useTags", () => ({
  useTags: () => ({ data: [] }),
}));
vi.mock("../../components/Toast", () => ({
  useToastManager: () => ({ add: vi.fn() }),
}));
vi.mock("../../lib/hooks/useRiskRules", () => ({
  useRiskRules: () => ({ data: undefined }),
}));
vi.mock("../../lib/hooks/useAnalytics", () => ({
  useSummary: () => ({ data: undefined }),
}));
vi.mock("../../lib/hooks/useTrades", () => ({
  useTrades: () => ({ data: [] }),
}));

const mockedCreate = vi.mocked(executionsApi.create);
const mockedPatch = vi.mocked(tradesApi.patch);
const mockedOcrParse = vi.mocked(ocrApi.parse);

function wrap(ui: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("rowsFromOcrExtract", () => {
  it("maps OCR fills into drawer rows", () => {
    const rows = rowsFromOcrExtract(
      {
        symbol: "AAPL",
        instrument_type: "stock",
        side: "long",
        confidence: 0.9,
        raw_text: "…",
        warnings: [],
        rows: [
          {
            side: "buy",
            quantity: 10,
            price: 185.5,
            fees: 0.5,
            commission: 1,
            executed_at: "2024-01-15T10:30:00Z",
          },
        ],
      },
      "long",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].side).toBe("buy");
    expect(rows[0].quantity).toBe("10");
    expect(rows[0].price).toBe("185.5");
    expect(rows[0].fees).toBe("0.5");
    expect(rows[0].commission).toBe("1");
    expect(rows[0].executed_at).toMatch(/2024-01-15T/);
  });
});

describe("NewTradeDrawer", () => {
  beforeEach(() => {
    mockedCreate.mockReset();
    mockedPatch.mockReset();
    mockedOcrParse.mockReset();
    mockedCreate.mockResolvedValue({
      execution_id: "e1",
      trade_id: "t1",
    });
    mockedPatch.mockResolvedValue({} as never);
    useUI.getState().openModal("new-trade");
  });

  it("renders tabs and form fields when open", () => {
    wrap(<NewTradeDrawer />);
    expect(screen.getByText("New Trade")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "General" })).toBeInTheDocument();
    expect(screen.getByLabelText("Symbol")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check compliance" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Prefill trade from screenshot" }),
    ).toBeInTheDocument();
  });

  it("shows a validation error instead of submitting an empty symbol", async () => {
    wrap(<NewTradeDrawer />);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/symbol is required/i)).toBeVisible();
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("submits a valid row, patches journal, and closes", async () => {
    wrap(<NewTradeDrawer />);
    await userEvent.type(screen.getByLabelText("Symbol"), "AAPL");
    await userEvent.type(screen.getByLabelText("Qty row 1"), "10");
    await userEvent.type(screen.getByLabelText("Price row 1"), "185.5");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
    expect(mockedCreate.mock.calls[0][0]).toMatchObject({
      account_id: "a1",
      symbol: "AAPL",
      side: "buy",
      quantity: 10,
      price: 185.5,
    });
    await waitFor(() => expect(mockedPatch).toHaveBeenCalledWith("t1", expect.any(Object)));
    await waitFor(() => expect(useUI.getState().modal).toBeNull());
  });

  it("prefills the form from a scanned screenshot", async () => {
    mockedOcrParse.mockResolvedValue({
      symbol: "TSLA",
      instrument_type: "stock",
      side: "short",
      confidence: 0.85,
      raw_text: "TSLA SELL 5 @ 250.25",
      warnings: [],
      rows: [
        {
          side: "sell",
          quantity: 5,
          price: 250.25,
          fees: 0,
          commission: 0,
          executed_at: "2024-06-01T14:32:00Z",
        },
      ],
    });
    wrap(<NewTradeDrawer />);
    const file = new File([new Uint8Array([1, 2, 3])], "fill.png", { type: "image/png" });
    const input = document.querySelector('[data-testid="ocr-scan-input"]');
    expect(input).toBeTruthy();
    await userEvent.upload(input as HTMLInputElement, file);
    await waitFor(() => expect(mockedOcrParse).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByLabelText("Symbol")).toHaveValue("TSLA"));
    expect(screen.getByLabelText("Qty row 1")).toHaveValue("5");
    expect(screen.getByLabelText("Price row 1")).toHaveValue("250.25");
    expect(screen.getByRole("button", { name: /Toggle action row 1/i })).toHaveTextContent(/SELL/i);
    // OCR does not attach journal screenshots — that stays on the Journal tab.
    await userEvent.click(screen.getByRole("tab", { name: "Journal" }));
    expect(screen.queryByText("fill.png")).not.toBeInTheDocument();
  });

  it("keeps the form open and reports failed rows on partial failure", async () => {
    mockedCreate
      .mockResolvedValueOnce({ execution_id: "e1", trade_id: "t1" })
      .mockRejectedValueOnce(new Error("boom"));
    wrap(<NewTradeDrawer />);
    await userEvent.type(screen.getByLabelText("Symbol"), "AAPL");
    await userEvent.type(screen.getByLabelText("Qty row 1"), "10");
    await userEvent.type(screen.getByLabelText("Price row 1"), "185.5");
    await userEvent.click(screen.getByRole("button", { name: "Add execution row" }));
    await userEvent.type(screen.getByLabelText("Qty row 2"), "5");
    await userEvent.type(screen.getByLabelText("Price row 2"), "90");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/row 2/i)).toBeVisible();
    expect(useUI.getState().modal).toBe("new-trade");
  });

  it("resets the form on reopen", async () => {
    wrap(<NewTradeDrawer />);
    await userEvent.type(screen.getByLabelText("Symbol"), "AAPL");
    expect(screen.getByLabelText("Symbol")).toHaveValue("AAPL");

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(useUI.getState().modal).toBeNull());

    useUI.getState().openModal("new-trade");
    await waitFor(() => expect(screen.getByLabelText("Symbol")).toHaveValue(""));
  });

  it("disables Cancel while a save is in flight", async () => {
    mockedCreate.mockImplementation(() => new Promise(() => {}));
    wrap(<NewTradeDrawer />);
    await userEvent.type(screen.getByLabelText("Symbol"), "AAPL");
    await userEvent.type(screen.getByLabelText("Qty row 1"), "10");
    await userEvent.type(screen.getByLabelText("Price row 1"), "185.5");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled());
  });
});
