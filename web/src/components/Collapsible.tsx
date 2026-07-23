import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";
import { ChevronDown } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { cn } from "../lib/cn";

type CollapsibleAnimation = "height" | "fade";

const CollapsibleOpenContext = createContext(false);

/** Soft spring for open — low bounce. */
const HEIGHT_SPRING = {
  type: "spring" as const,
  visualDuration: 0.42,
  bounce: 0.08,
};

/** Duration ease for close — avoids spring snap at the end. */
const HEIGHT_CLOSE = {
  duration: 0.4,
  ease: [0.4, 0, 0.2, 1] as const,
};

const CONTENT_EASE = [0.22, 1, 0.36, 1] as const;

/** shadcn-style Collapsible on Base UI + Motion. */
function Collapsible({
  className,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  children,
  ...props
}: CollapsiblePrimitive.Root.Props) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = openProp !== undefined;
  const open = isControlled ? Boolean(openProp) : uncontrolledOpen;

  const handleOpenChange = useCallback(
    (
      next: boolean,
      eventDetails: Parameters<NonNullable<CollapsiblePrimitive.Root.Props["onOpenChange"]>>[1],
    ) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next, eventDetails);
    },
    [isControlled, onOpenChange],
  );

  return (
    <CollapsibleOpenContext.Provider value={open}>
      <CollapsiblePrimitive.Root
        data-slot="collapsible"
        className={cn("flex flex-col", className)}
        open={open}
        onOpenChange={handleOpenChange}
        {...props}
      >
        {children}
      </CollapsiblePrimitive.Root>
    </CollapsibleOpenContext.Provider>
  );
}

function CollapsibleTrigger({ className, ...props }: CollapsiblePrimitive.Trigger.Props) {
  return (
    <CollapsiblePrimitive.Trigger
      data-slot="collapsible-trigger"
      className={cn(
        "group/collapsible-trigger flex cursor-pointer items-center gap-2 border-none bg-transparent p-0 text-left outline-none",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-strong",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Always-mounted panel (open/closed variants).
 * Avoids AnimatePresence remount, which could leave height stuck at 0 and block reopen.
 */
function CollapsibleContent({
  className,
  animation = "height",
  children,
}: {
  className?: string;
  animation?: CollapsibleAnimation;
  children?: ReactNode;
}) {
  const open = useContext(CollapsibleOpenContext);
  const reduceMotion = useReducedMotion();
  const instant = Boolean(reduceMotion) || import.meta.env.MODE === "test";
  const withSlide = animation === "fade";

  if (instant) {
    return open ? (
      <div data-slot="collapsible-content" className={cn("overflow-hidden", className)}>
        {children}
      </div>
    ) : null;
  }

  return (
    <motion.div
      data-slot="collapsible-content"
      className="overflow-hidden"
      initial={false}
      animate={open ? "open" : "closed"}
      variants={{
        open: {
          height: "auto",
          transition: { height: HEIGHT_SPRING },
        },
        closed: {
          height: 0,
          transition: { height: HEIGHT_CLOSE },
        },
      }}
      // Keep closed content out of tab order / clicks while still mounted for Motion.
      inert={!open || undefined}
      aria-hidden={!open}
      style={{ pointerEvents: open ? "auto" : "none" }}
    >
      <motion.div
        className={cn(className)}
        variants={{
          open: {
            opacity: 1,
            y: 0,
            transition: {
              opacity: { duration: 0.28, ease: CONTENT_EASE, delay: 0.06 },
              y: { ...HEIGHT_SPRING, delay: 0.02 },
            },
          },
          closed: {
            opacity: 0,
            y: withSlide ? -4 : -2,
            transition: {
              opacity: { duration: 0.32, ease: [0.4, 0, 1, 1] },
              y: { duration: 0.36, ease: [0.4, 0, 0.2, 1] },
            },
          },
        }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

/** Motion-rotated chevron synced to collapsible open state. */
function CollapsibleChevron({ className, size = 14 }: { className?: string; size?: number }) {
  const open = useContext(CollapsibleOpenContext);
  const reduceMotion = useReducedMotion();
  const instant = Boolean(reduceMotion) || import.meta.env.MODE === "test";
  return (
    <motion.span
      aria-hidden
      className={cn("ml-auto inline-flex shrink-0 text-text-muted", className)}
      animate={{ rotate: open ? 180 : 0 }}
      transition={
        instant
          ? { duration: 0 }
          : open
            ? { type: "spring", visualDuration: 0.35, bounce: 0.12 }
            : { duration: 0.36, ease: [0.4, 0, 0.2, 1] }
      }
    >
      <ChevronDown size={size} />
    </motion.span>
  );
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent, CollapsibleChevron };
export type CollapsibleProps = ComponentProps<typeof Collapsible>;
export type CollapsibleTriggerProps = ComponentProps<typeof CollapsibleTrigger>;
export type CollapsibleContentProps = ComponentProps<typeof CollapsibleContent>;
