import type { ReactNode } from 'react';

/**
 * Pro entitlement seam (docs/mobile-monetization-plan.md, Phase 0).
 *
 * Every Pro *candidate* routes its entry point through this one check so the
 * free/Pro line can be drawn later without refactoring. Until Phase 2 draws
 * the line and ships entitlement plumbing, the gate always passes — nothing
 * in the codebase hard-codes a tier.
 */
export type ProFeature = 'share-card-styles' | 'share-card-hide-mark';

/** True when the feature is unlocked for this user. Phase 0: always. */
export function useProGate(feature: ProFeature): boolean {
  void feature;
  return true;
}

/** Renders children only when the feature is unlocked. Phase 0: always. */
export function ProGate({ feature, children }: { feature: ProFeature; children: ReactNode }) {
  const unlocked = useProGate(feature);
  return unlocked ? children : null;
}
