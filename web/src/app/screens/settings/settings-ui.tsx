import type { LucideIcon } from "lucide-react";
import { Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
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
        "flex min-h-[44px] flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4",
        !last && "border-b border-border",
        className,
      )}
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
  last = false,
}: {
  primary: ReactNode;
  secondary?: ReactNode;
  actions?: ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[44px] flex-col gap-2 px-4 py-2.5 transition-colors duration-150 hover:bg-bg-hover sm:flex-row sm:items-center sm:justify-between sm:gap-4",
        !last && "border-b border-border",
      )}
    >
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
    <div className="flex flex-col items-end gap-0.5">
      <span className="text-[13px] font-medium tabular-nums tracking-tight text-text">{value}</span>
      <span className="text-[10px] text-text-dim">{label}</span>
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
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex h-7 cursor-pointer items-center rounded-control px-2 text-[12px] font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45",
        destructive
          ? "text-loss/90 hover:bg-loss/10 hover:text-loss"
          : "text-accent hover:bg-accent-bg/60",
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
  last = false,
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
    <div
      className={cn(
        "flex flex-col gap-3 px-4 py-3 transition-colors duration-150 hover:bg-bg-hover lg:flex-row lg:items-center lg:justify-between lg:gap-6",
        !last && "border-b border-border",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[13px] font-medium text-text">{name}</span>
          {isPrimary ? <span className="text-[11px] text-text-muted">Primary</span> : null}
        </div>
        <p className="mt-0.5 text-[11px] leading-relaxed text-text-dim">{meta}</p>
      </div>

      <div className="flex flex-wrap items-center gap-4 lg:justify-end">
        <SettingsStat label="Balance" value={balance} />
        <SettingsStat
          label={tradeCount === 1 ? "Trade" : "Trades"}
          value={tradeCount > 0 ? String(tradeCount) : "—"}
        />
        <div className="flex flex-wrap items-center gap-0.5">{actions}</div>
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
  const [confirm, setConfirm] = useState(false);
  const [typed, setTyped] = useState("");

  if (disabled || tradeCount <= 0) {
    return null;
  }

  const detail = `Removes ${tradeCount} trade${tradeCount === 1 ? "" : "s"} and all executions. Keeps account, cash ledger, setups, and tags.`;
  const canClear = typed.trim() === accountName.trim();

  if (confirm) {
    return (
      <div className="flex w-full max-w-[280px] flex-col items-end gap-2 rounded-control border border-loss/25 bg-bg-inset p-2.5">
        <p className="m-0 text-right text-[10px] leading-snug text-text-dim">{detail}</p>
        <label className="w-full">
          <span className="mb-1 block text-[10px] text-text-dim">
            Type <span className="text-text">{accountName}</span> to confirm
          </span>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className="h-8 w-full rounded-control border border-border bg-bg px-2 text-[12px] text-text outline-none focus-visible:border-accent"
            autoFocus
          />
        </label>
        <span className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={!canClear}
            onClick={() => {
              setConfirm(false);
              setTyped("");
              onClear();
            }}
            className="cursor-pointer rounded-control border border-loss/40 bg-transparent px-2 py-1 text-[11px] font-medium text-loss hover:bg-loss/10 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Clear trades
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirm(false);
              setTyped("");
            }}
            className="cursor-pointer rounded-control border border-border bg-transparent px-2 py-1 text-[11px] text-text-muted hover:text-text"
          >
            Cancel
          </button>
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirm(true)}
      className="inline-flex h-7 cursor-pointer items-center rounded-control px-2 text-[12px] font-medium text-loss/90 transition-colors hover:bg-loss/10 hover:text-loss"
    >
      Clear trades
    </button>
  );
}
