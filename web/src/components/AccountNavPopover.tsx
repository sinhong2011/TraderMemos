import { Check, CircleUser, LogOut, Wallet } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../lib/auth";
import { cn } from "../lib/cn";
import { useFilters } from "../lib/filters";
import { useAccounts } from "../lib/hooks/useAccounts";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

function RailTooltip({ label }: { label: string }) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute top-1/2 left-[calc(100%+8px)] z-50",
        "-translate-y-1/2 translate-x-1",
        "rounded-md border border-border bg-card px-2 py-1",
        "text-[11px] tracking-wide whitespace-nowrap text-muted-foreground",
        "opacity-0 transition-[opacity,transform] duration-150 ease-out",
        "group-hover:translate-x-0 group-hover:opacity-100",
        "group-focus-visible:translate-x-0 group-focus-visible:opacity-100",
        "motion-reduce:transition-none motion-reduce:translate-x-0",
      )}
    >
      {label}
    </span>
  );
}

function AccountOption({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onSelect}
      className={cn(
        "relative h-auto w-full justify-start gap-2 rounded-md py-2 pr-2.5 pl-3",
        "text-left text-[12px]",
        selected
          ? "bg-primary/10 font-medium text-primary hover:bg-primary/10 hover:text-primary"
          : "text-foreground",
      )}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {selected ? (
        <Check size={13} strokeWidth={2} className="shrink-0 text-primary" aria-hidden />
      ) : null}
    </Button>
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

  function pickAccount(id: string | undefined) {
    setAccount(id);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
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
      </PopoverTrigger>
      <PopoverContent
        side={isRail ? "right" : "bottom"}
        align="end"
        sideOffset={isRail ? 8 : 6}
        className="w-[220px] p-1.5"
      >
        <p className="m-0 flex items-center gap-1.5 px-2.5 pt-1.5 pb-2.5 text-[10px] font-semibold uppercase tracking-widest text-chart-3">
          <Wallet size={11} strokeWidth={1.75} aria-hidden />
          Account
        </p>
        <div className="flex flex-col gap-0.5">
          {isLoading ? (
            <p className="px-2.5 py-2 text-[12px] text-muted-foreground">Loading…</p>
          ) : (
            <>
              <AccountOption
                label="All accounts"
                selected={!accountId}
                onSelect={() => pickAccount(undefined)}
              />
              {items.map((account) => (
                <AccountOption
                  key={account.id}
                  label={account.name}
                  selected={accountId === account.id}
                  onSelect={() => pickAccount(account.id)}
                />
              ))}
            </>
          )}
        </div>
        <div className="mt-1.5 border-t border-border pt-1.5">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            className="h-auto w-full justify-start gap-2 px-2.5 py-2 text-[12px] font-medium"
          >
            <LogOut size={14} strokeWidth={1.75} aria-hidden />
            Sign out
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
