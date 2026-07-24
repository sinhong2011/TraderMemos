import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "../lib/cn";
import { useLocale } from "../i18n";
import { navLabel } from "../lib/locale";
import { isRouteActive, PRIMARY_NAV } from "../lib/navItems";

/**
 * Fixed bottom nav for phone widths (<768px) — the AppNav rail is `hidden`
 * there (see AppNav.tsx). Only the four primary routes live here; everything
 * else (Playbook, Calculator, Import, Settings, account, quick actions)
 * lives one tap away in MobileNavDrawer via the header's hamburger trigger.
 */
export function MobileTabBar() {
  const { locale } = useLocale();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const label = (key: Parameters<typeof navLabel>[1]) => navLabel(locale, key);

  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-[2] flex h-[calc(56px+env(safe-area-inset-bottom))] shrink-0 items-stretch border-t border-border bg-background pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] md:hidden"
    >
      {PRIMARY_NAV.map((item) => {
        const active = isRouteActive(pathname, item.to);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            aria-label={label(item.labelKey)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 no-underline",
              "transition-colors duration-150 ease-out active:scale-95 motion-reduce:active:scale-100",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon size={20} strokeWidth={1.75} />
            <span className="text-[10px] font-medium tracking-wide">{label(item.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
