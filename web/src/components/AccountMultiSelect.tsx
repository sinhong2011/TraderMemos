import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import type { Account } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { Menu, MenuCheckboxItem, MenuPopup, MenuTrigger } from "./ui/menu";

/**
 * Picks the account (or accounts) a new trade is written to.
 *
 * One control rather than two: the drawer used to pair a single-select for the
 * account with a row of checkboxes labelled "Also save to", which made one
 * decision look like two settings and put the extra accounts in a different
 * vocabulary from the first. Choosing accounts is one question, so it gets one
 * answer — a menu whose rows check on and off, the same shape the account
 * filter in the nav already uses.
 *
 * The first id is the primary: it decides the trade's currency and carries the
 * dividend, and every other selected account receives a copy of the same fills.
 * De-selecting the primary promotes the next one rather than leaving the trade
 * without a home, and the last remaining account can't be de-selected — a trade
 * has to be written somewhere.
 */
export function AccountMultiSelect({
  accounts,
  value,
  onChange,
  disabled,
}: {
  accounts: Account[];
  /** Selected ids, primary first. */
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const selected = value.filter((id) => accounts.some((account) => account.id === id));
  const nameOf = (id: string) => accounts.find((account) => account.id === id)?.name ?? "";
  const label =
    selected.length === 0
      ? "Select account"
      : selected.length === 1
        ? nameOf(selected[0])
        : // The primary stays legible rather than collapsing to a bare count —
          // it is the one that decides the currency.
          `${nameOf(selected[0])} +${selected.length - 1}`;

  const toggle = (id: string) => {
    if (!selected.includes(id)) return onChange([...selected, id]);
    if (selected.length === 1) return;
    onChange(selected.filter((selectedId) => selectedId !== id));
  };

  return (
    <Menu open={open} onOpenChange={setOpen}>
      <MenuTrigger
        disabled={disabled}
        aria-label="Account"
        // Field chrome copied from `NativeSelect` so this sits on the same
        // baseline as the inputs beside it and reads as the same control.
        className={cn(
          "relative inline-flex h-8.5 w-full items-center rounded-lg border border-input bg-background pr-8 pl-[calc(--spacing(3)-1px)] text-left sm:h-7.5",
          "text-base text-foreground shadow-xs/5 ring-ring/24 transition-shadow not-dark:bg-clip-padding sm:text-sm",
          "cursor-pointer focus-visible:border-ring focus-visible:ring-[3px] focus-visible:outline-none",
          "disabled:pointer-events-none disabled:opacity-64 disabled:shadow-none",
          "dark:bg-input/32",
        )}
      >
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <ChevronDownIcon
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-2.5 size-4.5 -translate-y-1/2 text-muted-foreground opacity-80 sm:size-4"
        />
      </MenuTrigger>
      <MenuPopup align="start" className="min-w-(--anchor-width)">
        {accounts.map((account) => {
          const checked = selected.includes(account.id);
          return (
            <MenuCheckboxItem
              key={account.id}
              checked={checked}
              // The menu stays open: picking several accounts is one gesture,
              // and re-opening between each would make the multi part a chore.
              closeOnClick={false}
              // Nothing to uncheck to when it's the only one left.
              disabled={checked && selected.length === 1}
              onCheckedChange={() => toggle(account.id)}
              className="pe-2.5"
            >
              <span className="flex w-full items-center gap-2">
                <span className="min-w-0 flex-1 truncate">{account.name}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {account.id === selected[0] ? "Primary" : account.base_currency}
                </span>
              </span>
            </MenuCheckboxItem>
          );
        })}
      </MenuPopup>
    </Menu>
  );
}
