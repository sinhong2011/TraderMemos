import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

export function SystemInspector({ panelKey, children }: { panelKey: string; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={panelKey}
        initial={reduce ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduce ? undefined : { opacity: 0, y: -4 }}
        transition={{ duration: 0.15 }}
        className="flex h-full min-h-0 min-w-0 flex-col"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
