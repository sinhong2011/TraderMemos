import { Link, useRouterState } from "@tanstack/react-router";
import { Check, LogOut, Settings, SlidersHorizontal, Wallet, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle } from "./Drawer";
import { AppLogo } from "./AppLogo";
import { DateRangePicker } from "./DateRangePicker";
import { DisplayCurrencySelect } from "./HeaderBar";
import { ToolsPopover } from "./ToolsPopover";
import { Button } from "./ui/button";
import { useAppUpdate } from "@/lib/appUpdate";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { accountBaseCurrency, useDisplayPrefs } from "@/lib/displayPrefs";
import { useFilters } from "@/lib/filters";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { useLocale } from "@/i18n";
import { navLabel } from "@/lib/locale";
import { CREATE_ACTIONS, isRouteActive, PRIMARY_NAV, SECONDARY_NAV } from "@/lib/navItems";
import { useUI } from "@/lib/ui";

function NavRow({
  to,
  label,
  icon: Icon,
  active,
  dot,
  onNavigate,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  /** Quiet attention dot (e.g. an update is available — detail lives on the page). */
  dot?: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-md px-3 no-underline",
        "text-[14px] font-medium",
        active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent",
      )}
    >
      <Icon size={18} strokeWidth={1.75} aria-hidden />
      {label}
      {dot ? <span aria-hidden className="ml-auto size-1.5 rounded-full bg-primary" /> : null}
    </Link>
  );
}

function ActionRow({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      className="h-11 w-full justify-start gap-3 rounded-md px-3 text-[14px] font-medium text-foreground hover:bg-accent"
    >
      <Icon size={18} strokeWidth={1.75} aria-hidden />
      {label}
    </Button>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mt-1 mb-1 px-3 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
      {children}
    </p>
  );
}

function FiltersSection() {
  const accounts = useAccounts().data ?? [];
  const accountId = useFilters((s) => s.accountId);
  const baseCurrency = accountBaseCurrency(accounts, accountId);

  return (
    <div>
      <SectionLabel>
        <span className="inline-flex items-center gap-1.5">
          <SlidersHorizontal size={11} strokeWidth={1.75} aria-hidden />
          Filters
        </span>
      </SectionLabel>
      <div className="flex flex-wrap items-center gap-2 px-3 pt-0.5 pb-1.5">
        <DateRangePicker />
        <DisplayCurrencySelect baseCurrency={baseCurrency} />
        <ToolsPopover variant="header" />
      </div>
    </div>
  );
}

function AccountSection({ onNavigate }: { onNavigate: () => void }) {
  const signOut = useAuth((s) => s.signOut);
  const { data: accounts, isLoading } = useAccounts();
  const accountId = useFilters((s) => s.accountId);
  const setAccount = useFilters((s) => s.setAccount);
  const items = accounts ?? [];

  return (
    <div>
      <SectionLabel>
        <span className="inline-flex items-center gap-1.5">
          <Wallet size={11} strokeWidth={1.75} aria-hidden />
          Account
        </span>
      </SectionLabel>
      {isLoading ? (
        <p className="px-3 py-2 text-[13px] text-muted-foreground">Loading…</p>
      ) : (
        <div className="flex flex-col gap-0.5">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setAccount(undefined)}
            className={cn(
              "h-11 w-full justify-start gap-2 rounded-md px-3 text-left text-[14px]",
              !accountId ? "bg-primary/10 font-medium text-primary" : "text-foreground",
            )}
          >
            <span className="min-w-0 flex-1 truncate">All accounts</span>
            {!accountId ? <Check size={14} strokeWidth={2} className="shrink-0" /> : null}
          </Button>
          {items.map((account) => (
            <Button
              key={account.id}
              type="button"
              variant="ghost"
              onClick={() => setAccount(account.id)}
              className={cn(
                "h-11 w-full justify-start gap-2 rounded-md px-3 text-left text-[14px]",
                accountId === account.id
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-foreground",
              )}
            >
              <span className="min-w-0 flex-1 truncate">{account.name}</span>
              {accountId === account.id ? (
                <Check size={14} strokeWidth={2} className="shrink-0" />
              ) : null}
            </Button>
          ))}
        </div>
      )}
      <ActionRow
        label="Sign out"
        icon={LogOut}
        onClick={() => {
          onNavigate();
          signOut();
        }}
      />
    </div>
  );
}

/**
 * Off-canvas nav for phone widths — reached via the hamburger trigger in
 * HeaderBar. Holds everything that doesn't fit in MobileTabBar: secondary
 * routes, quick actions, settings, and account switching.
 */
export function MobileNavDrawer() {
  const { locale } = useLocale();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const open = useUI((s) => s.mobileNavOpen);
  const closeMobileNav = useUI((s) => s.closeMobileNav);
  const openModal = useUI((s) => s.openModal);
  const label = (key: Parameters<typeof navLabel>[1]) => navLabel(locale, key);
  // Mirrors the settings-rail dot in AppNav — see the comment there.
  const updateAttention = useAppUpdate(
    (s) => s.swReady || s.webBehind || s.apiBehind || s.versionMismatch,
  );
  const updateNotices = useDisplayPrefs((s) => s.updateNotices);

  function runAction(fn: () => void) {
    closeMobileNav();
    fn();
  }

  return (
    <Drawer open={open} onOpenChange={(v) => !v && closeMobileNav()} swipeDirection="left">
      <DrawerContent>
        <DrawerHeader>
          <div className="flex items-center gap-2">
            <AppLogo size={22} />
            <DrawerTitle>TraderMemos</DrawerTitle>
          </div>
          <DrawerClose
            aria-label="Close menu"
            className="ml-auto flex size-9 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-muted-foreground transition-colors hover:text-foreground"
          >
            <X size={18} strokeWidth={1.5} />
          </DrawerClose>
        </DrawerHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <FiltersSection />

          <div className="my-2 h-px bg-border" aria-hidden />

          <SectionLabel>More</SectionLabel>
          {PRIMARY_NAV.filter((item) => item.to === "/reports").map((item) => (
            <NavRow
              key={item.to}
              to={item.to}
              label={label(item.labelKey)}
              icon={item.icon}
              active={isRouteActive(pathname, item.to)}
              onNavigate={closeMobileNav}
            />
          ))}
          {SECONDARY_NAV.map((item) => (
            <NavRow
              key={item.to}
              to={item.to}
              label={label(item.labelKey)}
              icon={item.icon}
              active={isRouteActive(pathname, item.to)}
              onNavigate={closeMobileNav}
            />
          ))}
          <NavRow
            to="/settings"
            label={label("settings")}
            icon={Settings}
            active={isRouteActive(pathname, "/settings")}
            dot={updateNotices && updateAttention}
            onNavigate={closeMobileNav}
          />

          <div className="my-2 h-px bg-border" aria-hidden />

          <SectionLabel>Quick add</SectionLabel>
          {CREATE_ACTIONS.map((action) => (
            <ActionRow
              key={action.modal}
              label={label(action.labelKey)}
              icon={action.icon}
              onClick={() => runAction(() => openModal(action.modal))}
            />
          ))}

          <div className="my-2 h-px bg-border" aria-hidden />

          <AccountSection onNavigate={closeMobileNav} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
