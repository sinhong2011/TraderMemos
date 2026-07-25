import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { executionsApi } from "@/lib/api/executions";
import { ocrApi } from "@/lib/api/ocr";
import { tradesApi } from "@/lib/api/trades";
import { useUI } from "@/lib/ui";
import { NewTradeDrawer, rowsFromOcrExtract } from "./NewTradeDrawer";

vi.mock("../../lib/api/executions", () => ({
  executionsApi: { create: vi.fn<() => Promise<unknown>>() },
}));
vi.mock("../../lib/api/trades", () => ({ tradesApi: { patch: vi.fn<() => Promise<unknown>>() } }));
vi.mock("../../lib/api/cash", () => ({ cashApi: { create: vi.fn<() => Promise<unknown>>() } }));
vi.mock("../../lib/api/attachments", () => ({
  attachmentsApi: { upload: vi.fn<() => Promise<unknown>>() },
}));
vi.mock("../../lib/api/ocr", () => ({ ocrApi: { parse: vi.fn<() => Promise<unknown>>() } }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn<(...args: any[]) => any>() }));

const mockOcrSettings = vi.fn<() => unknown>();
vi.mock("../../lib/hooks/useOcrSettings", () => ({
  useOcrSettings: () => mockOcrSettings(),
}));
vi.mock("../../lib/hooks/useAccounts", () => ({
  useAccounts: () => ({
    data: [{ id: "a1", name: "Default", base_currency: "USD", starting_balance: 10000 }],
  }),
}));
vi.mock("../../lib/hooks/useAnalytics", () => ({
  useSummary: () => ({ data: { net_pnl: -50 }, isLoading: false }),
}));
vi.mock("../../lib/hooks/useCash", () => ({
  useCash: () => ({ data: [], isLoading: false }),
}));
vi.mock("../../lib/hooks/useSetups", () => ({
  useSetups: () => ({ data: [{ id: "s1", name: "Breakout" }] }),
}));
vi.mock("../../lib/hooks/useTags", () => ({
  useTags: () => ({
    data: [
      { id: "t1", name: "Momentum", kind: "tag" },
      { id: "m1", name: "FOMO", kind: "mistake" },
    ],
  }),
}));
vi.mock("../../components/Toast", () => ({
  useToastManager: () => ({ add: vi.fn<(...args: any[]) => any>() }),
}));

const mockedCreate = vi.mocked(executionsApi.create);
const mockedPatch = vi.mocked(tradesApi.patch);
const mockedOcrParse = vi.mocked(ocrApi.parse);
const wrap = (ui: ReactNode) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}
    >
      {ui}
    </QueryClientProvider>,
  );

describe("rowsFromOcrExtract", () => {
  it("sorts fills oldest-first and folds commission into fees", () => {
    const rows = rowsFromOcrExtract(
      {
        symbol: "AAPL",
        instrument_type: "stock",
        side: "long",
        confidence: 1,
        raw_text: "",
        warnings: [],
        rows: [
          {
            side: "sell",
            quantity: 1,
            price: 2,
            fees: 0,
            commission: 1,
            executed_at: "2026-07-16T12:00:00Z",
          },
          {
            side: "buy",
            quantity: 2,
            price: 1,
            fees: 0.5,
            commission: 0,
            executed_at: "2026-07-16T10:00:00Z",
          },
        ],
      },
      "long",
    );
    expect(rows.map((row) => row.side)).toEqual(["buy", "sell"]);
    expect(rows.map((row) => row.fees)).toEqual(["0.5", "1"]);
  });
});

describe("NewTradeDrawer", () => {
  beforeEach(() => {
    mockedCreate.mockReset();
    mockedPatch.mockReset();
    mockedOcrParse.mockReset();
    mockedCreate.mockResolvedValue({ execution_id: "e1", trade_id: "t1" });
    mockedPatch.mockResolvedValue({} as never);
    mockOcrSettings.mockReturnValue({
      data: {
        enabled: true,
        base_url: "https://api.openai.com/v1",
        model: "gpt-4o-mini",
        custom_prompt: "",
        api_key_set: true,
      },
      isLoading: false,
      isError: false,
    });
    useUI.getState().openModal("new-trade");
  });

  it("collapses the whole symbol card from its header", async () => {
    const user = userEvent.setup();
    wrap(<NewTradeDrawer />);
    const toggle = screen.getByRole("button", { name: "Toggle symbol 1" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("Symbol")).toBeVisible();
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("Symbol")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Journal" })).not.toBeInTheDocument();
    await user.click(toggle);
    expect(screen.getByLabelText("Symbol")).toBeVisible();
  });

  it("embeds journal and dividend controls on each symbol card", async () => {
    const user = userEvent.setup();
    wrap(<NewTradeDrawer />);
    expect(screen.queryByRole("tab", { name: /Journal/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /Dividends/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Journal" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByRole("button", { name: "Dividend" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByLabelText("Emotion")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Journal" }));
    expect(screen.getByLabelText("Emotion")).toBeVisible();
    expect(screen.getByLabelText("Entry reason")).toBeVisible();
    expect(screen.getByText("Screenshots")).toBeVisible();
    expect(screen.getByText("Breakout")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Dividend" }));
    expect(screen.getByLabelText("Dividend amount")).toBeVisible();
    expect(screen.getByLabelText("Dividend date")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Add symbol" }));
    expect(screen.getAllByRole("button", { name: "Journal" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Dividend" })).toHaveLength(2);
  });

  it("keeps result preview sticky in the footer", async () => {
    const user = userEvent.setup();
    wrap(<NewTradeDrawer />);
    await user.type(screen.getByLabelText("Symbol"), "AAPL");
    await user.type(screen.getByLabelText(/Qty row 1/), "10");
    await user.type(screen.getByLabelText(/Price row 1/), "100");
    expect((await screen.findAllByTestId("trade-result-preview")).length).toBeGreaterThanOrEqual(2);
    await user.click(screen.getByRole("button", { name: "Add symbol" }));
    expect(await screen.findByTestId("batch-trade-result-preview")).toBeVisible();
  });

  it("shows validation errors for an empty form", async () => {
    wrap(<NewTradeDrawer />);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/symbol is required/i)).toBeVisible();
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("adds and removes symbols without closing", async () => {
    wrap(<NewTradeDrawer />);
    await userEvent.click(screen.getByRole("button", { name: "Add symbol" }));
    expect(screen.getByRole("region", { name: "Symbol trade 2" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Remove symbol 2" }));
    expect(screen.queryByRole("region", { name: "Symbol trade 2" })).not.toBeInTheDocument();
    expect(useUI.getState().modal).toBe("new-trade");
  });

  it("prompts for vision setup when screenshot scan is not configured", async () => {
    mockOcrSettings.mockReturnValue({
      data: {
        enabled: false,
        base_url: "https://api.openai.com/v1",
        model: "gpt-4o-mini",
        custom_prompt: "",
        api_key_set: false,
      },
      isLoading: false,
      isError: false,
    });
    wrap(<NewTradeDrawer />);
    await userEvent.click(screen.getByRole("button", { name: "Prefill trade from screenshot" }));
    expect(screen.getByRole("dialog", { name: "Set up screenshot scan" })).toBeVisible();
    expect(screen.getByText("Enable screenshot scan")).toBeVisible();
    expect(screen.getByText("Add API key")).toBeVisible();
  });

  it("loads every OCR symbol into its own editable block", async () => {
    mockedOcrParse.mockResolvedValue({
      symbol: "AAPL",
      instrument_type: "stock",
      side: "long",
      confidence: 0.9,
      raw_text: "…",
      warnings: [],
      symbols: ["AAPL", "TSLA"],
      rows: [
        {
          symbol: "AAPL",
          side: "buy",
          quantity: 10,
          price: 100,
          fees: 0,
          commission: 0,
          executed_at: "2026-07-16T10:00:00Z",
        },
        {
          symbol: "TSLA",
          side: "sell",
          quantity: 2,
          price: 250,
          fees: 1,
          commission: 0,
          executed_at: "2026-07-16T11:00:00Z",
        },
      ],
    });
    wrap(<NewTradeDrawer />);
    await userEvent.upload(
      document.querySelector('[data-testid="ocr-scan-input"]') as HTMLInputElement,
      new File(["x"], "fills.png", { type: "image/png" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Symbol trade 2" })).toBeVisible(),
    );
    expect(screen.getByLabelText("Symbol")).toHaveValue("AAPL");
    expect(screen.getByLabelText("Symbol 2")).toHaveValue("TSLA");
    expect(screen.getByTestId("ocr-scan-summary")).toBeVisible();
    expect(screen.getByRole("button", { name: "Scan info" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByRole("listbox", { name: "Symbols in scan" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Save & next/i })).not.toBeInTheDocument();
  });

  it("scans multiple screenshots and merges fills", async () => {
    mockedOcrParse
      .mockResolvedValueOnce({
        symbol: "TSLA",
        instrument_type: "option",
        side: "long",
        confidence: 0.9,
        raw_text: "a",
        warnings: [],
        rows: [
          {
            symbol: "TSLA",
            side: "buy",
            quantity: 3,
            price: 1.95,
            fees: 2.05,
            commission: 0,
            executed_at: "2026-07-16T13:35:19Z",
          },
        ],
      })
      .mockResolvedValueOnce({
        symbol: "TSLA",
        instrument_type: "option",
        side: "long",
        confidence: 0.9,
        raw_text: "b",
        warnings: [],
        rows: [
          {
            symbol: "TSLA",
            side: "sell",
            quantity: 2,
            price: 2.45,
            fees: 0.43,
            commission: 0,
            executed_at: "2026-07-16T13:45:10Z",
          },
        ],
      });
    wrap(<NewTradeDrawer />);
    await userEvent.upload(
      document.querySelector('[data-testid="ocr-scan-input"]') as HTMLInputElement,
      [
        new File(["a"], "page1.png", { type: "image/png" }),
        new File(["b"], "page2.png", { type: "image/png" }),
      ],
    );
    await waitFor(() => expect(mockedOcrParse).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByLabelText("Qty row 1")).toHaveValue("3"));
    expect(screen.getByLabelText("Qty row 2")).toHaveValue("2");
  });

  it("shows fill amount as qty × price", async () => {
    wrap(<NewTradeDrawer />);
    await userEvent.type(screen.getByLabelText("Qty row 1"), "3");
    await userEvent.type(screen.getByLabelText("Price row 1"), "1.95");
    expect(screen.getByText("Amount")).toBeVisible();
    expect(await screen.findByText("$5.85")).toBeVisible();
  });

  it("shows batch est. P&L across symbols", async () => {
    wrap(<NewTradeDrawer />);
    await userEvent.type(screen.getByLabelText("Symbol"), "AAPL");
    await userEvent.type(screen.getByLabelText("Qty row 1"), "10");
    await userEvent.type(screen.getByLabelText("Price row 1"), "100");
    await userEvent.click(screen.getByRole("button", { name: "Add execution row symbol 1" }));
    await userEvent.click(screen.getByRole("button", { name: "Toggle action symbol 1 row 2" }));
    await userEvent.type(screen.getByLabelText("Qty row 2"), "10");
    await userEvent.type(screen.getByLabelText("Price row 2"), "110");
    await userEvent.click(screen.getByRole("button", { name: "Add symbol" }));
    await userEvent.type(screen.getByLabelText("Symbol 2"), "TSLA");
    await userEvent.type(screen.getByLabelText("Qty symbol 2 row 1"), "2");
    await userEvent.type(screen.getByLabelText("Price symbol 2 row 1"), "200");
    await userEvent.click(screen.getByRole("button", { name: "Add execution row symbol 2" }));
    await userEvent.click(screen.getByRole("button", { name: "Toggle action symbol 2 row 2" }));
    await userEvent.type(screen.getByLabelText("Qty symbol 2 row 2"), "2");
    await userEvent.type(screen.getByLabelText("Price symbol 2 row 2"), "210");
    expect(await screen.findByTestId("batch-trade-result-preview")).toBeVisible();
  });

  it("posts fills for all symbols in one save and patches matching trades", async () => {
    mockedCreate
      .mockResolvedValueOnce({ execution_id: "e1", trade_id: "ta" })
      .mockResolvedValueOnce({ execution_id: "e2", trade_id: "tt" });
    wrap(<NewTradeDrawer />);
    await userEvent.type(screen.getByLabelText("Symbol"), "AAPL");
    await userEvent.type(screen.getByLabelText("Qty row 1"), "10");
    await userEvent.type(screen.getByLabelText("Price row 1"), "100");
    await userEvent.click(screen.getByRole("button", { name: "Add symbol" }));
    await userEvent.type(screen.getByLabelText("Symbol 2"), "TSLA");
    await userEvent.type(screen.getByLabelText("Qty symbol 2 row 1"), "2");
    await userEvent.type(screen.getByLabelText("Price symbol 2 row 1"), "250");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(2));
    expect(mockedCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ account_id: "a1", symbol: "AAPL", quantity: 10 }),
    );
    expect(mockedCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ account_id: "a1", symbol: "TSLA", quantity: 2 }),
    );
    await waitFor(() =>
      expect(mockedPatch).toHaveBeenCalledWith(
        "ta",
        expect.objectContaining({ target_price: undefined }),
      ),
    );
    await waitFor(() =>
      expect(mockedPatch).toHaveBeenCalledWith(
        "tt",
        expect.objectContaining({ target_price: undefined }),
      ),
    );
  });

  it("clears and cancels the form", async () => {
    wrap(<NewTradeDrawer />);
    await userEvent.type(screen.getByLabelText("Symbol"), "AAPL");
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByLabelText("Symbol")).toHaveValue("");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(useUI.getState().modal).toBeNull());
  });
});
