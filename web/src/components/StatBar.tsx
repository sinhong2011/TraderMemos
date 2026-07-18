import { cn } from "../lib/cn";
import type { PillTone } from "./Pill";
import { Button } from "./ui/button";

const TONE_VALUE: Record<PillTone, string> = {
  pos: "text-profit",
  neg: "text-loss",
  accent: "text-accent",
  amber: "text-signal",
  muted: "text-text",
};

/**
 * Interactive metric chip for dense strips (Performance filters).
 * Title stays top-left; value block centers in the tile.
 */
export function StatBar({
  label,
  value,
  sub,
  tone = "muted",
  onClick,
  active,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: PillTone;
  onClick?: () => void;
  active?: boolean;
}) {
  const interactive = Boolean(onClick);

  const shell = cn(
    "flex h-full min-h-[91px] w-full flex-col rounded-card px-3 py-3.5",
    "bg-bg-panel",
  );

  const inner = (
    <>
      <span
        className={cn(
          "self-start text-left text-[12px] font-medium uppercase tracking-widest text-text-muted",
          interactive && "transition-colors duration-150 ease-out",
          interactive && (active ? "text-text" : "group-hover:text-text"),
        )}
      >
        {label}
      </span>
      <div className="mt-2 flex flex-1 flex-col items-center justify-center text-center">
        <div className="flex items-baseline justify-center gap-1.5">
          <span
            className={cn("text-[18px] font-semibold leading-none tabular-nums", TONE_VALUE[tone])}
          >
            {value}
          </span>
          {sub ? <span className="text-[13px] tabular-nums text-text-dim">{sub}</span> : null}
        </div>
      </div>
    </>
  );

  if (!onClick) {
    return <div className={shell}>{inner}</div>;
  }

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "group h-auto flex-col items-stretch whitespace-normal border-none",
        shell,
        "motion-reduce:transition-none",
        active ? "bg-accent-bg hover:bg-accent-bg" : "hover:bg-bg-hover",
      )}
    >
      {inner}
    </Button>
  );
}
