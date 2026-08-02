import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { FlexSyncSettings } from "@/lib/api/flexSync";
import { Toaster } from "@/components/Toaster";
import { FlexSyncButton } from "./FlexSyncModal";

const apiMock = vi.hoisted(() => ({
  fetch: vi.fn<(...args: unknown[]) => unknown>(),
}));

vi.mock("../lib/api/client", () => ({
  getToken: () => "test-token",
  getBaseUrl: () => "http://test.local",
  apiFetch: apiMock.fetch,
  qs: () => "",
}));

afterEach(() => {
  apiMock.fetch.mockReset();
});

function renderWithQuery(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Toaster>{ui}</Toaster>
    </QueryClientProvider>,
  );
}

const unconfigured: FlexSyncSettings = { configured: false, enabled: false, token_set: false };
const configured: FlexSyncSettings = {
  configured: true,
  enabled: true,
  query_id: "q42",
  token_set: true,
  token_hint: "…1234",
  last_synced_at: "2026-08-01T10:00:00Z",
  last_status: "2 new, 0 duplicate of 2 rows",
};

describe("FlexSyncButton", () => {
  it("opens with setup guidance when unconfigured", async () => {
    apiMock.fetch.mockResolvedValue(unconfigured);
    renderWithQuery(<FlexSyncButton accountId="a1" accountName="IB Main" />);

    fireEvent.click(screen.getByRole("button", { name: "IBKR sync" }));
    await waitFor(() => expect(screen.getByText(/create a Flex Query/)).toBeInTheDocument());
    expect(screen.getByLabelText("Flex Query ID")).toHaveValue("");
    expect(screen.queryByText(/Sync now/)).not.toBeInTheDocument();
  });

  it("shows saved state, token hint, and last sync status", async () => {
    apiMock.fetch.mockResolvedValue(configured);
    renderWithQuery(<FlexSyncButton accountId="a1" accountName="IB Main" />);

    fireEvent.click(screen.getByRole("button", { name: "IBKR sync" }));
    await waitFor(() => expect(screen.getByLabelText("Flex Query ID")).toHaveValue("q42"));
    expect(screen.getByText(/…1234/)).toBeInTheDocument();
    expect(screen.getByText(/2 new, 0 duplicate/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sync now" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  it("requires a token on first save", async () => {
    apiMock.fetch.mockResolvedValue(unconfigured);
    renderWithQuery(<FlexSyncButton accountId="a1" accountName="IB Main" />);

    fireEvent.click(screen.getByRole("button", { name: "IBKR sync" }));
    await waitFor(() => expect(screen.getByLabelText("Flex Query ID")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Flex Query ID"), { target: { value: "q1" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    // Only the initial GET fired — no PUT without a token.
    await waitFor(() => expect(apiMock.fetch).toHaveBeenCalledTimes(1));
    expect(
      apiMock.fetch.mock.calls.some(
        (c) => (c[1] as { method?: string } | undefined)?.method === "PUT",
      ),
    ).toBe(false);
  });

  it("saves without a token when one is already stored", async () => {
    apiMock.fetch.mockResolvedValue(configured);
    renderWithQuery(<FlexSyncButton accountId="a1" accountName="IB Main" />);

    fireEvent.click(screen.getByRole("button", { name: "IBKR sync" }));
    await waitFor(() => expect(screen.getByLabelText("Flex Query ID")).toHaveValue("q42"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      const put = apiMock.fetch.mock.calls.find(
        (c) => (c[1] as { method?: string } | undefined)?.method === "PUT",
      );
      expect(put).toBeTruthy();
      const body = JSON.parse((put?.[1] as { body: string }).body) as Record<string, unknown>;
      expect(body.query_id).toBe("q42");
      expect(body.token).toBeUndefined();
    });
  });
});
