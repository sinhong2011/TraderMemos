import type { LucideIcon } from "lucide-react";
import { Trash2 } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { Modal } from "../../../components/Modal";
import { Pill } from "../../../components/Pill";
import { SignalInput } from "../../../components/SignalInput";
import { Button } from "../../../components/ui/button";
import { NativeSelect, NativeSelectOption } from "../../../components/ui/native-select";
import { cn } from "../../../lib/cn";
import type { UrlScheme } from "../../../lib/llmApiSettings";
import { settingsSectionHash } from "../../../lib/settingsSection";

export function SettingsPageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <header className="px-6 pb-2 pt-6">
      <h1 className="text-[22px] font-semibold tracking-tight text-text">{title}</h1>
      {description && (
        <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-text-muted">{description}</p>
      )}
    </header>
  );
}

export type SettingsSectionId = "accounts" | "rules" | "journal" | "ai" | "general";

export function SettingsShell({ nav, children }: { nav: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-52px)] flex-col lg:flex-row">
      <aside className="shrink-0 bg-bg px-3 py-3 lg:w-[220px] lg:py-5">{nav}</aside>
      <div className="min-w-0 flex-1 bg-bg">{children}</div>
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
                "flex w-full cursor-pointer items-center gap-2.5 rounded-control px-3 py-2 text-left text-[13px] font-medium no-underline transition-colors duration-150",
                isActive
                  ? "bg-bg-hover text-text"
                  : "bg-transparent text-text-muted hover:bg-bg-hover/70 hover:text-text",
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
    <div className="overflow-hidden rounded-card bg-bg-panel">
      {(title || description || action) && (
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-1">
          <div className="min-w-0">
            {title ? (
              <h2 className="text-[15px] font-semibold tracking-tight text-text">{title}</h2>
            ) : null}
            {description ? (
              <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-text-muted">
                {description}
              </p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
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

/** macOS System Settings–style grouped panel */
export function SettingsGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("divide-y divide-border/40 border-t border-border/40", className)}>
      {children}
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
        "inline-flex items-center rounded-control px-2 py-0.5 text-[10px] font-medium tracking-wide",
        tone === "required" ? "bg-loss/15 text-loss" : "bg-bg-elevated text-text-muted",
      )}
    >
      {children}
    </span>
  );
}

export function SettingsPanelBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("border-t border-border/40 px-5 py-4", className)}>{children}</div>;
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
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:cursor-not-allowed disabled:opacity-45",
        checked ? "bg-accent" : "bg-bg-input",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-0.5 left-0.5 size-5 rounded-full bg-text shadow-sm transition-transform duration-150",
          checked && "translate-x-5",
        )}
      />
    </button>
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
        "flex w-full overflow-hidden rounded-control bg-bg-input transition-colors duration-150",
        "hover:bg-bg-input-hover focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent",
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
          className="h-10 min-w-[5.75rem] border-none pr-6 pl-3 text-[12px] text-text-dim"
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
        className="h-10 min-w-0 flex-1 border-none bg-transparent px-3 text-[13px] text-text outline-none placeholder:text-text-dim"
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
          <div className="text-[13px] font-medium text-text">{label}</div>
          {badge}
        </div>
        {detail ? (
          <p className="mt-1 text-[12px] leading-relaxed text-text-muted">{detail}</p>
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

export function SettingsSection({
  id,
  title,
  description,
  footer,
  action,
  children,
  panelFooter,
}: {
  id?: string;
  title?: string;
  description?: string;
  footer?: string;
  action?: ReactNode;
  children: ReactNode;
  /** Right-aligned actions rendered inside the panel footer bar. */
  panelFooter?: ReactNode;
}) {
  const panelDescription = description ?? footer;

  return (
    <section id={id} className="scroll-mt-4">
      <SettingsPanel
        title={title}
        description={panelDescription}
        action={action}
        footer={panelFooter}
      >
        {children}
      </SettingsPanel>
    </section>
  );
}

export function SettingsInsetForm({ children }: { children: ReactNode }) {
  return <div className="border-t border-border/40 px-5 py-4">{children}</div>;
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
        <div className="text-[13px] font-medium text-text">{primary}</div>
        {secondary ? (
          <p className="mt-1 text-[12px] leading-relaxed text-text-muted">{secondary}</p>
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

function SettingsStat({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="text-[13px] font-semibold tabular-nums tracking-tight text-text">
        {value}
      </span>
      <span className="text-[11px] text-text-dim">{label}</span>
    </span>
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
      className={cn(destructive ? "text-loss hover:text-loss" : undefined, className)}
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
  balance,
  tradeCount,
  cashCount,
  isPrimary,
  actions,
}: {
  name: string;
  broker: string;
  accountType: string;
  currency: string;
  balance: string;
  tradeCount: number;
  cashCount: number;
  isPrimary: boolean;
  actions: ReactNode;
  last?: boolean;
}) {
  const meta = [broker || "—", accountType, currency, cashCount > 0 ? `${cashCount} cash tx` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="grid grid-cols-1 gap-3 px-5 py-4 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] md:items-center md:gap-8">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[13px] font-semibold tracking-tight text-text">{name}</span>
          {isPrimary ? <Pill tone="amber">Primary</Pill> : null}
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-text-muted">{meta}</p>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 md:justify-self-end">
        <div className="flex items-baseline gap-3">
          <SettingsStat label="balance" value={balance} />
          <span aria-hidden className="text-[12px] text-text-dim select-none">
            ·
          </span>
          <SettingsStat
            label={tradeCount === 1 ? "trade" : "trades"}
            value={tradeCount > 0 ? String(tradeCount) : "—"}
          />
        </div>
        <div className="flex flex-wrap items-center gap-1">{actions}</div>
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
    <Button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-9 min-h-9 border-transparent bg-text px-4 text-[12px] font-semibold text-bg hover:bg-text/90 hover:text-bg",
        className,
      )}
    >
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
  return <p className="text-[11px] text-loss">{message}</p>;
}

export function SavedBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="inline-flex items-center gap-1 text-[11px] text-profit">Saved</span>;
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
          <span className="text-right text-[10px] leading-snug text-text-dim">{detail}</span>
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
      className="hover:text-loss"
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
        className="text-loss hover:text-loss"
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
              className="border-transparent bg-loss/15 hover:bg-loss/25"
            >
              Clear trades
            </Button>
          </>
        }
      >
        <p className="m-0 text-[13px] leading-relaxed text-text-muted">
          Removes <span className="font-semibold text-loss tabular-nums">{tradeCount}</span> trade
          {tradeCount === 1 ? "" : "s"} and all executions. Keeps account, cash ledger, setups, and
          tags.
        </p>
        <div>
          <label htmlFor={inputId} className="mb-1.5 block text-[11px] text-text-dim">
            Type <span className="font-medium text-text">{accountName}</span> to confirm
          </label>
          <SignalInput
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
