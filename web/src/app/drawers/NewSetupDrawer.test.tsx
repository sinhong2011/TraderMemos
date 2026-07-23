import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { setupsApi } from "../../lib/api/setups";
import { useUI } from "../../lib/ui";
import { NewSetupDrawer } from "./NewSetupDrawer";

vi.mock("../../lib/api/setups", () => ({
  setupsApi: { create: vi.fn<(...args: any[]) => any>(), update: vi.fn<(...args: any[]) => any>() },
}));
vi.mock("../../components/Toast", () => ({
  useToastManager: () => ({ add: vi.fn<(...args: any[]) => any>() }),
}));

const mockedCreate = vi.mocked(setupsApi.create);
const mockedUpdate = vi.mocked(setupsApi.update);

function wrap(ui: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("NewSetupDrawer", () => {
  beforeEach(() => {
    mockedCreate.mockReset();
    mockedUpdate.mockReset();
    useUI.setState({ modal: null, setupDraft: null, tradeDraft: null });
    useUI.getState().openModal("new-setup");
  });

  it("creates a setup and closes", async () => {
    mockedCreate.mockResolvedValue({ id: "s1" } as never);
    wrap(<NewSetupDrawer />);
    await userEvent.type(screen.getByLabelText("Name"), "Gap and Go");
    await userEvent.type(screen.getByLabelText("Thesis"), "Opening range breakout");
    await userEvent.click(screen.getByRole("button", { name: /save setup/i }));
    await waitFor(() =>
      expect(mockedCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Gap and Go",
          thesis: "Opening range breakout",
          direction: "long",
        }),
        expect.anything(),
      ),
    );
    await waitFor(() => expect(useUI.getState().modal).toBeNull());
  });

  it("validates the name", async () => {
    wrap(<NewSetupDrawer />);
    await userEvent.click(screen.getByRole("button", { name: /save setup/i }));
    expect(await screen.findByText(/name is required/i)).toBeVisible();
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("edits an existing setup from a draft", async () => {
    mockedUpdate.mockResolvedValue({ id: "s1" } as never);
    useUI.getState().openSetupEdit({
      id: "s1",
      name: "ORB",
      thesis: "Opening range",
      symbol: "AAPL",
      direction: "long",
      target: "110",
      stop: "95",
      checklistText: "Above VWAP",
    });
    wrap(<NewSetupDrawer />);
    expect(await screen.findByRole("heading", { name: /edit setup/i })).toBeVisible();
    expect(screen.getByLabelText("Name")).toHaveValue("ORB");
    await userEvent.clear(screen.getByLabelText("Name"));
    await userEvent.type(screen.getByLabelText("Name"), "ORB Updated");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() =>
      expect(mockedUpdate).toHaveBeenCalledWith(
        "s1",
        expect.objectContaining({
          name: "ORB Updated",
          symbol: "AAPL",
          target_price: 110,
          stop_price: 95,
          checklist: ["Above VWAP"],
        }),
      ),
    );
    await waitFor(() => expect(useUI.getState().modal).toBeNull());
  });
});
