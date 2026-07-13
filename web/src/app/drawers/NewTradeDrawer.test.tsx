import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { executionsApi } from "../../lib/api/executions";
import { tradesApi } from "../../lib/api/trades";
import { useUI } from "../../lib/ui";
import { NewTradeDrawer } from "./NewTradeDrawer";

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

const mockedCreate = vi.mocked(executionsApi.create);
const mockedPatch = vi.mocked(tradesApi.patch);

function wrap(ui: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("NewTradeDrawer", () => {
  beforeEach(() => {
    mockedCreate.mockReset();
    mockedPatch.mockReset();
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
    expect(screen.getByRole("button", { name: "General" })).toBeInTheDocument();
    expect(screen.getByLabelText("Symbol")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check compliance" })).toBeInTheDocument();
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
