import { CircleUser, LogOut } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { useFilters } from "@/lib/filters";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { RailTooltip } from "./RailTooltip";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "./ui/menu";

/** Radio value for the unfiltered “all accounts” row (filter state uses `undefined`). */
const ALL_VALUE = "__all__";

/** Menu row: account name, then its ledger currency (or the account count) as a quiet hint. */
function AccountMenuItem({ value, label, hint }: { value: string; label: string; hint?: string }) {
  return (
    <MenuRadioItem value={value} closeOnClick className="pe-2.5">
      <span className="flex w-full items-center gap-2">
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {hint ? <span className="shrink-0 text-[11px] text-muted-foreground">{hint}</span> : null}
      </span>
    </MenuRadioItem>
  );
}

export function AccountNavPopover({ variant = "rail" }: { variant?: "rail" | "header" }) {
  const [open, setOpen] = useState(false);
  const signOut = useAuth((s) => s.signOut);
  const { data: accounts, isLoading } = useAccounts();
  const accountId = useFilters((s) => s.accountId);
  const setAccount = useFilters((s) => s.setAccount);

  const items = accounts ?? [];
  const selectedLabel = accountId
    ? (items.find((a) => a.id === accountId)?.name ?? "Account")
    : "All accounts";
  const filterActive = Boolean(accountId);
  const isRail = variant === "rail";
  const allAccountsHint = items.length
    ? `${items.length} ${items.length === 1 ? "account" : "accounts"}`
    : undefined;

  return (
    <Menu open={open} onOpenChange={setOpen}>
      <MenuTrigger
        title={selectedLabel}
        aria-label={`Account: ${selectedLabel}`}
        className={cn(
          "group relative flex cursor-pointer items-center justify-center rounded-md outline-none",
          isRail ? "size-9" : "size-8",
          "pointer-coarse:size-11",
          "transition-[background-color,color,transform] duration-150 ease-out",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          "motion-reduce:transition-none",
          open || filterActive
            ? "bg-accent text-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        <CircleUser
          size={15}
          strokeWidth={1.75}
          className="transition-transform duration-150 ease-out group-hover:scale-105 motion-reduce:transition-none"
        />
        {isRail ? <RailTooltip label={selectedLabel} /> : null}
      </MenuTrigger>
      <MenuPopup
        side={isRail ? "right" : "bottom"}
        align="end"
        sideOffset={isRail ? 8 : 6}
        className="w-56"
      >
        {isLoading ? (
          <p className="m-0 px-2 py-1.5 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <MenuRadioGroup
            value={accountId ?? ALL_VALUE}
            onValueChange={(value) => setAccount(value === ALL_VALUE ? undefined : String(value))}
          >
            <MenuGroup>
              <MenuGroupLabel>Account</MenuGroupLabel>
              <AccountMenuItem value={ALL_VALUE} label="All accounts" hint={allAccountsHint} />
              {items.map((account) => (
                <AccountMenuItem
                  key={account.id}
                  value={account.id}
                  label={account.name}
                  hint={account.base_currency?.trim().toUpperCase()}
                />
              ))}
            </MenuGroup>
          </MenuRadioGroup>
        )}
        {/* Hairline, not spacing: without it the action reads as another account row. */}
        <MenuSeparator />
        <MenuItem onClick={signOut}>
          <LogOut aria-hidden />
          Sign out
        </MenuItem>
      </MenuPopup>
    </Menu>
  );
}
