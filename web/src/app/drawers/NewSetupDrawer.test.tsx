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
		useUI.getState().openDrawer("new-setup");
	});

	it("creates a setup and closes", async () => {
		mockedCreate.mockResolvedValue({ id: "s1" } as never);
		wrap(<NewSetupDrawer />);
		await userEvent.type(screen.getByLabelText("Name"), "Gap and Go");
		await userEvent.type(
			screen.getByLabelText("Description / Notes"),
			"Opening range breakout",
		);
		await userEvent.click(screen.getByRole("button", { name: "Save" }));
		await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
		expect(mockedCreate.mock.calls[0][0]).toMatchObject({
			name: "Gap and Go",
			description: "Opening range breakout",
		});
		await waitFor(() => expect(useUI.getState().drawer).toBeNull());
	});

	it("validates the name", async () => {
		wrap(<NewSetupDrawer />);
		await userEvent.click(screen.getByRole("button", { name: "Save" }));
		expect(await screen.findByText(/name is required/i)).toBeVisible();
		expect(mockedCreate).not.toHaveBeenCalled();
	});
});
