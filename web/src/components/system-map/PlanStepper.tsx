import { t } from "@lingui/core/macro";
import { Check, CircleHelp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PlanStep } from "@/lib/api/system";
import { cn } from "@/lib/cn";
import { planStepCopy } from "@/lib/system";

type StepState = "done" | "current" | "upcoming";

function stepStates(plan: PlanStep[]): StepState[] {
  const current = plan.findIndex((s) => !s.done);
  return plan.map((s, i) => (s.done ? "done" : i === current ? "current" : "upcoming"));
}

export function PlanStepper({ plan }: { plan: PlanStep[] }) {
  const states = stepStates(plan);
  const doneCount = states.filter((s) => s === "done").length;

  return (
    <section
      aria-label={t`Four-week plan`}
      className="flex flex-col gap-3 rounded-lg bg-card px-4 py-3 md:flex-row md:items-center md:gap-6"
    >
      <div className="flex shrink-0 items-center gap-1.5 md:w-36 md:flex-col md:items-start md:gap-0.5">
        <div className="flex items-center gap-1.5">
          <h2 className="text-xs font-medium text-muted-foreground">{t`Four-week plan`}</h2>
          <Tooltip>
            <TooltipTrigger
              type="button"
              className="inline-flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
              aria-label={t`About the four-week plan`}
            >
              <CircleHelp className="size-3" strokeWidth={1.75} aria-hidden />
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              align="start"
              className="block max-w-[18rem] whitespace-normal px-2.5 py-1.5 text-left text-xs leading-relaxed"
            >
              {t`Progress is derived from your data — not a checklist you tick.`}
            </TooltipContent>
          </Tooltip>
        </div>
        <span className="text-2xs tabular-nums text-muted-foreground">
          {t`${doneCount} of ${plan.length} steps done`}
        </span>
      </div>

      <ol className="grid min-w-0 flex-1 grid-cols-2 gap-x-3 gap-y-3 md:flex md:items-center md:gap-0">
        {plan.map((step, i) => {
          const state = states[i];
          const copy = planStepCopy(step.key);
          const last = i === plan.length - 1;
          return (
            <li key={step.key} className="flex min-w-0 items-center md:flex-1 md:last:flex-none">
              <Tooltip>
                <TooltipTrigger
                  type="button"
                  aria-current={state === "current" ? "step" : undefined}
                  aria-label={t`${copy.title}: ${step.progress} of ${step.target}`}
                  className="group flex min-w-0 items-center gap-2.5 rounded-md py-1 pe-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full text-2xs font-semibold tabular-nums transition-colors",
                      state === "done" && "bg-primary text-primary-foreground",
                      state === "current" && "bg-primary/15 text-primary ring-2 ring-primary",
                      state === "upcoming" && "bg-muted text-muted-foreground",
                    )}
                  >
                    {state === "done" ? (
                      <Check className="size-3.5" strokeWidth={2.5} aria-hidden />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span
                      className={cn(
                        "truncate text-xs font-medium",
                        state === "upcoming" ? "text-muted-foreground" : "text-foreground",
                      )}
                    >
                      {copy.title}
                    </span>
                    <span className="text-2xs tabular-nums text-muted-foreground">
                      {state === "done" ? t`Done` : t`${step.progress} / ${step.target}`}
                    </span>
                  </span>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  className="block max-w-[16rem] whitespace-normal px-2.5 py-1.5 text-left text-xs leading-relaxed"
                >
                  {copy.detail}
                </TooltipContent>
              </Tooltip>
              {last ? null : (
                <span
                  aria-hidden
                  className={cn(
                    "mx-2 hidden h-0.5 min-w-4 flex-1 rounded-full md:block",
                    state === "done" ? "bg-primary" : "bg-foreground/15",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
