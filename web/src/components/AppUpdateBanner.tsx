import { RefreshCw, X } from "lucide-react";
import { aboutContent } from "@/lib/aboutContent";
import { useAppUpdate } from "@/lib/appUpdate";
import { useLocale } from "@/i18n";
import { APP_VERSION } from "@/lib/version";
import { Button } from "./ui/button";

/**
 * Fixed toast when a service-worker update is waiting or a newer GitHub
 * release is available. Lives inside Toaster so it works on login + authed.
 */
export function AppUpdateBanner() {
  const { locale } = useLocale();
  const content = aboutContent(locale);
  const swReady = useAppUpdate((s) => s.swReady);
  const webBehind = useAppUpdate((s) => s.webBehind);
  const apiBehind = useAppUpdate((s) => s.apiBehind);
  const apiVersion = useAppUpdate((s) => s.apiVersion);
  const remote = useAppUpdate((s) => s.remote);
  const dismissed = useAppUpdate((s) => s.dismissed);
  const applyUpdate = useAppUpdate((s) => s.applyUpdate);
  const dismiss = useAppUpdate((s) => s.dismiss);

  const updateAvailable = swReady || webBehind || apiBehind;
  const visible = !dismissed && updateAvailable;
  if (!visible) return null;

  const description = swReady
    ? content.updateBannerSw
    : webBehind && apiBehind
      ? content.updateBannerBothBehind
      : webBehind
        ? content.updateBannerWebBehind
        : apiBehind
          ? content.updateBannerApiBehind
          : content.updateBannerRemote;

  // Versions live in a compact chip instead of the sentence.
  const latest = remote?.version;
  const fromVersion = !webBehind && apiBehind ? (apiVersion ?? APP_VERSION) : APP_VERSION;
  const showVersions = !swReady && Boolean(latest) && latest !== fromVersion;

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
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-[13px] font-medium tracking-tight text-popover-foreground">
              {content.updateBannerTitle}
            </p>
            {showVersions ? (
              <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-1.5 py-px font-mono text-[10.5px] tabular-nums text-muted-foreground">
                {fromVersion}
                <span aria-hidden>→</span>
                <span className="font-medium text-popover-foreground">{latest}</span>
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-pretty text-muted-foreground">
            {description}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {swReady ? (
              <Button type="button" size="xs" onClick={() => applyUpdate()}>
                {content.updateReload}
              </Button>
            ) : remote?.url ? (
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => {
                  window.open(remote.url, "_blank", "noopener,noreferrer");
                }}
              >
                {content.updateViewRelease}
              </Button>
            ) : null}
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
