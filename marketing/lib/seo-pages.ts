/**
 * Structural data for the SEO surface: `/features/<slug>` pillar pages and
 * `/alternative/<competitor>` comparison pages. All copy lives in
 * `messages/<locale>.json` under `FeaturePages` / `AlternativePages`; this
 * module only owns slugs, ordering, and per-slug artwork so the route
 * components and the sitemap agree on what exists.
 */

export const featureSlugs = [
  'self-hosted',
  'behavior-analytics',
  'backtesting',
  'prop-firm-mode',
  'rule-compliance',
  'ai-your-keys',
] as const;

export type FeatureSlug = (typeof featureSlugs)[number];

export function isFeatureSlug(candidate: string): candidate is FeatureSlug {
  return (featureSlugs as readonly string[]).includes(candidate);
}

export const competitorSlugs = ['tradezella', 'tradersync', 'tradervue', 'traderwaves'] as const;

export type CompetitorSlug = (typeof competitorSlugs)[number];

export function isCompetitorSlug(candidate: string): candidate is CompetitorSlug {
  return (competitorSlugs as readonly string[]).includes(candidate);
}

/** Proper product names — never translated, never lowercased for display. */
export const competitorNames: Record<CompetitorSlug, string> = {
  tradezella: 'TradeZella',
  tradersync: 'TraderSync',
  tradervue: 'Tradervue',
  traderwaves: 'TraderWaves',
};
