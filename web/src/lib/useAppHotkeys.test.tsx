import { render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { useAppHotkeys } from "./useAppHotkeys";
import { useKeybindings } from "./keybindings";
import { useUI } from "./ui";

const navigate = vi.fn<(...args: any[]) => any>();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}));

vi.mock("./useToolRunner", () => ({
  useToolRunner: () => vi.fn<(...args: any[]) => any>(),
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
    useKeybindings.setState({ overrides: {} });
    useUI.setState({
      commandOpen: false,
      modal: null,
      positionSizeOpen: false,
    });
  });

  it("opens new trade on the c t sequence", async () => {
    const user = userEvent.setup();
    render(<HotkeyHost />);
    await user.click(document.body);
    await user.keyboard("ct");
    await waitFor(() => expect(useUI.getState().modal).toBe("new-trade"));
  });

  it("does not close new trade when the sequence is typed again", async () => {
    const user = userEvent.setup();
    useUI.setState({ modal: "new-trade" });
    render(<HotkeyHost />);
    await user.click(document.body);
    await user.keyboard("ct");
    expect(useUI.getState().modal).toBe("new-trade");
  });

  it("honours a custom binding from settings", async () => {
    const user = userEvent.setup();
    useKeybindings.getState().setBinding("action-new-trade", "c>d");
    render(<HotkeyHost />);
    await user.click(document.body);
    await user.keyboard("cd");
    await waitFor(() => expect(useUI.getState().modal).toBe("new-trade"));
  });

  it("toggles command palette on mod+k", async () => {
    const user = userEvent.setup();
    render(<HotkeyHost />);
    await user.keyboard("{Control>}k{/Control}");
    await waitFor(() => expect(useUI.getState().commandOpen).toBe(true));
  });

  it("does not fire while typing in a text field", async () => {
    const user = userEvent.setup();
    render(<HotkeyHost />);
    await user.click(document.querySelector('[data-testid="field"]')!);
    await user.keyboard("ct");
    expect(useUI.getState().modal).toBeNull();
  });

  it("does not navigate on letter pairs inside ordinary words", async () => {
    // react-hotkeys-hook does not apply ignoreEventWhen to sequences, so the
    // "gh" in "bought" reached the nav handler and navigated Home mid-sentence.
    const user = userEvent.setup();
    render(<HotkeyHost />);
    await user.click(document.querySelector('[data-testid="field"]')!);
    await user.keyboard("bought a contract");
    expect(navigate).not.toHaveBeenCalled();
    expect(useUI.getState().modal).toBeNull();
  });

  it("does not fire create sequences typed into a field", async () => {
    const user = userEvent.setup();
    render(<HotkeyHost />);
    await user.click(document.querySelector('[data-testid="field"]')!);
    await user.keyboard("act");
    expect(useUI.getState().modal).toBeNull();
  });

  it("lets every letter be typed into a form field while a drawer is open", async () => {
    const user = userEvent.setup();
    useUI.setState({ modal: "new-trade" });
    render(<HotkeyHost />);
    const field = document.querySelector('[data-testid="field"]') as HTMLInputElement;
    await user.click(field);
    await user.keyboard("nNSct");
    expect(field.value).toBe("nNSct");
  });

  it("types into the command palette instead of firing a sequence", async () => {
    // The palette exception only applies while the box is empty, so the first
    // key of a sequence lands as a search character and the second is treated
    // as typing. Searching for a symbol like "CT" beats a hidden shortcut.
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
    await user.keyboard("ct");
    expect(input.value).toBe("ct");
    expect(useUI.getState().modal).toBeNull();
  });

  it("navigates on g then h", async () => {
    const user = userEvent.setup();
    render(<HotkeyHost />);
    await user.click(document.body);
    await user.keyboard("gh");
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/home" }));
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
