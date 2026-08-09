import { Check, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/Dialog";
import { ModalBanner } from "@/components/Modal";
import { useToastManager } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { type ShareLink, shareUrl } from "@/lib/api/share";
import { useCreateShareLink } from "@/lib/hooks/useShareLinks";
import { useLocale } from "@/i18n";
import { settingsLabel } from "@/lib/locale";

export interface ShareLinkDefaults {
  accountId?: string;
  from?: string;
  to?: string;
  tz?: string;
  currency?: string;
}

export interface ShareLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Scope snapshot for the new link (e.g. the Reports filters at share time). */
  defaults?: ShareLinkDefaults;
}

type ExpiryChoice = "90" | "30" | "365" | "never";

/** Create-share-link dialog: options first, then the copyable URL. */
export function ShareLinkDialog({ open, onOpenChange, defaults }: ShareLinkDialogProps) {
  const { locale } = useLocale();
  const toast = useToastManager();
  const createLink = useCreateShareLink();

  const [showAmounts, setShowAmounts] = useState(false);
  const [expiry, setExpiry] = useState<ExpiryChoice>("90");
  const [created, setCreated] = useState<ShareLink | null>(null);
  const [copied, setCopied] = useState(false);

  function close() {
    onOpenChange(false);
    setShowAmounts(false);
    setExpiry("90");
    setCreated(null);
    setCopied(false);
  }

  async function handleCreate() {
    try {
      const row = await createLink.mutateAsync({
        account_id: defaults?.accountId,
        from: defaults?.from,
        to: defaults?.to,
        tz: defaults?.tz,
        currency: showAmounts ? defaults?.currency : undefined,
        show_amounts: showAmounts,
        expires_in_days: expiry === "never" ? 0 : Number(expiry),
      });
      setCreated(row);
      setCopied(false);
    } catch (err) {
      toast.add({
        title: settingsLabel(locale, "sharingCreateFailed"),
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  async function handleCopy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.add({ title: settingsLabel(locale, "sharingCopied") });
    } catch {
      toast.add({ title: settingsLabel(locale, "sharingCopyFailed") });
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
        else onOpenChange(true);
      }}
    >
      <DialogContent className="max-w-[min(480px,94vw)]" showCloseButton>
        <DialogHeader className="flex-col items-start gap-1.5 pr-12">
          <DialogTitle>
            {created
              ? settingsLabel(locale, "sharingLinkReady")
              : settingsLabel(locale, "sharingCreate")}
          </DialogTitle>
          <DialogDescription className="text-left leading-relaxed">
            {created
              ? settingsLabel(locale, "sharingLinkReadyHint")
              : settingsLabel(locale, "sharingCreateHint")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {created ? (
            <div className="flex flex-col gap-4">
              <ModalBanner>{settingsLabel(locale, "sharingRevokeAnytime")}</ModalBanner>
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                  {settingsLabel(locale, "sharingLinkUrl")}
                </span>
                <div className="rounded-md border border-border bg-muted px-3.5 py-3">
                  <code className="block break-all font-sans text-[12px] leading-relaxed tabular-nums text-foreground">
                    {shareUrl(created.token)}
                  </code>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      void handleCopy(shareUrl(created.token));
                    }}
                  >
                    {copied ? (
                      <Check size={14} strokeWidth={1.5} aria-hidden />
                    ) : (
                      <Copy size={14} strokeWidth={1.5} aria-hidden />
                    )}
                    {copied
                      ? settingsLabel(locale, "sharingCopied")
                      : settingsLabel(locale, "sharingCopy")}
                  </Button>
                  <a
                    href={shareUrl(created.token)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-muted px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground no-underline transition-colors duration-150 hover:bg-accent hover:text-foreground"
                  >
                    {settingsLabel(locale, "sharingOpen")}
                    <ExternalLink size={13} strokeWidth={1.5} />
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="m-0 text-[13px] font-medium text-foreground">
                    {settingsLabel(locale, "sharingShowAmounts")}
                  </p>
                  <p className="mt-1 m-0 text-[12px] leading-relaxed text-muted-foreground">
                    {settingsLabel(locale, "sharingShowAmountsHint")}
                  </p>
                </div>
                <Switch
                  aria-label={settingsLabel(locale, "sharingShowAmounts")}
                  checked={showAmounts}
                  onCheckedChange={setShowAmounts}
                  className="mt-0.5 cursor-pointer"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="share-link-expiry"
                  className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground"
                >
                  {settingsLabel(locale, "apiTokenExpiry")}
                </label>
                <NativeSelect
                  id="share-link-expiry"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value as ExpiryChoice)}
                  className="w-full"
                  wrapperClassName="w-full"
                >
                  <NativeSelectOption value="30">
                    {settingsLabel(locale, "apiTokenExpiry30")}
                  </NativeSelectOption>
                  <NativeSelectOption value="90">
                    {settingsLabel(locale, "apiTokenExpiry90")}
                  </NativeSelectOption>
                  <NativeSelectOption value="365">
                    {settingsLabel(locale, "apiTokenExpiry365")}
                  </NativeSelectOption>
                  <NativeSelectOption value="never">
                    {settingsLabel(locale, "apiTokenExpiryNever")}
                  </NativeSelectOption>
                </NativeSelect>
              </div>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          {created ? (
            <Button type="button" onClick={close}>
              {settingsLabel(locale, "apiTokenDone")}
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={close}>
                {settingsLabel(locale, "apiTokenCancel")}
              </Button>
              <Button
                type="button"
                disabled={createLink.isPending}
                onClick={() => {
                  void handleCreate();
                }}
              >
                {createLink.isPending
                  ? settingsLabel(locale, "apiTokenCreating")
                  : settingsLabel(locale, "sharingGenerate")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
