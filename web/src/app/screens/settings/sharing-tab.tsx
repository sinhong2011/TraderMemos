import { Check, Copy, Link2 } from "lucide-react";
import { useState } from "react";
import { ShareLinkDialog } from "@/components/ShareLinkDialog";
import { useToastManager } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { shareUrl } from "@/lib/api/share";
import { useRevokeShareLink, useShareLinks } from "@/lib/hooks/useShareLinks";
import { useSystemInfo } from "@/lib/hooks/useSystemInfo";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { useLocale } from "@/i18n";
import { intlLocale, settingsLabel } from "@/lib/locale";
import {
  DeleteButton,
  SettingsGroup,
  SettingsPanelBody,
  SettingsRow,
  SettingsSection,
} from "./settings-ui";

function formatWhen(iso: string | null | undefined, locale: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function SharingTab() {
  const { locale } = useLocale();
  const toast = useToastManager();
  const systemInfo = useSystemInfo();
  const enabled = systemInfo.data?.features?.share_links === true;
  const linksQuery = useShareLinks(enabled);
  const revokeLink = useRevokeShareLink();
  const accountsQuery = useAccounts();
  const [createOpen, setCreateOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const links = linksQuery.data ?? [];
  const displayLocale = intlLocale();

  function accountName(id?: string): string {
    if (!id) return settingsLabel(locale, "sharingScopeAll");
    return accountsQuery.data?.find((a) => a.id === id)?.name ?? id;
  }

  async function handleCopy(id: string, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      toast.add({ title: settingsLabel(locale, "sharingCopied") });
    } catch {
      toast.add({ title: settingsLabel(locale, "sharingCopyFailed") });
    }
  }

  async function handleRevoke(id: string) {
    try {
      await revokeLink.mutateAsync(id);
      toast.add({ title: settingsLabel(locale, "sharingRevoked") });
    } catch (err) {
      toast.add({
        title: settingsLabel(locale, "sharingRevokeFailed"),
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  if (systemInfo.isSuccess && !enabled) {
    return (
      <SettingsSection title={settingsLabel(locale, "sharingLinksTitle")}>
        <SettingsPanelBody className="py-8">
          <div className="flex flex-col items-center gap-2 text-center">
            <Link2 size={28} strokeWidth={1.5} className="text-muted-foreground" aria-hidden />
            <p className="m-0 text-[13px] font-medium text-foreground">
              {settingsLabel(locale, "sharingDisabled")}
            </p>
            <p className="m-0 max-w-sm text-[12px] leading-relaxed text-muted-foreground">
              {settingsLabel(locale, "sharingDisabledHint")}
            </p>
          </div>
        </SettingsPanelBody>
      </SettingsSection>
    );
  }

  return (
    <>
      <SettingsSection
        title={settingsLabel(locale, "sharingLinksTitle")}
        description={settingsLabel(locale, "sharingLinksDescription")}
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!enabled}
            onClick={() => setCreateOpen(true)}
          >
            <Link2 size={13} strokeWidth={1.5} />
            {settingsLabel(locale, "sharingCreate")}
          </Button>
        }
      >
        {linksQuery.isLoading || systemInfo.isLoading ? (
          <SettingsPanelBody>
            <p className="m-0 text-[12px] text-muted-foreground">
              {settingsLabel(locale, "sharingLoading")}
            </p>
          </SettingsPanelBody>
        ) : linksQuery.isError ? (
          <SettingsPanelBody>
            <p className="m-0 text-[12px] text-destructive">
              {settingsLabel(locale, "sharingError")}
            </p>
          </SettingsPanelBody>
        ) : links.length === 0 ? (
          <SettingsPanelBody className="py-8">
            <div className="flex flex-col items-center gap-2 text-center">
              <Link2 size={28} strokeWidth={1.5} className="text-muted-foreground" aria-hidden />
              <p className="m-0 text-[13px] font-medium text-foreground">
                {settingsLabel(locale, "sharingEmpty")}
              </p>
            </div>
          </SettingsPanelBody>
        ) : (
          <SettingsGroup>
            {links.map((link, index) => (
              <SettingsRow
                key={link.id}
                last={index === links.length - 1}
                primary={
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="truncate">{accountName(link.scope.account_id)}</span>
                    <code className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[11px] font-normal tabular-nums text-muted-foreground">
                      /s/{link.token.slice(0, 8)}…
                    </code>
                    {link.scope.show_amounts ? null : (
                      <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {settingsLabel(locale, "sharingAmountsHidden")}
                      </span>
                    )}
                  </span>
                }
                secondary={
                  <span className="flex flex-wrap gap-x-4 gap-y-1">
                    <span>
                      <span className="text-muted-foreground">
                        {settingsLabel(locale, "apiTokenCreated")}
                      </span>{" "}
                      <span className="tabular-nums text-muted-foreground">
                        {formatWhen(link.created_at, displayLocale)}
                      </span>
                    </span>
                    <span>
                      <span className="text-muted-foreground">
                        {settingsLabel(locale, "apiTokenExpires")}
                      </span>{" "}
                      <span className="tabular-nums text-muted-foreground">
                        {link.expires_at
                          ? formatWhen(link.expires_at, displayLocale)
                          : settingsLabel(locale, "apiTokenExpiryNever")}
                      </span>
                    </span>
                    <span>
                      <span className="text-muted-foreground">
                        {settingsLabel(locale, "sharingViews")}
                      </span>{" "}
                      <span className="tabular-nums text-muted-foreground">{link.view_count}</span>
                    </span>
                  </span>
                }
                actions={
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={settingsLabel(locale, "sharingCopy")}
                      onClick={() => {
                        void handleCopy(link.id, shareUrl(link.token));
                      }}
                    >
                      {copiedId === link.id ? (
                        <Check size={14} strokeWidth={1.5} aria-hidden />
                      ) : (
                        <Copy size={14} strokeWidth={1.5} aria-hidden />
                      )}
                    </Button>
                    <DeleteButton
                      label={accountName(link.scope.account_id)}
                      detail={settingsLabel(locale, "sharingRevokeConfirm")}
                      onDelete={() => {
                        void handleRevoke(link.id);
                      }}
                    />
                  </>
                }
              />
            ))}
          </SettingsGroup>
        )}
      </SettingsSection>

      <ShareLinkDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
