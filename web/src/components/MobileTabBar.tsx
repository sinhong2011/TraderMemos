import { Link, useRouterState } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useLocale } from "@/i18n";
import { navLabel } from "@/lib/locale";
import { isRouteActive, PRIMARY_NAV, type NavItem } from "@/lib/navItems";
import { useUI } from "@/lib/ui";
import { CreateMenu } from "./CreateMenu";
import { Button } from "./ui/button";
import { floatingSurfaceClass } from "./surface-styles";

/**
 * Gentle overshoot — the pill leans past the new tab and settles back, which
 * reads as travel between tabs rather than a background swapping on and off.
 * Longer than the 150ms house default because the motion *is* the affordance.
 */
const TAB_EASE = "cubic-bezier(0.34, 1.26, 0.64, 1)";
const TAB_DURATION = "320ms";

function TabLink({
  item,
  label,
  active,
  itemRef,
}: {
  item: NavItem;
  label: string;
  active: boolean;
  itemRef: (el: HTMLAnchorElement | null) => void;
}) {
  const Icon = item.icon;

  return (
    <Link
      ref={itemRef}
      to={item.to}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      // z-[1] keeps the glyph and label above the sliding pill behind them.
      className={cn(
        "relative z-[1] flex min-w-0 flex-1 flex-col items-center justify-center gap-px rounded-full py-0.5 no-underline",
        "transition-[color,scale] duration-200 ease-out",
        "active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <Icon
        size={17}
        strokeWidth={active ? 2 : 1.75}
        className={cn(
          "transition-transform motion-reduce:transition-none",
          active ? "-translate-y-px scale-110" : "scale-100",
        )}
        style={{ transitionDuration: TAB_DURATION, transitionTimingFunction: TAB_EASE }}
      />
      <span
        className={cn(
          "max-w-full truncate text-[10px] leading-tight tracking-wide",
          "transition-[font-weight,opacity] duration-200 ease-out motion-reduce:transition-none",
          active ? "font-semibold" : "font-medium opacity-80",
        )}
      >
        {label}
      </span>
    </Link>
  );
}

function MoreButton({ label }: { label: string }) {
  const openMobileNav = useUI((s) => s.openMobileNav);
  return (
    <Button
      type="button"
      variant="ghost"
      aria-label={label}
      onClick={openMobileNav}
      className={cn(
        "relative z-[1] flex min-w-0 flex-1 flex-col items-center justify-center gap-px rounded-full py-0.5 no-underline",
        "transition-[color,scale] duration-200 ease-out",
        "active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100",
        "text-muted-foreground hover:text-foreground",
        "h-auto px-0",
      )}
    >
      <Menu
        size={17}
        strokeWidth={1.75}
        className="transition-transform motion-reduce:transition-none"
        style={{ transitionDuration: TAB_DURATION, transitionTimingFunction: TAB_EASE }}
      />
      <span
        className={cn(
          "max-w-full truncate text-[10px] leading-tight tracking-wide",
          "font-medium opacity-80",
        )}
      >
        {label}
      </span>
    </Button>
  );
}

const TAB_ITEMS = PRIMARY_NAV.filter((item) => item.to !== "/reports");

/**
 * Floating bottom navigation for phone widths (<768px) — the AppNav rail is
 * `hidden` there (see AppNav.tsx). Content scrolls *under* the opaque capsule
 * rather than stopping at a docked bar; `shell.tsx` reserves the height as
 * bottom padding on <main>. Three primary routes ride in the capsule, split around
 * the centre create button; Reports and everything else (Playbook, Calculator,
 * Import, Settings, account) lives one tap away in MobileNavDrawer via the
 * "More" tab.
 */
export function MobileTabBar() {
  const { locale } = useLocale();
  const label = (key: Parameters<typeof navLabel>[1]) => navLabel(locale, key);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const split = Math.ceil(TAB_ITEMS.length / 2);

  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef(new Map<string, HTMLAnchorElement>());
  const [pill, setPill] = useState({ left: 0, top: 0, width: 0, height: 0, ready: false });

  const activeItem = TAB_ITEMS.find((item) => isRouteActive(pathname, item.to));

  // Measured rather than per-tab backgrounds so one element travels between
  // tabs. Runs before paint, so the first placement never animates in from 0.
  useLayoutEffect(() => {
    const nav = navRef.current;
    const el = activeItem ? itemRefs.current.get(activeItem.to) : null;
    if (!nav || !el) {
      setPill((p) => ({ ...p, ready: false }));
      return;
    }

    const measure = () => {
      setPill({
        left: el.offsetLeft,
        top: el.offsetTop,
        width: el.offsetWidth,
        height: el.offsetHeight,
        ready: true,
      });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(nav);
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeItem]);

  return (
    // Named for the View Transition API. The transition overlay paints above all
    // page content, and on phones <main> is the full document height, so its
    // opaque snapshot would cover this bar for the length of every route change.
    // A name of its own lifts it into the overlay instead of under it; the rules
    // in global.css then let it render live rather than animate. Ignored at ≥md,
    // where `md:hidden` takes the element out of rendering entirely.
    <div
      style={{ viewTransitionName: "mobile-tab-bar" }}
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-[2] flex items-end md:hidden",
        "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        "pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]",
      )}
    >
      <nav
        ref={navRef}
        aria-label="Main navigation"
        className={cn(
          "pointer-events-auto relative flex min-w-0 flex-1 items-stretch gap-0.5 rounded-full p-1",
          floatingSurfaceClass,
        )}
      >
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-0 left-0 rounded-full bg-primary/12",
            "transition-[translate,width,height,opacity] motion-reduce:transition-none",
            pill.ready ? "opacity-100" : "opacity-0",
          )}
          style={{
            translate: `${pill.left}px ${pill.top}px`,
            width: pill.width,
            height: pill.height,
            transitionDuration: TAB_DURATION,
            transitionTimingFunction: TAB_EASE,
          }}
        />

        {TAB_ITEMS.slice(0, split).map((item) => (
          <TabLink
            key={item.to}
            item={item}
            label={label(item.labelKey)}
            active={item === activeItem}
            itemRef={(el) => {
              if (el) itemRefs.current.set(item.to, el);
              else itemRefs.current.delete(item.to);
            }}
          />
        ))}
        <CreateMenu variant="fab" />
        {TAB_ITEMS.slice(split).map((item) => (
          <TabLink
            key={item.to}
            item={item}
            label={label(item.labelKey)}
            active={item === activeItem}
            itemRef={(el) => {
              if (el) itemRefs.current.set(item.to, el);
              else itemRefs.current.delete(item.to);
            }}
          />
        ))}
        <MoreButton label={label("more")} />
      </nav>
    </div>
  );
}
