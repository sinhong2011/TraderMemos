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
import { APP_BUILD, APP_VERSION, formatVersion } from "@/lib/version";
import { useLocale } from "@/i18n";
import { SettingsGroup, SettingsGroupRow, SettingsPanelBody, SettingsSection } from "./settings-ui";

const FEATURE_ICONS: LucideIcon[] = [
  House,
  ScrollText,
  Calendar,
  BarChart3,
  FileSpreadsheet,
  Sparkles,
];

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
    <div className="flex gap-3 rounded-md bg-sidebar/60 px-4 py-3.5">
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
  last,
}: {
  label: string;
  href: string;
  description: string;
  last?: boolean;
}) {
  const isGithub = href.includes("github.com");
  const TrailIcon = isGithub ? Github : ExternalLink;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group flex items-start justify-between gap-4 px-5 py-4 no-underline transition-colors duration-150 hover:bg-accent/50",
        !last && "border-b border-border/40",
      )}
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

function AboutInfoValue({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-right text-[13px] font-medium tabular-nums tracking-tight text-foreground">
      {children}
    </span>
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
  const apiBase = getBaseUrl();
  const health = useApiHealth();
  const healthOk = health.isSuccess && health.data?.status === "ok";
  const swReady = useAppUpdate((s) => s.swReady);
  const remoteNewer = useAppUpdate((s) => s.remoteNewer);
  const webBehind = useAppUpdate((s) => s.webBehind);
  const apiBehind = useAppUpdate((s) => s.apiBehind);
  const storeApiVersion = useAppUpdate((s) => s.apiVersion);
  const remote = useAppUpdate((s) => s.remote);
  const checking = useAppUpdate((s) => s.checking);
  const checkError = useAppUpdate((s) => s.checkError);
  const lastCheckedAt = useAppUpdate((s) => s.lastCheckedAt);
  const checkForUpdates = useAppUpdate((s) => s.checkForUpdates);
  const applyUpdate = useAppUpdate((s) => s.applyUpdate);

  const updateStatus = swReady
    ? content.updateStatusSwReady
    : webBehind && apiBehind
      ? content.updateBothBehind
      : webBehind
        ? content.updateWebBehind
        : apiBehind
          ? content.updateApiBehind
          : remoteNewer
            ? content.updateStatusAvailable
            : content.updateStatusCurrent;

  const releasePublished = remote?.publishedAt ? fmtDateTime(remote.publishedAt) : null;

  const apiVersionLabel =
    storeApiVersion ?? (healthOk && health.data?.version ? health.data.version : null);

  const lastCheckedLabel = lastCheckedAt
    ? fmtDateTime(new Date(lastCheckedAt).toISOString())
    : content.updateNeverChecked;

  return (
    <>
      <SettingsSection title="TraderMemos" description={content.tagline}>
        <SettingsPanelBody className="space-y-5">
          <div className="flex items-start gap-4">
            <AppLogo
              size={52}
              className="shadow-[0_0_24px_color-mix(in oklch, var(--primary) 35%, transparent)]"
              title="TraderMemos"
            />
            <div className="min-w-0 pt-0.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-[28px] font-bold tracking-[-0.03em] text-foreground">
                  TraderMemos
                </span>
                <Pill tone="muted">{formatVersion(APP_VERSION, APP_BUILD || undefined)}</Pill>
                <a
                  href={REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="GitHub repository"
                  className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground no-underline transition-colors duration-150 hover:bg-accent hover:text-foreground"
                >
                  <Github size={18} strokeWidth={1.5} />
                </a>
              </div>
            </div>
          </div>
          <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            {content.intro}
          </p>
        </SettingsPanelBody>
      </SettingsSection>

      <SettingsSection title={content.updatesTitle} description={content.updatesDescription}>
        <SettingsGroup>
          <SettingsGroupRow label={content.updateCurrentLabel}>
            <AboutInfoValue>{formatVersion(APP_VERSION, APP_BUILD || undefined)}</AboutInfoValue>
          </SettingsGroupRow>
          <SettingsGroupRow label={content.updateApiVersionLabel}>
            {checking && !apiVersionLabel ? (
              <Skeleton height="18px" width="4rem" />
            ) : apiVersionLabel ? (
              <AboutInfoValue>
                {formatVersion(apiVersionLabel, health.data?.commit?.slice(0, 7) || undefined)}
              </AboutInfoValue>
            ) : (
              <span className="text-[12px] text-muted-foreground">
                {content.updateApiUnreachable}
              </span>
            )}
          </SettingsGroupRow>
          <SettingsGroupRow label={content.updateLatestLabel}>
            {checking && !remote ? (
              <Skeleton height="18px" width="4rem" />
            ) : remote ? (
              <div className="text-right">
                <AboutInfoValue>{formatVersion(remote.version)}</AboutInfoValue>
                {remote.name !== remote.tag ? (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{remote.name}</p>
                ) : null}
              </div>
            ) : (
              <span className="text-[12px] text-muted-foreground">—</span>
            )}
          </SettingsGroupRow>
          {remote?.publishedAt ? (
            <SettingsGroupRow label={content.updateReleasePublished}>
              <span className="text-right text-[12px] text-muted-foreground">
                {releasePublished}
                {remote.prerelease ? (
                  <span className="ml-2 text-[11px] uppercase tracking-wide text-chart-3">pre</span>
                ) : null}
              </span>
            </SettingsGroupRow>
          ) : null}
          <SettingsGroupRow label={content.updateStatusLabel}>
            <span
              className={cn(
                "text-[12px] font-medium",
                swReady || webBehind || apiBehind ? "text-chart-3" : "text-profit",
              )}
            >
              {updateStatus}
            </span>
          </SettingsGroupRow>
          <SettingsGroupRow label={content.updateLastChecked}>
            <span className="text-right text-[12px] text-muted-foreground">{lastCheckedLabel}</span>
          </SettingsGroupRow>
          {remote?.excerpt ? (
            <div className="space-y-2 px-5 py-4">
              <h3 className="text-[12px] font-semibold tracking-tight text-foreground">
                {content.updateReleaseTitle}
              </h3>
              <p className="text-[12px] leading-relaxed text-muted-foreground">{remote.excerpt}</p>
              {remote.url ? (
                <a
                  href={remote.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium text-primary no-underline hover:underline"
                >
                  {content.updateViewRelease}
                  <ExternalLink size={12} strokeWidth={1.5} aria-hidden />
                </a>
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 px-5 py-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={checking}
              onClick={() => void checkForUpdates()}
            >
              {checking ? content.updateChecking : content.updateCheck}
            </Button>
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
              <p className="w-full text-[11px] text-destructive">{checkError}</p>
            ) : null}
          </div>
        </SettingsGroup>
      </SettingsSection>

      <SettingsSection title={content.developerTitle}>
        <SettingsPanelBody>
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
                <p className="mt-0.5 text-[12px] text-muted-foreground">{content.developerRole}</p>
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
        </SettingsPanelBody>
      </SettingsSection>

      <SettingsSection title={content.apiTitle} description={content.apiDescription}>
        <SettingsGroup>
          <SettingsGroupRow label={content.apiBaseUrlLabel} alignTop>
            <AboutInfoValue>
              <code className="break-all text-[12px] font-normal text-muted-foreground">
                {apiBase}
              </code>
            </AboutInfoValue>
          </SettingsGroupRow>
          <SettingsGroupRow label={content.apiHealthLabel}>
            <ApiHealthStatus
              loading={health.isPending}
              ok={healthOk}
              okLabel={content.apiStatusOk}
              errorLabel={content.apiStatusError}
              checkingLabel={content.apiStatusChecking}
            />
          </SettingsGroupRow>
          <SettingsGroupRow label={content.apiWebVersionLabel}>
            <AboutInfoValue>{formatVersion(APP_VERSION, APP_BUILD || undefined)}</AboutInfoValue>
          </SettingsGroupRow>
          <SettingsGroupRow label={content.apiVersionLabel}>
            {health.isPending ? (
              <Skeleton height="18px" width="4rem" />
            ) : healthOk && health.data?.version ? (
              <AboutInfoValue>
                {formatVersion(health.data.version, health.data.commit?.slice(0, 7) || undefined)}
              </AboutInfoValue>
            ) : (
              <span className="text-[12px] text-muted-foreground">—</span>
            )}
          </SettingsGroupRow>
          <SettingsGroupRow label={content.apiGoLabel} last>
            {health.isPending ? (
              <Skeleton height="18px" width="6rem" />
            ) : healthOk && health.data?.go ? (
              <AboutInfoValue>{health.data.go}</AboutInfoValue>
            ) : (
              <span className="text-[12px] text-muted-foreground">—</span>
            )}
          </SettingsGroupRow>
        </SettingsGroup>
      </SettingsSection>

      <SettingsSection title={content.featuresTitle}>
        <SettingsPanelBody>
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
        </SettingsPanelBody>
      </SettingsSection>

      <SettingsSection title={content.stackTitle}>
        <SettingsPanelBody>
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
        </SettingsPanelBody>
      </SettingsSection>

      <SettingsSection title={content.philosophyTitle}>
        <SettingsPanelBody>
          <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            {content.philosophy}
          </p>
          <p className="mt-3 text-[12px] text-muted-foreground">{content.licenseNote}</p>
        </SettingsPanelBody>
      </SettingsSection>

      <SettingsSection title={content.linksTitle}>
        <SettingsGroup>
          {content.links.map((link, index) => (
            <AboutLinkRow
              key={link.href}
              label={link.label}
              href={link.href}
              description={link.description}
              last={index === content.links.length - 1}
            />
          ))}
        </SettingsGroup>
      </SettingsSection>
    </>
  );
}
