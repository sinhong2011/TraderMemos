import { Link, useRouterState } from "@tanstack/react-router";
import { Plus, Settings, StickyNote, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { navLabel } from "../lib/locale";
import { isRouteActive, MAIN_ROUTES, PRIMARY_NAV, SECONDARY_NAV } from "../lib/navItems";
import { useLocale } from "../i18n";
import { useUI } from "../lib/ui";
import { AppLogo } from "./AppLogo";
import { ToolsPopover } from "./ToolsPopover";

function RailTooltip({ label }: { label: string }) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute top-1/2 left-[calc(100%+8px)] z-50",
        "-translate-y-1/2 translate-x-1",
        "rounded-control border border-border bg-bg-panel px-2 py-1",
        "text-[11px] tracking-wide whitespace-nowrap text-text-muted",
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

function RailLink({
  to,
  label,
  icon: Icon,
  active,
  itemRef,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  itemRef?: (el: HTMLAnchorElement | null) => void;
}) {
  return (
    <Link
      ref={itemRef}
      to={to}
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex size-9 items-center justify-center rounded-control no-underline",
        "pointer-coarse:size-11",
        "transition-[background-color,color,transform] duration-150 ease-out",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-strong",
        "motion-reduce:transition-none",
        active ? "bg-accent-bg text-accent" : "text-text-dim hover:bg-bg-hover hover:text-text",
      )}
    >
      <Icon
        size={20}
        strokeWidth={1.75}
        className={cn(
          "transition-transform duration-150 ease-out motion-reduce:transition-none",
          active ? "scale-105" : "group-hover:scale-105",
        )}
      />
      <RailTooltip label={label} />
    </Link>
  );
}

function RailAction({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "group relative flex size-9 cursor-pointer items-center justify-center rounded-control border-none bg-transparent p-0",
        "pointer-coarse:size-11",
        "transition-[background-color,color,transform] duration-150 ease-out",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-strong",
        "motion-reduce:transition-none",
        "text-text-dim hover:bg-bg-hover hover:text-text active:scale-95",
        "motion-reduce:active:scale-100",
      )}
    >
      <Icon
        size={20}
        strokeWidth={1.75}
        className="transition-transform duration-150 ease-out group-hover:scale-105 motion-reduce:transition-none"
      />
      <RailTooltip label={label} />
    </button>
  );
}

export function AppNav() {
  const { locale } = useLocale();
  const openModal = useUI((s) => s.openModal);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const label = (key: Parameters<typeof navLabel>[1]) => navLabel(locale, key);

  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLAnchorElement>());
  const [pip, setPip] = useState({ top: 0, ready: false });

  const activeMain = MAIN_ROUTES.find((r) => isRouteActive(pathname, r.to));
  const settingsActive = isRouteActive(pathname, "/settings");

  useLayoutEffect(() => {
    const list = listRef.current;
    const activeEl = activeMain ? itemRefs.current.get(activeMain.to) : null;
    if (!list || !activeEl) {
      setPip((p) => ({ ...p, ready: false }));
      return;
    }

    const measure = () => {
      setPip({
        top: activeEl.offsetTop + activeEl.offsetHeight / 2 - 6,
        ready: true,
      });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    ro.observe(activeEl);
    return () => ro.disconnect();
  }, [activeMain, pathname]);

  return (
    <nav
      aria-label="Main navigation"
      className="relative z-[2] hidden h-full w-[52px] shrink-0 flex-col bg-bg md:flex"
    >
      {/* Logo band — same 52px + border as HeaderBar */}
      <div className="flex h-[52px] w-full shrink-0 items-center justify-center bg-bg">
        <AppLogo
          size={24}
          className="transition-transform duration-150 ease-out hover:scale-105 motion-reduce:transition-none"
        />
      </div>

      <div ref={listRef} className="relative flex flex-1 flex-col items-center gap-0.5 py-2">
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute left-0 h-3 w-0.5 rounded-full bg-accent",
            "shadow-[0_0_8px_var(--color-accent-glow)]",
            "transition-[top,opacity] duration-[220ms] ease-out",
            "motion-reduce:transition-none",
            pip.ready ? "opacity-100" : "opacity-0",
          )}
          style={{ top: pip.top }}
        />

        {PRIMARY_NAV.map((item) => (
          <RailLink
            key={item.to}
            to={item.to}
            icon={item.icon}
            label={label(item.labelKey)}
            active={isRouteActive(pathname, item.to)}
            itemRef={(el) => {
              if (el) itemRefs.current.set(item.to, el);
              else itemRefs.current.delete(item.to);
            }}
          />
        ))}

        <div
          className="my-2 h-px w-4 origin-center scale-x-100 bg-border transition-transform duration-150"
          aria-hidden
        />

        {SECONDARY_NAV.map((item) => (
          <RailLink
            key={item.to}
            to={item.to}
            icon={item.icon}
            label={label(item.labelKey)}
            active={isRouteActive(pathname, item.to)}
            itemRef={(el) => {
              if (el) itemRefs.current.set(item.to, el);
              else itemRefs.current.delete(item.to);
            }}
          />
        ))}
      </div>

      <div className="flex w-full flex-col items-center gap-0.5 py-2">
        <RailAction label={label("newTrade")} icon={Plus} onClick={() => openModal("new-trade")} />
        <RailAction label={label("newSetup")} icon={Zap} onClick={() => openModal("new-setup")} />
        <RailAction
          label={label("newNote")}
          icon={StickyNote}
          onClick={() => openModal("new-note")}
        />

        <div className="my-1.5 h-px w-4 bg-border" aria-hidden />

        <ToolsPopover variant="rail" />

        <div className="my-1.5 h-px w-4 bg-border" aria-hidden />

        <div className="relative">
          {settingsActive && (
            <span
              aria-hidden
              className="absolute top-1/2 left-[-6px] h-3 w-0.5 -translate-y-1/2 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent-glow)]"
            />
          )}
          <RailLink
            to="/settings"
            label={label("settings")}
            icon={Settings}
            active={settingsActive}
          />
        </div>
      </div>
    </nav>
  );
}
