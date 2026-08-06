import type { LucideIcon } from "lucide-react";
import { Trash2 } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { Modal } from "@/components/Modal";
import { Pill } from "@/components/Pill";
import { FormInput } from "@/components/FormInput";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";
import type { UrlScheme } from "@/lib/llmApiSettings";
import { settingsSectionHash } from "@/lib/settingsSection";

export function SettingsPageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <header className="px-6 pb-2 pt-6">
      <h1 className="text-[22px] font-semibold tracking-tight text-foreground">{title}</h1>
      {description && (
        <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
    </header>
  );
}

export type SettingsSectionId =
  | "profile"
  | "users"
  | "accounts"
  | "rules"
  | "journal"
  | "ai"
  | "general"
  | "shortcuts"
  | "api"
  | "about";

export function SettingsShell({ nav, children }: { nav: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-52px)] flex-col lg:flex-row">
      <aside className="shrink-0 bg-background px-3 py-3 lg:w-[220px] lg:py-5">{nav}</aside>
      <div className="min-w-0 flex-1 bg-background">{children}</div>
    </div>
  );
}

export function SettingsNav({
  active,
  onChange,
  items,
}: {
  active: SettingsSectionId;
  onChange: (id: SettingsSectionId) => void;
  items: { id: SettingsSectionId; label: string; icon: LucideIcon }[];
}) {
  return (
    <ul className="m-0 flex list-none flex-row gap-1 overflow-x-auto p-0 lg:flex-col lg:gap-0.5">
      {items.map(({ id, label, icon: Icon }) => {
        const isActive = active === id;
        return (
          <li key={id} className="shrink-0">
            <a
              href={settingsSectionHash(id)}
              aria-current={isActive ? "page" : undefined}
              onClick={(e) => {
                e.preventDefault();
                onChange(id);
              }}
              className={cn(
                "flex w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] font-medium no-underline transition-colors duration-150",
                isActive
                  ? "bg-accent text-foreground"
                  : "bg-transparent text-muted-foreground hover:bg-accent/70 hover:text-foreground",
              )}
            >
              <Icon size={14} strokeWidth={1.5} aria-hidden />
              {label}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/** Panel card — title/description header, divided rows, optional footer actions */
export function SettingsPanel({
  title,
  description,
  action,
  children,
  footer,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg bg-card">
      {(title || description || action) && (
        <div className="flex flex-col gap-3 px-5 pt-5 pb-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            {title ? (
              <h2 className="text-[15px] font-semibold tracking-tight text-foreground">{title}</h2>
            ) : null}
            {description ? (
              <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          {action ? (
            <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
              {action}
            </div>
          ) : null}
        </div>
      )}
      {children}
      {footer ? (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/50 px-5 py-4">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export function SettingsBadge({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "required";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium tracking-wide",
        tone === "required"
          ? "bg-destructive/15 text-destructive"
          : "bg-sidebar text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

/** Optional content block under a bare section title. */
export function SettingsPanelBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border px-5 py-4", className)}>{children}</div>
  );
}

/** Grouped preference rows in a rounded bordered block. */
export function SettingsGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border divide-y divide-border/40",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SettingsInsetForm({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border px-5 py-4">
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

export function SettingsSection({
  id,
  title,
  description,
  footer,
  action,
  children,
}: {
  id?: string;
  title?: string;
  description?: string;
  footer?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const panelDescription = description ?? footer;

  return (
    <section id={id} className="scroll-mt-4 flex flex-col gap-4">
      {(title || panelDescription || action) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            {title ? (
              <h2 className="m-0 text-[15px] font-semibold tracking-tight text-foreground">
                {title}
              </h2>
            ) : null}
            {panelDescription ? (
              <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-muted-foreground">
                {panelDescription}
              </p>
            ) : null}
          </div>
          {action ? (
            <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
              {action}
            </div>
          ) : null}
        </div>
      )}
      {children}
    </section>
  );
}

export function SettingsToggle({
  checked,
  onCheckedChange,
  disabled,
  id,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
}) {
  return (
    <Switch
      id={id}
      aria-label={ariaLabel}
      disabled={disabled}
      checked={checked}
      onCheckedChange={(next) => onCheckedChange(next)}
      className="cursor-pointer"
    />
  );
}

export function SettingsPrefixedInput({
  scheme,
  onSchemeChange,
  value,
  onChange,
  onBlur,
  placeholder,
  disabled,
  "aria-label": ariaLabel,
  className,
}: {
  scheme: UrlScheme;
  onSchemeChange: (scheme: UrlScheme) => void;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  "aria-label"?: string;
  className?: string;
}) {
  const schemeId = useId();

  return (
    <div
      className={cn(
        "flex w-full overflow-hidden rounded-md bg-muted transition-colors duration-150",
        "hover:bg-accent focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring",
        disabled && "opacity-45",
        className,
      )}
    >
      <label htmlFor={schemeId} className="sr-only">
        URL scheme
      </label>
      <div className="flex shrink-0 items-center border-r border-border/50">
        <NativeSelect
          id={schemeId}
          size="sm"
          variant="ghost"
          value={scheme}
          disabled={disabled}
          onChange={(e) => onSchemeChange(e.target.value as UrlScheme)}
          aria-label="URL scheme"
          className="h-10 min-w-[5.75rem] border-none pr-6 pl-3 text-[12px] text-muted-foreground"
        >
          <NativeSelectOption value="https">https://</NativeSelectOption>
          <NativeSelectOption value="http">http://</NativeSelectOption>
        </NativeSelect>
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
        spellCheck={false}
        className="h-10 min-w-0 flex-1 border-none bg-transparent px-3 text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

/** Single preference row: label left, control right */
export function SettingsGroupRow({
  label,
  detail,
  badge,
  children,
  last = false,
  alignTop = false,
  className,
}: {
  label: ReactNode;
  detail?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  last?: boolean;
  alignTop?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 px-5 py-4 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] md:gap-8",
        alignTop ? "md:items-start" : "md:items-center",
        className,
      )}
      data-last={last ? "" : undefined}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-[13px] font-medium text-foreground">{label}</div>
          {badge}
        </div>
        {detail ? (
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{detail}</p>
        ) : null}
      </div>
      <div
        className={cn(
          "flex min-w-0 w-full justify-end md:max-w-md md:justify-self-end",
          alignTop ? "items-start" : "items-center",
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function SettingsRow({
  primary,
  secondary,
  actions,
}: {
  primary: ReactNode;
  secondary?: ReactNode;
  actions?: ReactNode;
  /** @deprecated Dividers removed for borderless settings. */
  last?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 px-5 py-4 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] md:items-center md:gap-8">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-foreground">{primary}</div>
        {secondary ? (
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{secondary}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 md:justify-self-end">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export function BtnToolbar({
  children,
  disabled,
  type = "button",
  onClick,
  className,
  destructive,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
  className?: string;
  destructive?: boolean;
  "aria-label"?: string;
}) {
  return (
    <Button
      type={type}
      variant="secondary"
      size="sm"
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(destructive ? "text-destructive hover:text-destructive" : undefined, className)}
    >
      {children}
    </Button>
  );
}

export function AccountRow({
  name,
  broker,
  accountType,
  currency,
  depositedLabel,
  equityLabel,
  realizedPnlLabel,
  pnlPctLabel,
  tradeCount,
  netPnl,
  isPrimary,
  headerAction,
  footerActions,
}: {
  name: string;
  broker: string;
  accountType: string;
  currency: string;
  depositedLabel: string;
  equityLabel: string;
  realizedPnlLabel: string;
  pnlPctLabel: string;
  tradeCount: number;
  netPnl: number;
  isPrimary: boolean;
  headerAction?: ReactNode;
  footerActions?: ReactNode;
}) {
  const metaParts = [
    broker || null,
    accountType ? accountType.charAt(0).toUpperCase() + accountType.slice(1) : null,
    currency || null,
  ].filter(Boolean) as string[];

  const pnlTone =
    netPnl > 0 ? "text-profit" : netPnl < 0 ? "text-destructive" : "text-muted-foreground";

  const footerMeta = [
    ...metaParts,
    tradeCount > 0 ? `${tradeCount} ${tradeCount === 1 ? "trade" : "trades"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="rounded-lg border border-border px-4 py-4 transition-colors duration-150 hover:bg-accent/40 motion-reduce:transition-none">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="m-0 text-[15.4px] font-semibold tracking-tight text-foreground">{name}</h3>
          {isPrimary ? <Pill tone="amber">Primary</Pill> : null}
        </div>
        {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
        <div className="min-w-0">
          <p className="m-0 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Deposited
          </p>
          <p className="m-0 mt-1 text-[13px] font-semibold tabular-nums tracking-tight text-foreground">
            {depositedLabel}
          </p>
        </div>
        <div className="min-w-0 sm:col-start-2">
          <p className="m-0 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Equity
          </p>
          <p className="m-0 mt-1 text-[18px] font-semibold tabular-nums tracking-tight text-foreground">
            {equityLabel}
          </p>
        </div>
        <div className="min-w-0 col-span-2 sm:col-span-1 sm:col-start-3">
          <p className="m-0 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Realized P&L
          </p>
          <p
            className={cn(
              "m-0 mt-1 text-[13px] font-semibold tabular-nums tracking-tight",
              pnlTone,
            )}
          >
            {realizedPnlLabel}
            {pnlPctLabel !== "—" ? (
              <span className="ml-1.5 font-normal text-[12px]">({pnlPctLabel})</span>
            ) : null}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 min-w-0 text-[11px] text-muted-foreground">
          {footerMeta || "No broker set"}
        </p>
        {footerActions ? (
          <div className="flex flex-wrap items-center justify-end gap-1.5">{footerActions}</div>
        ) : null}
      </div>
    </div>
  );
}

export function BtnPrimary({
  children,
  disabled,
  type = "button",
  onClick,
  className,
}: {
  children: ReactNode;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
  className?: string;
}) {
  return (
    <Button type={type} disabled={disabled} onClick={onClick} className={className}>
      {children}
    </Button>
  );
}

export function BtnGhost({
  children,
  active,
  disabled,
  type = "button",
  onClick,
  className,
  size = "sm",
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
  className?: string;
  size?: "sm" | "action";
  "aria-label"?: string;
}) {
  return (
    <Button
      type={type}
      variant={active ? "soft" : "outline"}
      size={size === "action" ? "default" : "sm"}
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(size === "action" && "h-9 min-h-9 px-4 text-[12px]", className)}
    >
      {children}
    </Button>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p className="text-[11px] text-destructive">{message}</p>;
}

export function DeleteButton({
  label,
  onDelete,
  detail,
  disabled,
}: {
  label: string;
  onDelete: () => void;
  detail?: string;
  disabled?: boolean;
}) {
  const [confirm, setConfirm] = useState(false);

  if (disabled) {
    return null;
  }

  if (confirm) {
    return (
      <span className="flex max-w-[220px] flex-col items-end gap-1.5">
        {detail ? (
          <span className="text-right text-[10px] leading-snug text-muted-foreground">
            {detail}
          </span>
        ) : null}
        <span className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="destructive"
            size="xs"
            onClick={() => {
              setConfirm(false);
              onDelete();
            }}
          >
            Delete
          </Button>
          <Button type="button" variant="outline" size="xs" onClick={() => setConfirm(false)}>
            Cancel
          </Button>
        </span>
      </span>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={`Delete ${label}`}
      onClick={() => setConfirm(true)}
      className="hover:text-destructive"
    >
      <Trash2 size={14} strokeWidth={1.5} />
    </Button>
  );
}

export function ClearTradesButton({
  accountName,
  tradeCount,
  onClear,
  disabled,
}: {
  accountName: string;
  tradeCount: number;
  onClear: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const inputId = useId();

  if (disabled || tradeCount <= 0) {
    return null;
  }

  const canClear = typed.trim() === accountName.trim();

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setTyped("");
  };

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-destructive hover:text-destructive"
      >
        Clear trades
      </Button>
      <Modal
        open={open}
        onOpenChange={handleOpenChange}
        title={`Clear trades for ${accountName}?`}
        className="max-w-[min(336px,94vw)]"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!canClear}
              onClick={() => {
                handleOpenChange(false);
                onClear();
              }}
              className="border-transparent bg-destructive/15 hover:bg-destructive/25"
            >
              Clear trades
            </Button>
          </>
        }
      >
        <p className="m-0 text-[13px] leading-relaxed text-muted-foreground">
          Removes <span className="font-semibold text-destructive tabular-nums">{tradeCount}</span>{" "}
          trade
          {tradeCount === 1 ? "" : "s"} and all executions. Keeps account, cash ledger, setups, and
          tags.
        </p>
        <div>
          <label htmlFor={inputId} className="mb-1.5 block text-[11px] text-muted-foreground">
            Type <span className="font-medium text-foreground">{accountName}</span> to confirm
          </label>
          <FormInput
            id={inputId}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            aria-label={`Type ${accountName} to confirm`}
          />
        </div>
      </Modal>
    </>
  );
}

export function DeleteAccountButton({
  accountName,
  detail,
  onDelete,
  disabled,
  disabledReason,
}: {
  accountName: string;
  detail?: string;
  onDelete: () => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const inputId = useId();

  const canDelete = typed.trim() === accountName.trim();

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setTyped("");
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        disabled={disabled}
        title={disabled ? disabledReason : "Delete account"}
        aria-label={`Delete ${accountName}`}
        onClick={() => setOpen(true)}
        className="border-border bg-transparent text-destructive hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
      >
        <Trash2 size={14} strokeWidth={1.5} />
      </Button>
      <Modal
        open={open}
        onOpenChange={handleOpenChange}
        title={`Delete ${accountName}?`}
        className="max-w-[min(336px,94vw)]"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!canDelete}
              onClick={() => {
                handleOpenChange(false);
                onDelete();
              }}
              className="border-transparent bg-destructive/15 hover:bg-destructive/25"
            >
              Delete account
            </Button>
          </>
        }
      >
        <p className="m-0 text-[13px] leading-relaxed text-muted-foreground">
          Permanently removes this account and all linked trades, executions, cash transactions, and
          attachments. This cannot be undone.
        </p>
        {detail ? (
          <p className="m-0 text-[12px] leading-snug text-muted-foreground">{detail}</p>
        ) : null}
        <div>
          <label htmlFor={inputId} className="mb-1.5 block text-[11px] text-muted-foreground">
            Type <span className="font-medium text-foreground">{accountName}</span> to confirm
          </label>
          <FormInput
            id={inputId}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            aria-label={`Type ${accountName} to confirm`}
          />
        </div>
      </Modal>
    </>
  );
}
