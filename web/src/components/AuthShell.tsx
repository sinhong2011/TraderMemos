import { useId, type ReactNode } from "react";
import { AppLogo } from "@/components/AppLogo";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/cn";

const CELL = 40;

/** Soft static grid void — adapted from ReUI auth. */
function AuthGridPattern({ className }: { className?: string }) {
  const patternId = useId().replace(/:/g, "");

  return (
    <svg
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-[-10%] inset-y-[-8%] h-[116%] w-[120%] text-foreground",
        "[mask-image:radial-gradient(72%_64%_at_50%_48%,black,rgba(0,0,0,0.72),transparent)]",
        className,
      )}
    >
      <defs>
        <pattern
          id={patternId}
          width={CELL}
          height={CELL}
          patternUnits="userSpaceOnUse"
          x="-1"
          y="-1"
        >
          <path
            d={`M.5 ${CELL}V.5H${CELL}`}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.055}
            strokeDasharray="0"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} stroke="none" />
    </svg>
  );
}

/** Centered auth frame on a quiet grid void. */
export function AuthShell({
  children,
  formClassName,
}: {
  children: ReactNode;
  formClassName?: string;
}) {
  return (
    <div className="relative flex min-h-svh w-full items-center justify-center overflow-hidden bg-background px-4 py-6 sm:px-8 sm:py-10">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <AuthGridPattern />
      </div>

      <section
        data-auth-surface
        className={cn(
          "relative z-10 flex w-full min-w-0 flex-col items-center justify-center gap-5 py-4 sm:py-6",
          formClassName,
        )}
      >
        <div className="flex flex-col items-center gap-2.5">
          <AppLogo size={36} />
          <p className="text-base font-semibold tracking-tight text-foreground">TraderMemos</p>
        </div>
        <Card className="w-full max-w-[22.5rem]">
          <CardContent className="flex flex-col gap-6 py-6">{children}</CardContent>
        </Card>
      </section>
    </div>
  );
}
