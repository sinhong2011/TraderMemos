import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./ui/button";

export interface AuthModeOption {
  value: string;
  label: string;
}

/** Underline tablist for auth mode — used by tests; login UI prefers SegmentedControl. */
export function AuthModeTabs({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: readonly AuthModeOption[];
  value: string;
  onChange: (v: string) => void;
  ariaLabel?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  const [indicator, setIndicator] = useState({
    left: 0,
    width: 0,
    ready: false,
  });

  useLayoutEffect(() => {
    const list = listRef.current;
    const active = buttonRefs.current.get(value);
    if (!list || !active) return;

    const measure = () => {
      setIndicator({
        left: active.offsetLeft,
        width: active.offsetWidth,
        ready: true,
      });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    for (const btn of buttonRefs.current.values()) {
      ro.observe(btn);
    }
    return () => ro.disconnect();
  }, [value, options]);

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      className="relative flex w-full items-center justify-center gap-6"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-0 h-0.5 rounded-full bg-primary transition-[left,width,opacity] duration-[220ms] ease-out motion-reduce:transition-none"
        style={{
          left: indicator.left,
          width: indicator.width,
          opacity: indicator.ready ? 1 : 0,
        }}
      />
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Button
            key={option.value}
            ref={(el) => {
              if (el) buttonRefs.current.set(option.value, el);
              else buttonRefs.current.delete(option.value);
            }}
            type="button"
            variant="ghost"
            role="tab"
            id={`auth-tab-${option.value}`}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            className={cn(
              "relative h-auto rounded-none bg-transparent px-0 pb-3 text-[13px] font-medium hover:bg-transparent",
              active
                ? "text-foreground hover:text-foreground"
                : "text-muted-foreground hover:text-muted-foreground",
            )}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}
