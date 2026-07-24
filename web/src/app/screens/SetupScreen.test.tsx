import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("../../lib/auth", () => ({
  useAuth: (selector: (state: { signIn: (access: string, refresh: string) => void }) => unknown) =>
    selector({ signIn: vi.fn<(access: string, refresh: string) => void>() }),
}));

import { SetupScreen } from "./SetupScreen";

describe("SetupScreen", () => {
  it("shows optional import step with csv/json and skip action", async () => {
    render(<SetupScreen />);

    await userEvent.type(screen.getByLabelText("Username"), "owner");
    await userEvent.type(screen.getByLabelText("Password"), "supersecret123");
    await userEvent.type(screen.getByLabelText("Confirm password"), "supersecret123");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByRole("heading", { name: "Optional import " })).toBeInTheDocument();
    expect(screen.getAllByText(/\.csv/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\.json/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Skip for now" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to account" })).toBeInTheDocument();
    expect(screen.getByLabelText("Import file input")).toHaveAttribute(
      "accept",
      ".csv,text/csv,.json,application/json",
    );
  });
});
