import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { KeybindingRecorder } from "./KeybindingRecorder";
import { APP_HOTKEYS, formatHotkeyLabel } from "@/lib/hotkeys";
import { getHotkeyKeys, useKeybindings } from "@/lib/keybindings";

function recorderButton() {
  return screen.getByRole("button", { name: /change shortcut/i });
}

describe("KeybindingRecorder", () => {
  beforeEach(() => {
    useKeybindings.setState({ overrides: {} });
  });

  it("shows the current binding and records a modifier combo immediately", async () => {
    const user = userEvent.setup();
    render(<KeybindingRecorder id="tool-size" />);
    expect(recorderButton()).toHaveTextContent(formatHotkeyLabel(APP_HOTKEYS["tool-size"].keys));

    await user.click(recorderButton());
    await user.keyboard("{Control>}{Shift>}j{/Shift}{/Control}");

    await waitFor(() => expect(getHotkeyKeys()["tool-size"]).toBe("mod+shift+j"));
  });

  it("records a two-key sequence", async () => {
    const user = userEvent.setup();
    render(<KeybindingRecorder id="action-new-trade" />);
    await user.click(recorderButton());
    await user.keyboard("cd");
    await waitFor(() => expect(getHotkeyKeys()["action-new-trade"]).toBe("c>d"));
  });

  it("cancels on Escape without changing the binding", async () => {
    const user = userEvent.setup();
    render(<KeybindingRecorder id="action-new-trade" />);
    await user.click(recorderButton());
    await user.keyboard("{Escape}");
    expect(getHotkeyKeys()["action-new-trade"]).toBe("c>t");
  });

  it("reports a conflict and keeps the previous binding", async () => {
    const user = userEvent.setup();
    render(<KeybindingRecorder id="action-new-trade" />);
    await user.click(recorderButton());
    await user.keyboard("gh");
    expect(await screen.findByText(/already used by home/i)).toBeInTheDocument();
    expect(getHotkeyKeys()["action-new-trade"]).toBe("c>t");
  });

  it("reports a reserved combo", async () => {
    const user = userEvent.setup();
    render(<KeybindingRecorder id="action-new-trade" />);
    await user.click(recorderButton());
    await user.keyboard("{Control>}w{/Control}");
    expect(await screen.findByText(/reserved/i)).toBeInTheDocument();
    expect(getHotkeyKeys()["action-new-trade"]).toBe("c>t");
  });

  it("offers reset only once a command is customized", async () => {
    const user = userEvent.setup();
    render(<KeybindingRecorder id="action-new-trade" />);
    const reset = screen.getByRole("button", { name: /reset to default/i });
    expect(reset).toBeDisabled();

    await user.click(recorderButton());
    await user.keyboard("cd");
    await waitFor(() => expect(getHotkeyKeys()["action-new-trade"]).toBe("c>d"));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /reset to default/i })).toBeEnabled(),
    );

    await user.click(screen.getByRole("button", { name: /reset to default/i }));
    expect(getHotkeyKeys()["action-new-trade"]).toBe("c>t");
  });
});
