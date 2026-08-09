/**
 * The Pro seam (docs/mobile-monetization-plan.md).
 *
 * Every Pro-candidate feature routes its single entry-point check through
 * here so the free/Pro line can be drawn in one place before the public App
 * Store release (roadmap Wave 6), without refactoring the features
 * themselves. Until the IAP plumbing lands, everything is unlocked.
 */
export type ProFeature = 'widgets' | 'liveActivity';

export function useProUnlocked(_feature: ProFeature): boolean {
  return true;
}
