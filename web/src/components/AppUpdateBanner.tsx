import { RefreshCw, X } from "lucide-react";
import { aboutContent } from "@/lib/aboutContent";
import { useAppUpdate } from "@/lib/appUpdate";
import { useDisplayPrefs } from "@/lib/displayPrefs";
import { useLocale } from "@/i18n";
import { Button } from "./ui/button";

/**
 * Fixed toast shown only when a new service worker is waiting — the one update
 * state a click can fix. Non-actionable staleness (web/API behind the latest
 * release, deployment mismatch) surfaces quietly in Settings → About and as a
 * dot on the settings nav item instead. Lives inside Toaster so it works on
 * login + authed. Dismissal persists per build — see appUpdate.ts.
 */
export function AppUpdateBanner() {
  const { locale } = useLocale();
  const content = aboutContent(locale);
  const swReady = useAppUpdate((s) => s.swReady);
  const dismissed = useAppUpdate((s) => s.dismissed);
  const applyUpdate = useAppUpdate((s) => s.applyUpdate);
  const dismiss = useAppUpdate((s) => s.dismiss);
  const updateNotices = useDisplayPrefs((s) => s.updateNotices);

  const visible = updateNotices && !dismissed && swReady;
  if (!visible) return null;

  return (
    <div
      role="status"
      className="pointer-events-auto fixed top-[max(1rem,env(safe-area-inset-top))] right-4 z-[9998] w-[min(100%-2rem,23.5rem)] rounded-xl border border-border bg-popover p-3 shadow-lg motion-safe:animate-fab-in md:top-[max(1.5rem,env(safe-area-inset-top))] md:right-6"
    >
      <div className="flex items-start gap-2.5">
        <div className="mt-px flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <RefreshCw size={13} strokeWidth={2} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium tracking-tight text-popover-foreground">
            {content.updateBannerTitle}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-pretty text-muted-foreground">
            {content.updateBannerSw}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Button type="button" size="xs" onClick={() => applyUpdate()}>
              {content.updateReload}
            </Button>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={content.updateDismiss}
          onClick={() => dismiss()}
          className="-mt-0.5 -mr-0.5 text-muted-foreground hover:text-foreground"
        >
          <X aria-hidden />
        </Button>
      </div>
    </div>
  );
}
