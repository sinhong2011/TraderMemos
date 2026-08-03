import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import { FxConverterModal } from "./FxConverterModal";

vi.mock("../../lib/api/market", () => ({
  marketApi: {
    fx: vi.fn<(p: { from: string; to: string }) => Promise<unknown>>().mockResolvedValue({
      from: "USD",
      to: "EUR",
      rate: 0.9,
      as_of: "2026-08-03T00:00:00Z",
      provider: "test",
      cached: false,
    }),
  },
}));

function renderModal() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <FxConverterModal open onOpenChange={() => {}} />
    </QueryClientProvider>,
  );
}

describe("FxConverterModal", () => {
  it("converts the amount with the fetched rate", async () => {
    renderModal();
    expect(await screen.findByText("€90.00")).toBeInTheDocument();
    expect(screen.getByText(/1 USD = 0\.9000 EUR/)).toBeInTheDocument();
  });

  it("recomputes when the amount changes", async () => {
    renderModal();
    await screen.findByText("€90.00");
    const user = userEvent.setup();
    const amount = screen.getByLabelText("Amount");
    await user.clear(amount);
    await user.type(amount, "250");
    expect(screen.getByText("€225.00")).toBeInTheDocument();
  });

  it("skips the network and uses rate 1 when currencies match", async () => {
    renderModal();
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("To"), "USD");
    expect(screen.getByText("$100.00")).toBeInTheDocument();
    expect(screen.getByText(/1 USD = 1 USD/)).toBeInTheDocument();
  });

  it("swaps the currency pair", async () => {
    renderModal();
    await screen.findByText("€90.00");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Swap currencies" }));
    expect(screen.getByLabelText("From")).toHaveValue("EUR");
    expect(screen.getByLabelText("To")).toHaveValue("USD");
  });
});
