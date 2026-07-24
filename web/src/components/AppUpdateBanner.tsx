import { RefreshCw, X } from "lucide-react";
import { aboutContent } from "../lib/aboutContent";
import { useAppUpdate } from "../lib/appUpdate";
import { useLocale } from "../i18n";
import { APP_VERSION } from "../lib/version";
import { Button } from "./ui/button";

function fillBanner(
  template: string,
  values: { latest: string; current: string; apiVersion: string },
): string {
  return template
    .replace("{latest}", values.latest)
    .replace("{current}", values.current)
    .replace("{apiVersion}", values.apiVersion);
}

/**
 * Fixed banner when a service-worker update is waiting or a newer GitHub
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

  const latest = remote?.version ?? "—";
  const current = APP_VERSION;
  const api = apiVersion ?? "—";
  const vars = { latest, current, apiVersion: api };

  const description = swReady
    ? content.updateBannerSw
    : webBehind && apiBehind
      ? fillBanner(content.updateBannerBothBehind, vars)
      : webBehind
        ? fillBanner(content.updateBannerWebBehind, vars)
        : apiBehind
          ? fillBanner(content.updateBannerApiBehind, vars)
          : fillBanner(content.updateBannerRemote, vars);

  return (
    <div
      role="status"
      className="pointer-events-auto fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-[9998] flex w-[min(100%-2rem,24rem)] -translate-x-1/2 items-start gap-3 rounded-lg border border-border bg-card p-3.5 shadow-[0_12px_32px_rgba(18,18,24,0.55)] md:bottom-[max(1.5rem,env(safe-area-inset-bottom))]"
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <RefreshCw size={15} strokeWidth={1.75} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold tracking-tight text-foreground">
          {content.updateBannerTitle}
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{description}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {swReady ? (
            <Button type="button" size="sm" onClick={() => applyUpdate()}>
              {content.updateReload}
            </Button>
          ) : remote?.url ? (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                window.open(remote.url, "_blank", "noopener,noreferrer");
              }}
            >
              {content.updateViewRelease}
            </Button>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        aria-label={content.updateDismiss}
        onClick={() => dismiss()}
        className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
      >
        <X size={14} strokeWidth={1.5} />
      </button>
    </div>
  );
}
