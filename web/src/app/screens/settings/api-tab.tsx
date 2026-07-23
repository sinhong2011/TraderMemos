import { Check, Copy, ExternalLink, KeyRound } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/Dialog";
import { ModalBanner } from "../../../components/Modal";
import { useToastManager } from "../../../components/Toast";
import { Button } from "../../../components/ui/button";
import { NativeSelect, NativeSelectOption } from "../../../components/ui/native-select";
import { SignalInput } from "../../../components/SignalInput";
import { apiDocsUrl, getBaseUrl } from "../../../lib/api/client";
import type { AccessTokenExpiryDays, CreatedAccessToken } from "../../../lib/api/tokens";
import {
  useAccessTokens,
  useCreateAccessToken,
  useRevokeAccessToken,
} from "../../../lib/hooks/useAccessTokens";
import { useLocale } from "../../../i18n";
import { intlLocale, settingsLabel } from "../../../lib/locale";
import {
  DeleteButton,
  SettingsGroup,
  SettingsPanelBody,
  SettingsRow,
  SettingsSection,
} from "./settings-ui";

type ExpiryChoice = "never" | "30" | "90" | "365";

function formatWhen(iso: string | null | undefined, locale: string): string {
  if (!iso) return "—";
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

export function ApiTab() {
  const { locale } = useLocale();
  const toast = useToastManager();
  const docsUrl = apiDocsUrl(getBaseUrl());
  const tokensQuery = useAccessTokens();
  const createToken = useCreateAccessToken();
  const revokeToken = useRevokeAccessToken();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState<ExpiryChoice>("never");
  const [created, setCreated] = useState<CreatedAccessToken | null>(null);
  const [copied, setCopied] = useState(false);

  const tokens = tokensQuery.data ?? [];
  const displayLocale = intlLocale();

  function resetCreateForm() {
    setName("");
    setExpiry("never");
    setCreated(null);
    setCopied(false);
  }

  function closeCreate() {
    setCreateOpen(false);
    resetCreateForm();
  }

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.add({ title: settingsLabel(locale, "apiTokenNameRequired") });
      return;
    }
    const body =
      expiry === "never"
        ? { name: trimmed }
        : { name: trimmed, expires_in_days: Number(expiry) as AccessTokenExpiryDays };
    try {
      const row = await createToken.mutateAsync(body);
      setCreated(row);
      setCopied(false);
      toast.add({ title: settingsLabel(locale, "apiTokenCreatedToast") });
    } catch (err) {
      toast.add({
        title: settingsLabel(locale, "apiTokenCreateFailed"),
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  async function handleCopy(secret: string) {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      toast.add({ title: settingsLabel(locale, "apiTokenCopied") });
    } catch {
      toast.add({ title: settingsLabel(locale, "apiTokenCopyFailed") });
    }
  }

  async function handleRevoke(id: string) {
    try {
      await revokeToken.mutateAsync(id);
      toast.add({ title: settingsLabel(locale, "apiTokenRevoked") });
    } catch (err) {
      toast.add({
        title: settingsLabel(locale, "apiTokenRevokeFailed"),
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  return (
    <>
      <SettingsSection title={settingsLabel(locale, "apiDocsTitle")}>
        <SettingsPanelBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="m-0 text-[13px] font-medium text-text">
              {settingsLabel(locale, "apiDocsLink")}
            </p>
            <p className="mt-1 m-0 text-[12px] leading-relaxed text-text-muted">
              {settingsLabel(locale, "apiDocsDescription")}
            </p>
          </div>
          <a
            href={docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-control bg-bg-input px-2.5 py-1.5 text-[12px] font-medium text-text-muted no-underline transition-colors duration-150 hover:bg-bg-input-hover hover:text-text sm:self-center"
          >
            {settingsLabel(locale, "apiDocsOpen")}
            <ExternalLink size={13} strokeWidth={1.5} />
          </a>
        </SettingsPanelBody>
      </SettingsSection>

      <SettingsSection
        title={settingsLabel(locale, "apiTokensTitle")}
        description={settingsLabel(locale, "apiTokensDescription")}
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              resetCreateForm();
              setCreateOpen(true);
            }}
          >
            <KeyRound size={13} strokeWidth={1.5} />
            {settingsLabel(locale, "apiTokenCreate")}
          </Button>
        }
      >
        {tokensQuery.isLoading ? (
          <SettingsPanelBody>
            <p className="m-0 text-[12px] text-text-muted">
              {settingsLabel(locale, "apiTokensLoading")}
            </p>
          </SettingsPanelBody>
        ) : tokensQuery.isError ? (
          <SettingsPanelBody>
            <p className="m-0 text-[12px] text-loss">{settingsLabel(locale, "apiTokensError")}</p>
          </SettingsPanelBody>
        ) : tokens.length === 0 ? (
          <SettingsPanelBody className="py-8">
            <div className="flex flex-col items-center gap-2 text-center">
              <KeyRound size={28} strokeWidth={1.5} className="text-text-dim" aria-hidden />
              <p className="m-0 text-[13px] font-medium text-text">
                {settingsLabel(locale, "apiTokensEmpty")}
              </p>
            </div>
          </SettingsPanelBody>
        ) : (
          <SettingsGroup>
            {tokens.map((tok, index) => (
              <SettingsRow
                key={tok.id}
                last={index === tokens.length - 1}
                primary={
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="truncate">{tok.name}</span>
                    <code className="rounded-control border border-border bg-bg-inset px-1.5 py-0.5 text-[11px] font-normal tabular-nums text-text-muted">
                      {tok.token_prefix}…
                    </code>
                  </span>
                }
                secondary={
                  <span className="flex flex-wrap gap-x-4 gap-y-1">
                    <span>
                      <span className="text-text-dim">
                        {settingsLabel(locale, "apiTokenCreated")}
                      </span>{" "}
                      <span className="tabular-nums text-text-muted">
                        {formatWhen(tok.created_at, displayLocale)}
                      </span>
                    </span>
                    <span>
                      <span className="text-text-dim">
                        {settingsLabel(locale, "apiTokenExpires")}
                      </span>{" "}
                      <span className="tabular-nums text-text-muted">
                        {tok.expires_at
                          ? formatWhen(tok.expires_at, displayLocale)
                          : settingsLabel(locale, "apiTokenExpiryNever")}
                      </span>
                    </span>
                    <span>
                      <span className="text-text-dim">
                        {settingsLabel(locale, "apiTokenLastUsed")}
                      </span>{" "}
                      <span className="tabular-nums text-text-muted">
                        {formatWhen(tok.last_used_at, displayLocale)}
                      </span>
                    </span>
                  </span>
                }
                actions={
                  <DeleteButton
                    label={tok.name}
                    detail={settingsLabel(locale, "apiTokenRevokeConfirm")}
                    onDelete={() => {
                      void handleRevoke(tok.id);
                    }}
                  />
                }
              />
            ))}
          </SettingsGroup>
        )}
      </SettingsSection>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!open) closeCreate();
          else setCreateOpen(true);
        }}
      >
        <DialogContent className="max-w-[min(480px,94vw)]" showCloseButton>
          <DialogHeader className="flex-col items-start gap-1.5 pr-12">
            <DialogTitle>
              {created
                ? settingsLabel(locale, "apiTokenRevealTitle")
                : settingsLabel(locale, "apiTokenCreate")}
            </DialogTitle>
            {!created ? (
              <DialogDescription className="text-left leading-relaxed">
                {settingsLabel(locale, "apiTokenCreateHint")}
              </DialogDescription>
            ) : (
              <DialogDescription className="sr-only">
                {settingsLabel(locale, "apiTokenRevealHint")}
              </DialogDescription>
            )}
          </DialogHeader>
          <DialogBody>
            {created ? (
              <div className="flex flex-col gap-4">
                <ModalBanner>{settingsLabel(locale, "apiTokenRevealHint")}</ModalBanner>
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-text-dim">
                    {settingsLabel(locale, "apiTokenSecret")}
                  </span>
                  <div className="rounded-control border border-border bg-bg-inset px-3.5 py-3">
                    <code className="block break-all font-sans text-[12px] leading-relaxed tabular-nums text-text">
                      {created.token}
                    </code>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    aria-label={settingsLabel(locale, "apiTokenCopy")}
                    onClick={() => {
                      void handleCopy(created.token);
                    }}
                  >
                    {copied ? (
                      <Check size={14} strokeWidth={1.5} aria-hidden />
                    ) : (
                      <Copy size={14} strokeWidth={1.5} aria-hidden />
                    )}
                    {copied
                      ? settingsLabel(locale, "apiTokenCopied")
                      : settingsLabel(locale, "apiTokenCopy")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="access-token-name"
                    className="text-[11px] font-medium uppercase tracking-[0.1em] text-text-dim"
                  >
                    {settingsLabel(locale, "apiTokenName")}
                  </label>
                  <SignalInput
                    id="access-token-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={settingsLabel(locale, "apiTokenNameHint")}
                    maxLength={80}
                    autoFocus
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="access-token-expiry"
                    className="text-[11px] font-medium uppercase tracking-[0.1em] text-text-dim"
                  >
                    {settingsLabel(locale, "apiTokenExpiry")}
                  </label>
                  <NativeSelect
                    id="access-token-expiry"
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value as ExpiryChoice)}
                    className="w-full"
                    wrapperClassName="w-full"
                  >
                    <NativeSelectOption value="never">
                      {settingsLabel(locale, "apiTokenExpiryNever")}
                    </NativeSelectOption>
                    <NativeSelectOption value="30">
                      {settingsLabel(locale, "apiTokenExpiry30")}
                    </NativeSelectOption>
                    <NativeSelectOption value="90">
                      {settingsLabel(locale, "apiTokenExpiry90")}
                    </NativeSelectOption>
                    <NativeSelectOption value="365">
                      {settingsLabel(locale, "apiTokenExpiry365")}
                    </NativeSelectOption>
                  </NativeSelect>
                </div>
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            {created ? (
              <Button type="button" onClick={closeCreate}>
                {settingsLabel(locale, "apiTokenDone")}
              </Button>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={closeCreate}>
                  {settingsLabel(locale, "apiTokenCancel")}
                </Button>
                <Button
                  type="button"
                  disabled={createToken.isPending || !name.trim()}
                  onClick={() => {
                    void handleCreate();
                  }}
                >
                  {createToken.isPending
                    ? settingsLabel(locale, "apiTokenCreating")
                    : settingsLabel(locale, "apiTokenGenerate")}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
