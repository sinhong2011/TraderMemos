import { Outlet } from "@tanstack/react-router";
import { AppNav } from "../components/AppNav";
import { CommandPalette } from "../components/CommandPalette";
import { HeaderBar } from "../components/HeaderBar";
import { Toaster } from "../components/Toaster";
import { UnauthorizedHandler } from "../components/UnauthorizedHandler";
import { PositionSizeModal } from "../components/tools/PositionSizeModal";
import { useAuth } from "../lib/auth";
import { useAppHotkeys } from "../lib/useAppHotkeys";
import { useUI } from "../lib/ui";
import { NewNoteDrawer } from "./drawers/NewNoteDrawer";
import { NewSetupDrawer } from "./drawers/NewSetupDrawer";
import { NewTradeDrawer } from "./drawers/NewTradeDrawer";
import { LoginScreen } from "./screens/LoginScreen";

function AuthedShell() {
  const positionSizeOpen = useUI((s) => s.positionSizeOpen);
  const setPositionSizeOpen = useUI((s) => s.setPositionSizeOpen);
  useAppHotkeys();

  return (
    <div className="signal-app relative flex h-full overflow-hidden">
      <div className="signal-app-grain" aria-hidden />
      <AppNav />

      <div className="relative z-[1] flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-bg shadow-[inset_1px_0_0_var(--color-border)]">
        <HeaderBar />
        <main className="min-h-0 min-w-0 flex-1 overflow-auto bg-bg">
          <Outlet />
        </main>
      </div>

      <CommandPalette />
      <PositionSizeModal open={positionSizeOpen} onOpenChange={setPositionSizeOpen} />
      <NewTradeDrawer />
      <NewSetupDrawer />
      <NewNoteDrawer />
    </div>
  );
}

export function AppShell() {
  const authed = useAuth((s) => s.authed);

  return (
    <Toaster>
      <UnauthorizedHandler />
      {!authed ? <LoginScreen /> : <AuthedShell />}
    </Toaster>
  );
}
