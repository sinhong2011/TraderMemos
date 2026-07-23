import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import { useAppHotkeys } from "../lib/useAppHotkeys";
import { useUI } from "../lib/ui";
import { CommandPalette } from "./CommandPalette";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn<(...args: any[]) => any>(),
}));

vi.mock("../lib/useToolRunner", () => ({
  useToolRunner: () => vi.fn<(...args: any[]) => any>(),
}));

describe("CommandPalette", () => {
  it("renders grouped commands when open", () => {
    useUI.setState({ commandOpen: true });
    render(<CommandPalette />);
    expect(screen.getByPlaceholderText(/Pages, tools/i)).toBeInTheDocument();
    expect(screen.getByText("Navigate")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("New Trade")).toBeInTheDocument();
    expect(screen.getByText("Position size")).toBeInTheDocument();
    expect(screen.getAllByText("G").length).toBeGreaterThan(0);
    expect(screen.getAllByText("N").length).toBeGreaterThan(0);
  });

  it("filters commands by query", async () => {
    const user = userEvent.setup();
    useUI.setState({ commandOpen: true });
    render(<CommandPalette />);
    await user.type(screen.getByPlaceholderText(/Pages, tools/i), "position");
    expect(screen.getByText("Position size")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("runs New Trade when N is pressed with an empty query", async () => {
    const user = userEvent.setup();
    useUI.setState({ commandOpen: true, modal: null });
    render(
      <>
        {/* Hotkeys live in the shell; mount them for this palette integration case */}
        <HotkeysForTest />
        <CommandPalette />
      </>,
    );
    await user.keyboard("n");
    await waitFor(() => expect(useUI.getState().modal).toBe("new-trade"));
    expect(useUI.getState().commandOpen).toBe(false);
  });
});

function HotkeysForTest() {
  useAppHotkeys();
  return null;
}
