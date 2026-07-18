import type { LucideIcon } from "lucide-react";
import { Trash2 } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { Modal } from "../../../components/Modal";
import { Pill } from "../../../components/Pill";
import { SignalInput } from "../../../components/SignalInput";
import { cn } from "../../../lib/cn";
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

export type SettingsSectionId = "accounts" | "rules" | "journal" | "general";

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

/** macOS System Settings–style grouped panel */
export function SettingsGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-card bg-bg-panel", className)}>{children}</div>
  );
}

/** Single preference row: label left, control right */
export function SettingsGroupRow({
  label,
  detail,
  children,
  last = false,
  className,
}: {
  label: ReactNode;
  detail?: ReactNode;
  children: ReactNode;
  last?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[44px] flex-col gap-2 px-4 py-2.5 transition-colors duration-150 hover:bg-bg-hover/60 sm:flex-row sm:items-center sm:justify-between sm:gap-4",
        className,
      )}
      data-last={last ? "" : undefined}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-text">{label}</div>
        {detail ? (
          <div className="mt-0.5 text-[11px] leading-relaxed text-text-dim">{detail}</div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center sm:justify-end">{children}</div>
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
  const footnote = footer ?? description;

  return (
    <section id={id} className="scroll-mt-4">
      {(title || action) && (
        <div className="mb-2 flex items-center justify-between gap-3 px-1">
          {title ? (
            <h2 className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
              {title}
            </h2>
          ) : null}
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      )}
      {children}
      {footnote ? (
        <p className="mt-2 px-1 text-[11px] leading-relaxed text-text-dim">{footnote}</p>
      ) : null}
    </section>
  );
}

export function SettingsInsetForm({ children }: { children: ReactNode }) {
  return <div className="mb-4 overflow-hidden rounded-card bg-bg-panel p-4">{children}</div>;
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
    <div className="flex min-h-[44px] flex-col gap-2 px-4 py-2.5 transition-colors duration-150 hover:bg-bg-hover sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-text">{primary}</div>
        {secondary ? (
          <div className="mt-0.5 text-[11px] leading-relaxed text-text-dim">{secondary}</div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
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
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex h-7 cursor-pointer items-center rounded-control border-none bg-bg-input px-2.5 text-[12px] font-medium transition-colors duration-150",
        "hover:bg-bg-input-hover disabled:cursor-not-allowed disabled:opacity-45",
        destructive ? "text-loss" : "text-text-muted hover:text-text",
        className,
      )}
    >
      {children}
    </button>
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
    <div className="flex flex-col gap-2.5 px-4 py-3 transition-colors duration-150 hover:bg-bg-hover sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[13px] font-semibold tracking-tight text-text">{name}</span>
          {isPrimary ? <Pill tone="amber">Primary</Pill> : null}
        </div>
        <p className="mt-0.5 text-[11px] leading-relaxed text-text-dim">{meta}</p>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:justify-end">
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
}: {
  children: ReactNode;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-control border-none bg-accent-bg px-3 text-[12px] font-medium text-accent transition-colors duration-150 hover:bg-accent-bg/80 hover:text-text disabled:cursor-not-allowed disabled:opacity-45"
    >
      {children}
    </button>
  );
}

export function BtnGhost({
  children,
  active,
  disabled,
  type = "button",
  onClick,
  className,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 rounded-control border border-border bg-transparent px-2.5 py-1.5 text-[12px] font-medium text-text-muted transition-colors duration-150 hover:bg-bg-hover hover:text-text disabled:cursor-not-allowed disabled:opacity-45",
        active && "border-accent/30 bg-accent-bg text-accent",
        className,
      )}
    >
      {children}
    </button>
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
          <button
            type="button"
            onClick={() => {
              setConfirm(false);
              onDelete();
            }}
            className="cursor-pointer rounded-control border border-loss/40 bg-transparent px-2 py-1 text-[11px] font-medium text-loss hover:bg-loss/10"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => setConfirm(false)}
            className="cursor-pointer rounded-control border border-border bg-transparent px-2 py-1 text-[11px] text-text-muted hover:text-text"
          >
            Cancel
          </button>
        </span>
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-label={`Delete ${label}`}
      onClick={() => setConfirm(true)}
      className="cursor-pointer rounded-control border-none bg-transparent p-1 text-text-muted transition-colors duration-150 hover:text-loss"
    >
      <Trash2 size={14} strokeWidth={1.5} />
    </button>
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-7 cursor-pointer items-center rounded-control border-none bg-bg-input px-2.5 text-[12px] font-medium text-loss transition-colors hover:bg-bg-input-hover"
      >
        Clear trades
      </button>
      <Modal
        open={open}
        onOpenChange={handleOpenChange}
        title={`Clear trades for ${accountName}?`}
        className="max-w-[min(336px,94vw)]"
        footer={
          <>
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="cursor-pointer rounded-control border-none bg-transparent px-3 py-1.5 text-[12px] font-medium text-text-muted transition-colors hover:bg-bg-hover hover:text-text"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canClear}
              onClick={() => {
                handleOpenChange(false);
                onClear();
              }}
              className="cursor-pointer rounded-control border-none bg-loss/15 px-3 py-1.5 text-[12px] font-semibold text-loss transition-colors hover:bg-loss/25 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Clear trades
            </button>
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
