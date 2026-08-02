import {
  BarChart3,
  Calendar,
  ExternalLink,
  FileSpreadsheet,
  Github,
  House,
  ScrollText,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { AppLogo } from "@/components/AppLogo";
import { Pill } from "@/components/Pill";
import { Skeleton } from "@/components/Skeleton";
import { Button } from "@/components/ui/button";
import {
  aboutContent,
  DEVELOPER_AVATAR,
  DEVELOPER_GITHUB,
  DEVELOPER_NAME,
  REPO_URL,
} from "@/lib/aboutContent";
import { getBaseUrl } from "@/lib/api/client";
import { useAppUpdate } from "@/lib/appUpdate";
import { cn } from "@/lib/cn";
import { fmtDateTime } from "@/lib/format";
import { useApiHealth } from "@/lib/hooks/useApiHealth";
import { formatUptime, useSystemInfo } from "@/lib/hooks/useSystemInfo";
import { APP_BUILD, APP_VERSION, formatVersion } from "@/lib/version";
import { useLocale } from "@/i18n";
import { SettingsGroup, SettingsGroupRow, SettingsSection, SettingsToggle } from "./settings-ui";
import { useDisplayPrefs } from "@/lib/displayPrefs";

const FEATURE_ICONS: LucideIcon[] = [
  House,
  ScrollText,
  Calendar,
  BarChart3,
  FileSpreadsheet,
  Sparkles,
];

/** Borderless elevated block — About-page section surface. */
function AboutCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-xl bg-card", className)}>{children}</div>;
}

/** Compact stat: uppercase label on top, prominent value, optional subline. */
function StatTile({
  label,
  value,
  sub,
  tone = "default",
  loading,
}: {
  label: string;
  value?: ReactNode;
  sub?: ReactNode;
  tone?: "default" | "warn";
  loading?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg bg-sidebar/60 px-4 py-3.5">
      <p className="m-0 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      {loading ? (
        <Skeleton height="20px" width="4.5rem" className="mt-1.5" />
      ) : (
        <p
          className={cn(
            "m-0 mt-1 truncate text-[17px] font-semibold tabular-nums tracking-tight",
            tone === "warn" ? "text-chart-3" : "text-foreground",
          )}
        >
          {value}
        </p>
      )}
      {sub ? <p className="m-0 mt-0.5 truncate text-[11px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function AboutFeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3 rounded-lg bg-sidebar/60 px-4 py-3.5 transition-colors duration-150 hover:bg-sidebar motion-reduce:transition-none">
      <div
        className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-accent/10 text-primary"
        aria-hidden
      >
        <Icon size={15} strokeWidth={1.5} />
      </div>
      <div className="min-w-0">
        <h3 className="text-[13px] font-semibold tracking-tight text-foreground">{title}</h3>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function AboutLinkRow({
  label,
  href,
  description,
}: {
  label: string;
  href: string;
  description: string;
}) {
  const isGithub = href.includes("github.com");
  const TrailIcon = isGithub ? Github : ExternalLink;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start justify-between gap-4 rounded-lg px-4 py-3.5 no-underline transition-colors duration-150 hover:bg-accent/50 motion-reduce:transition-none"
    >
      <div className="flex min-w-0 items-start gap-3">
        {isGithub ? (
          <span
            className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-sidebar text-muted-foreground group-hover:text-foreground"
            aria-hidden
          >
            <Github size={14} strokeWidth={1.5} />
          </span>
        ) : null}
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-foreground group-hover:text-primary">
            {label}
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      <TrailIcon
        size={14}
        strokeWidth={1.5}
        className="mt-0.5 shrink-0 text-muted-foreground group-hover:text-primary"
        aria-hidden
      />
    </a>
  );
}

function ApiHealthStatus({
  loading,
  ok,
  okLabel,
  errorLabel,
  checkingLabel,
}: {
  loading: boolean;
  ok: boolean;
  okLabel: string;
  errorLabel: string;
  checkingLabel: string;
}) {
  if (loading) {
    return <span className="text-[12px] text-muted-foreground">{checkingLabel}</span>;
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[12px] font-medium",
        ok ? "text-profit" : "text-destructive",
      )}
    >
      <span className={cn("size-1.5 rounded-full", ok ? "bg-profit" : "bg-loss")} aria-hidden />
      {ok ? okLabel : errorLabel}
    </span>
  );
}

export function AboutTab() {
  const { locale } = useLocale();
  const content = aboutContent(locale);
  const updateNotices = useDisplayPrefs((s) => s.updateNotices);
  const setUpdateNotices = useDisplayPrefs((s) => s.setUpdateNotices);
  const apiBase = getBaseUrl();
  const health = useApiHealth();
  const healthOk = health.isSuccess && health.data?.status === "ok";
  const systemInfo = useSystemInfo();
  const swReady = useAppUpdate((s) => s.swReady);
  const remoteNewer = useAppUpdate((s) => s.remoteNewer);
  const webBehind = useAppUpdate((s) => s.webBehind);
  const apiBehind = useAppUpdate((s) => s.apiBehind);
  const versionMismatch = useAppUpdate((s) => s.versionMismatch);
  const storeApiVersion = useAppUpdate((s) => s.apiVersion);
  const remote = useAppUpdate((s) => s.remote);
  const checking = useAppUpdate((s) => s.checking);
  const checkError = useAppUpdate((s) => s.checkError);
  const lastCheckedAt = useAppUpdate((s) => s.lastCheckedAt);
  const checkForUpdates = useAppUpdate((s) => s.checkForUpdates);
  const applyUpdate = useAppUpdate((s) => s.applyUpdate);

  const attention = swReady || webBehind || apiBehind || versionMismatch;

  const updateStatus = swReady
    ? content.updateStatusSwReady
    : webBehind && apiBehind
      ? content.updateBothBehind
      : webBehind
        ? content.updateWebBehind
        : apiBehind
          ? content.updateApiBehind
          : versionMismatch
            ? content.updateMismatch
            : remoteNewer
              ? content.updateStatusAvailable
              : content.updateStatusCurrent;

  const apiVersionValue =
    storeApiVersion ?? (healthOk && health.data?.version ? health.data.version : null);
  const apiCommit = health.data?.commit?.slice(0, 7);

  const lastCheckedLabel = lastCheckedAt
    ? fmtDateTime(new Date(lastCheckedAt).toISOString())
    : content.updateNeverChecked;

  const enabledFeatures = systemInfo.data?.features
    ? Object.entries(systemInfo.data.features).filter(([, enabled]) => enabled)
    : [];

  return (
    <>
      {/* Hero */}
      <AboutCard className="relative overflow-hidden px-6 py-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-28 -right-16 size-72 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start">
          <AppLogo
            size={64}
            className="shrink-0 shadow-[0_0_32px_color-mix(in oklch, var(--primary) 35%, transparent)]"
            title="TraderMemos"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h2 className="m-0 text-[26px] font-bold tracking-[-0.03em] text-foreground">
                TraderMemos
              </h2>
              <Pill tone="muted">{formatVersion(APP_VERSION, APP_BUILD || undefined)}</Pill>
            </div>
            <p className="m-0 mt-0.5 text-[13px] text-muted-foreground">{content.tagline}</p>
            <p className="m-0 mt-3 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
              {content.intro}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub repository"
                className="inline-flex items-center gap-1.5 rounded-md bg-sidebar px-3 py-2 text-[12px] font-medium text-foreground no-underline transition-colors duration-150 hover:bg-accent hover:text-primary"
              >
                <Github size={14} strokeWidth={1.5} aria-hidden />
                GitHub
              </a>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={checking}
                onClick={() => void checkForUpdates()}
              >
                {checking ? content.updateChecking : content.updateCheck}
              </Button>
            </div>
          </div>
        </div>
      </AboutCard>

      {/* Versions & updates */}
      <SettingsSection title={content.updatesTitle} description={content.updatesDescription}>
        <SettingsGroup>
          <SettingsGroupRow label={content.updateNoticesLabel} detail={content.updateNoticesDetail}>
            <SettingsToggle
              checked={updateNotices}
              onCheckedChange={setUpdateNotices}
              aria-label={content.updateNoticesLabel}
            />
          </SettingsGroupRow>
        </SettingsGroup>
        <AboutCard className="mt-3 px-5 py-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatTile
              label={content.apiWebVersionLabel}
              value={formatVersion(APP_VERSION)}
              sub={APP_BUILD || undefined}
            />
            <StatTile
              label={content.apiVersionLabel}
              loading={health.isPending && !apiVersionValue}
              tone={versionMismatch ? "warn" : "default"}
              value={
                apiVersionValue ? (
                  formatVersion(apiVersionValue)
                ) : (
                  <span className="text-[12px] font-normal text-muted-foreground">
                    {content.updateApiUnreachable}
                  </span>
                )
              }
              sub={apiCommit}
            />
            <StatTile
              label={content.updateLatestLabel}
              loading={checking && !remote}
              value={
                remote ? (
                  formatVersion(remote.version)
                ) : (
                  <span className="text-[12px] font-normal text-muted-foreground">
                    {content.updateNeverChecked}
                  </span>
                )
              }
              sub={
                remote?.publishedAt ? (
                  <>
                    {content.updateReleasePublished} {fmtDateTime(remote.publishedAt)}
                    {remote.prerelease ? (
                      <span className="ml-1.5 text-[10px] uppercase tracking-wide text-chart-3">
                        pre
                      </span>
                    ) : null}
                  </>
                ) : undefined
              }
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-[12px] font-medium",
                attention ? "text-chart-3" : "text-profit",
              )}
            >
              <span
                className={cn("size-1.5 rounded-full", attention ? "bg-chart-3" : "bg-profit")}
                aria-hidden
              />
              {updateStatus}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {lastCheckedAt
                ? `${content.updateLastChecked} · ${lastCheckedLabel}`
                : lastCheckedLabel}
            </span>
          </div>

          {remote?.excerpt ? (
            <div className="mt-4 space-y-2 rounded-lg bg-sidebar/60 px-4 py-3.5">
              <h3 className="m-0 text-[12px] font-semibold tracking-tight text-foreground">
                {content.updateReleaseTitle}
              </h3>
              <p className="m-0 text-[12px] leading-relaxed text-muted-foreground">
                {remote.excerpt}
              </p>
            </div>
          ) : null}

          {swReady || ((webBehind || apiBehind) && remote?.url) || checkError ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {swReady ? (
                <Button type="button" size="sm" onClick={() => applyUpdate()}>
                  {content.updateReload}
                </Button>
              ) : null}
              {(webBehind || apiBehind) && remote?.url ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(remote.url, "_blank", "noopener,noreferrer")}
                >
                  {content.updateViewRelease}
                  <ExternalLink size={13} strokeWidth={1.5} aria-hidden />
                </Button>
              ) : null}
              {checkError ? (
                <p className="m-0 w-full text-[11px] text-destructive">{checkError}</p>
              ) : null}
            </div>
          ) : null}
        </AboutCard>
      </SettingsSection>

      {/* Backend API */}
      <SettingsSection title={content.apiTitle} description={content.apiDescription}>
        <AboutCard className="px-5 py-5">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <ApiHealthStatus
              loading={health.isPending}
              ok={healthOk}
              okLabel={content.apiStatusOk}
              errorLabel={content.apiStatusError}
              checkingLabel={content.apiStatusChecking}
            />
            <code className="min-w-0 break-all text-[12px] text-muted-foreground">{apiBase}</code>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              label={content.apiUptimeLabel}
              loading={systemInfo.isPending}
              value={
                systemInfo.data ? (
                  formatUptime(systemInfo.data.uptime_sec)
                ) : (
                  <span className="text-[12px] font-normal text-muted-foreground">
                    {content.updateApiUnreachable}
                  </span>
                )
              }
            />
            {systemInfo.data?.db_driver ? (
              <StatTile label={content.apiDbLabel} value={systemInfo.data.db_driver} />
            ) : null}
            {healthOk && health.data?.go ? (
              <StatTile label={content.apiGoLabel} value={health.data.go} />
            ) : null}
            {systemInfo.data?.build_time ? (
              <StatTile
                label={content.apiBuildTimeLabel}
                value={
                  <span className="text-[13px]">{fmtDateTime(systemInfo.data.build_time)}</span>
                }
              />
            ) : null}
          </div>

          {enabledFeatures.length > 0 ? (
            <div className="mt-4">
              <p className="m-0 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {content.apiFeaturesLabel}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {enabledFeatures.map(([key]) => (
                  <Pill key={key} tone="muted">
                    {content.featureNames[key] ?? key}
                  </Pill>
                ))}
              </div>
            </div>
          ) : null}
        </AboutCard>
      </SettingsSection>

      {/* Features */}
      <SettingsSection title={content.featuresTitle}>
        <AboutCard className="px-5 py-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {content.features.map((feature, index) => (
              <AboutFeatureCard
                key={feature.title}
                icon={FEATURE_ICONS[index] ?? Sparkles}
                title={feature.title}
                description={feature.description}
              />
            ))}
          </div>
        </AboutCard>
      </SettingsSection>

      {/* Stack */}
      <SettingsSection title={content.stackTitle}>
        <AboutCard className="px-5 py-4">
          <div className="flex flex-wrap gap-2">
            {content.stack.map((item) => (
              <span
                key={item}
                className="rounded-md bg-sidebar px-3 py-1.5 text-[12px] font-medium text-muted-foreground"
              >
                {item}
              </span>
            ))}
          </div>
        </AboutCard>
      </SettingsSection>

      {/* Philosophy */}
      <SettingsSection title={content.philosophyTitle}>
        <AboutCard className="px-5 py-4">
          <p className="m-0 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            {content.philosophy}
          </p>
          <p className="m-0 mt-3 text-[12px] text-muted-foreground">{content.licenseNote}</p>
        </AboutCard>
      </SettingsSection>

      {/* Developer */}
      <SettingsSection title={content.developerTitle}>
        <AboutCard className="px-5 py-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <img
                src={DEVELOPER_AVATAR}
                alt=""
                width={44}
                height={44}
                className="size-11 rounded-full bg-sidebar ring-1 ring-border/50"
              />
              <div>
                <div className="text-[14px] font-semibold tracking-tight text-foreground">
                  {DEVELOPER_NAME}
                </div>
                <p className="m-0 mt-0.5 text-[12px] text-muted-foreground">
                  {content.developerRole}
                </p>
              </div>
            </div>
            <a
              href={DEVELOPER_GITHUB}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-sidebar px-3 py-2 text-[12px] font-medium text-foreground no-underline transition-colors duration-150 hover:bg-accent hover:text-primary"
            >
              <Github size={14} strokeWidth={1.5} aria-hidden />
              {content.developerGithubLabel}
            </a>
          </div>
        </AboutCard>
      </SettingsSection>

      {/* Links */}
      <SettingsSection title={content.linksTitle}>
        <AboutCard className="p-2">
          {content.links.map((link) => (
            <AboutLinkRow
              key={link.href}
              label={link.label}
              href={link.href}
              description={link.description}
            />
          ))}
        </AboutCard>
      </SettingsSection>
    </>
  );
}
