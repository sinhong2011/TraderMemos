import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { AppNav } from "@/components/AppNav";
import { CommandPalette } from "@/components/CommandPalette";
import { HeaderBar } from "@/components/HeaderBar";
import { MobileNavDrawer } from "@/components/MobileNavDrawer";
import { MobileTabBar } from "@/components/MobileTabBar";
import { AppUpdateBanner } from "@/components/AppUpdateBanner";
import { Toaster } from "@/components/Toaster";
import { UnauthorizedHandler } from "@/components/UnauthorizedHandler";
import { FxConverterModal } from "@/components/tools/FxConverterModal";
import { KellyModal } from "@/components/tools/KellyModal";
import { PositionSizeModal } from "@/components/tools/PositionSizeModal";
import { authApi, type SetupStatus } from "@/lib/api/auth";
import { useAuth } from "@/lib/auth";
import { useAppHotkeys } from "@/lib/useAppHotkeys";
import { useUI } from "@/lib/ui";
import { NewNoteDrawer } from "./drawers/NewNoteDrawer";
import { NewSetupDrawer } from "./drawers/NewSetupDrawer";
import { NewTradeDrawer } from "./drawers/NewTradeDrawer";
import { usePrefsSync } from "@/lib/hooks/usePrefsSync";
import { LoginScreen } from "./screens/LoginScreen";
import { SetupScreen } from "./screens/SetupScreen";

function AuthedShell() {
  const positionSizeOpen = useUI((s) => s.positionSizeOpen);
  const setPositionSizeOpen = useUI((s) => s.setPositionSizeOpen);
  const kellyOpen = useUI((s) => s.kellyOpen);
  const setKellyOpen = useUI((s) => s.setKellyOpen);
  const fxOpen = useUI((s) => s.fxOpen);
  const setFxOpen = useUI((s) => s.setFxOpen);
  useAppHotkeys();
  // Account-level preferences (timezones, clock, currency, screenshots cap)
  // pull on sign-in and push on change — see lib/prefsSync.ts for what syncs.
  usePrefsSync();

  // Phones scroll the document (lets Safari collapse its toolbar); ≥md the
  // shell is viewport-height again and <main> is the scroller.
  return (
    <div className="relative flex min-h-svh bg-background pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] md:h-full md:min-h-0 md:overflow-hidden">
      <AppNav />

      <div className="relative z-[1] flex min-w-0 flex-1 flex-col bg-background md:min-h-0 md:overflow-hidden">
        <HeaderBar />
        {/* Bottom padding clears the floating MobileTabBar (~44px capsule + 12px gap). */}
        {/* Named so route changes animate only the routed page — see the
            `::view-transition-*(page)` rules in global.css. Without a name here
            the whole viewport is snapshotted as `root` and the rail, header and
            tab bar crossfade along with the content. */}
        <main
          style={{ viewTransitionName: "page" }}
          className="flex min-w-0 flex-1 flex-col bg-background pb-[calc(64px+env(safe-area-inset-bottom))] md:min-h-0 md:overflow-auto md:pb-0"
        >
          <Outlet />
        </main>
      </div>

      <MobileTabBar />
      <MobileNavDrawer />
      <CommandPalette />
      <PositionSizeModal open={positionSizeOpen} onOpenChange={setPositionSizeOpen} />
      <KellyModal open={kellyOpen} onOpenChange={setKellyOpen} />
      <FxConverterModal open={fxOpen} onOpenChange={setFxOpen} />
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
      <div className="flex min-h-svh items-center justify-center bg-background text-[13px] text-muted-foreground">
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

/** Routes that render without auth — no gate, no nav, no authed side effects. */
function isPublicPath(pathname: string): boolean {
  return pathname.startsWith("/s/");
}

export function AppShell() {
  const authed = useAuth((s) => s.authed);
  const navigate = useNavigate();
  const location = useLocation();
  const publicRoute = isPublicPath(location.pathname);

  useEffect(() => {
    if (!authed || publicRoute) return;
    if (!AUTH_ENTRY_PATHS.has(location.pathname)) return;
    void navigate({ to: "/home", replace: true });
  }, [authed, publicRoute, location.pathname, navigate]);

  // Share pages are for visitors: skip UnauthedGate's login redirect and the
  // authed chrome (nav, hotkeys, prefs sync — all of which hit authed APIs).
  if (publicRoute) {
    return (
      <Toaster>
        <main className="flex min-h-svh min-w-0 flex-col bg-background">
          <Outlet />
        </main>
      </Toaster>
    );
  }

  return (
    <Toaster>
      <UnauthorizedHandler />
      <AppUpdateBanner />
      {!authed ? <UnauthedGate /> : <AuthedShell />}
    </Toaster>
  );
}
