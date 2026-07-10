import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setupsApi } from "../../lib/api/setups";
import { useUI } from "../../lib/ui";
import { NewSetupDrawer } from "./NewSetupDrawer";

vi.mock("../../lib/api/setups", () => ({
	setupsApi: { create: vi.fn() },
}));
vi.mock("../../components/Toast", () => ({
	useToastManager: () => ({ add: vi.fn() }),
}));

const mockedCreate = vi.mocked(setupsApi.create);

function wrap(ui: ReactNode) {
	const qc = new QueryClient({
		defaultOptions: { mutations: { retry: false } },
	});
	return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("NewSetupDrawer", () => {
	beforeEach(() => {
		mockedCreate.mockReset();
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
});
