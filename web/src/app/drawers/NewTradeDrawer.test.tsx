import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { executionsApi } from "../../lib/api/executions";
import { useUI } from "../../lib/ui";
import { NewTradeDrawer } from "./NewTradeDrawer";

vi.mock("../../lib/api/executions", () => ({
	executionsApi: { create: vi.fn() },
}));
vi.mock("../../lib/hooks/useAccounts", () => ({
	useAccounts: () => ({
		data: [
			{ id: "a1", name: "Default", base_currency: "USD" },
			{ id: "a2", name: "Swing", base_currency: "USD" },
		],
	}),
}));
vi.mock("../../components/Toast", () => ({
	useToastManager: () => ({ add: vi.fn() }),
}));

const mockedCreate = vi.mocked(executionsApi.create);

function wrap(ui: ReactNode) {
	const qc = new QueryClient({
		defaultOptions: { mutations: { retry: false } },
	});
	return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("NewTradeDrawer", () => {
	beforeEach(() => {
		mockedCreate.mockReset();
		useUI.getState().openDrawer("new-trade");
	});

	it("renders form fields when open", () => {
		wrap(<NewTradeDrawer />);
		expect(screen.getByText("New Trade")).toBeInTheDocument();
		expect(screen.getByLabelText("Symbol")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
	});

	it("shows a validation error instead of submitting an empty symbol", async () => {
		wrap(<NewTradeDrawer />);
		await userEvent.click(screen.getByRole("button", { name: "Save" }));
		expect(await screen.findByText(/symbol is required/i)).toBeVisible();
		expect(mockedCreate).not.toHaveBeenCalled();
	});

	it("submits a valid row and closes", async () => {
		mockedCreate.mockResolvedValue(undefined);
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
		await waitFor(() => expect(useUI.getState().drawer).toBeNull());
	});

	it("keeps the form open and reports failed rows on partial failure", async () => {
		mockedCreate
			.mockResolvedValueOnce(undefined)
			.mockRejectedValueOnce(new Error("boom"));
		wrap(<NewTradeDrawer />);
		await userEvent.type(screen.getByLabelText("Symbol"), "AAPL");
		await userEvent.type(screen.getByLabelText("Qty row 1"), "10");
		await userEvent.type(screen.getByLabelText("Price row 1"), "185.5");
		await userEvent.click(
			screen.getByRole("button", { name: "Add execution row" }),
		);
		await userEvent.type(screen.getByLabelText("Qty row 2"), "5");
		await userEvent.type(screen.getByLabelText("Price row 2"), "90");
		await userEvent.click(screen.getByRole("button", { name: "Save" }));
		// Post-filter numbering: the failed row (originally #2) is now the only row
		expect(await screen.findByText(/execution 1 failed: boom/i)).toBeVisible();
		expect(screen.queryByLabelText("Qty row 2")).not.toBeInTheDocument();
		expect(useUI.getState().drawer).toBe("new-trade");
	});
});
