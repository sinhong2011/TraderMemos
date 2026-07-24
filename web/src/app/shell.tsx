import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { AppNav } from "../components/AppNav";
import { CommandPalette } from "../components/CommandPalette";
import { HeaderBar } from "../components/HeaderBar";
import { MobileNavDrawer } from "../components/MobileNavDrawer";
import { MobileTabBar } from "../components/MobileTabBar";
import { AppUpdateBanner } from "../components/AppUpdateBanner";
import { Toaster } from "../components/Toaster";
import { UnauthorizedHandler } from "../components/UnauthorizedHandler";
import { PositionSizeModal } from "../components/tools/PositionSizeModal";
import { authApi, type SetupStatus } from "../lib/api/auth";
import { useAuth } from "../lib/auth";
import { useAppHotkeys } from "../lib/useAppHotkeys";
import { useUI } from "../lib/ui";
import { NewNoteDrawer } from "./drawers/NewNoteDrawer";
import { NewSetupDrawer } from "./drawers/NewSetupDrawer";
import { NewTradeDrawer } from "./drawers/NewTradeDrawer";
import { LoginScreen } from "./screens/LoginScreen";
import { SetupScreen } from "./screens/SetupScreen";

function AuthedShell() {
  const positionSizeOpen = useUI((s) => s.positionSizeOpen);
  const setPositionSizeOpen = useUI((s) => s.setPositionSizeOpen);
  useAppHotkeys();

  return (
    <div className="relative flex h-full overflow-hidden bg-background pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <AppNav />

      <div className="relative z-[1] flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
        <HeaderBar />
        <main className="min-h-0 min-w-0 flex-1 overflow-auto bg-background pb-[calc(56px+env(safe-area-inset-bottom))] md:pb-0">
          <Outlet />
        </main>
      </div>

      <MobileTabBar />
      <MobileNavDrawer />
      <CommandPalette />
      <PositionSizeModal open={positionSizeOpen} onOpenChange={setPositionSizeOpen} />
      <NewTradeDrawer />
      <NewSetupDrawer />
      <NewNoteDrawer />
    </div>
  );
}

function UnauthedGate() {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loadError, setLoadError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    authApi
      .setupStatus()
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch(() => {
        // API unreachable — fall through to login (Server URL can be fixed there).
        if (!cancelled) {
          setStatus({
            needs_setup: false,
            registration_open: false,
            user_count: -1,
            min_password_length: 10,
          });
          setLoadError("Could not reach API — check Server URL on the sign-in screen.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!status) return;
    const nextPath = status.needs_setup ? "/setup" : "/login";
    if (location.pathname !== nextPath) {
      void navigate({ to: nextPath, replace: true });
    }
  }, [status, location.pathname, navigate]);

  if (!status) {
    return (
      <div className="flex min-h-full items-center justify-center bg-background text-[13px] text-muted-foreground">
        Checking install status…
      </div>
    );
  }

  if (status.needs_setup) {
    return <SetupScreen />;
  }

  return <LoginScreen registrationOpen={status.registration_open} banner={loadError} />;
}

const AUTH_ENTRY_PATHS = new Set(["/setup", "/login"]);

export function AppShell() {
  const authed = useAuth((s) => s.authed);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!authed) return;
    if (!AUTH_ENTRY_PATHS.has(location.pathname)) return;
    void navigate({ to: "/dashboard", replace: true });
  }, [authed, location.pathname, navigate]);

  return (
    <Toaster>
      <UnauthorizedHandler />
      <AppUpdateBanner />
      {!authed ? <UnauthedGate /> : <AuthedShell />}
    </Toaster>
  );
}
