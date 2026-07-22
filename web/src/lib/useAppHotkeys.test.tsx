import { render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { useAppHotkeys } from "./useAppHotkeys";
import { useUI } from "./ui";

const navigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}));

vi.mock("./useToolRunner", () => ({
  useToolRunner: () => vi.fn(),
}));

function HotkeyHost() {
  useAppHotkeys();
  return (
    <div data-testid="host" tabIndex={-1}>
      host
      <input data-testid="field" aria-label="Symbol" />
    </div>
  );
}

describe("useAppHotkeys", () => {
  beforeEach(() => {
    navigate.mockReset();
    useUI.setState({
      commandOpen: false,
      modal: null,
      positionSizeOpen: false,
    });
  });

  it("opens new trade on n", async () => {
    const user = userEvent.setup();
    render(<HotkeyHost />);
    await user.click(document.body);
    await user.keyboard("n");
    await waitFor(() => expect(useUI.getState().modal).toBe("new-trade"));
  });

  it("does not close new trade when n is pressed again", async () => {
    const user = userEvent.setup();
    useUI.setState({ modal: "new-trade" });
    render(<HotkeyHost />);
    await user.click(document.body);
    await user.keyboard("n");
    expect(useUI.getState().modal).toBe("new-trade");
  });

  it("opens new trade on KeyN even when event.key is empty", async () => {
    render(<HotkeyHost />);
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "",
        code: "KeyN",
        bubbles: true,
        cancelable: true,
      }),
    );
    await waitFor(() => expect(useUI.getState().modal).toBe("new-trade"));
  });

  it("toggles command palette on mod+k", async () => {
    const user = userEvent.setup();
    render(<HotkeyHost />);
    await user.keyboard("{Control>}k{/Control}");
    await waitFor(() => expect(useUI.getState().commandOpen).toBe(true));
  });

  it("does not fire n while typing in a text field", async () => {
    const user = userEvent.setup();
    render(<HotkeyHost />);
    await user.click(document.querySelector('[data-testid="field"]')!);
    await user.keyboard("n");
    expect(useUI.getState().modal).toBeNull();
  });

  it("opens new trade on n inside empty command palette input", async () => {
    const user = userEvent.setup();
    useUI.setState({ commandOpen: false, modal: null });
    render(
      <>
        <HotkeyHost />
        <input data-testid="palette" cmdk-input="" />
      </>,
    );
    const input = document.querySelector('[data-testid="palette"]') as HTMLInputElement;
    await user.click(input);
    await user.keyboard("n");
    await waitFor(() => expect(useUI.getState().modal).toBe("new-trade"));
  });

  it("navigates on g then d", async () => {
    const user = userEvent.setup();
    render(<HotkeyHost />);
    await user.click(document.body);
    await user.keyboard("gd");
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/dashboard" }));
  });

  it("navigates to settings on mod+comma", async () => {
    const user = userEvent.setup();
    render(<HotkeyHost />);
    await user.click(document.body);
    // jsdom is non-Apple → mod resolves to Control
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: ",",
        code: "Comma",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/settings" }));
  });
});
