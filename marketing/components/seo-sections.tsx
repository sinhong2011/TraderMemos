import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { gitConfig } from '@/lib/shared';
import { featureSlugs, competitorSlugs, competitorNames } from '@/lib/seo-pages';

const repoUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;

export const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fd-ring';

/* Chart-legend eyebrow, matching the landing page. */
export function Eyebrow({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2 font-mono text-xs font-medium uppercase tracking-[0.18em] text-fd-muted-foreground">
      <span aria-hidden className="size-2 rounded-[2px] bg-fd-primary" />
      {label}
    </p>
  );
}

/* Closing call-to-action shared by the features and alternative pages. */
export async function PageCta({ lang }: { lang: string }) {
  const t = await getTranslations('SeoShared');

  return (
    <section className="px-6 py-20">
      <div
        className="relative overflow-hidden rounded-2xl bg-fd-card p-8 shadow-sm sm:p-12"
        style={{
          background:
            'linear-gradient(120deg, color-mix(in oklch, var(--color-fd-primary) 12%, var(--color-fd-card)), var(--color-fd-card) 55%)',
        }}
      >
        <div className="flex flex-col items-start gap-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              {t('ctaHeading')}
            </h2>
            <p className="mt-2 text-pretty leading-relaxed text-fd-muted-foreground">
              {t('ctaBody')}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <Link
              href={`/${lang}/docs`}
              className={`inline-flex items-center gap-2 rounded-lg bg-fd-primary px-5 py-2.5 text-sm font-medium text-fd-primary-foreground shadow-lg shadow-fd-primary/25 transition hover:opacity-90 ${focusRing}`}
            >
              {t('ctaGetStarted')}
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href={repoUrl}
              className={`inline-flex items-center gap-2 rounded-lg bg-fd-secondary px-5 py-2.5 text-sm font-medium text-fd-secondary-foreground ring-1 ring-fd-border transition-colors hover:bg-fd-accent ${focusRing}`}
            >
              {t('ctaGithub')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Internal-linking footer between the SEO pages: every pillar and every
 * comparison links to every other one. `currentPath` (path under `/[lang]`,
 * e.g. `features/self-hosted`) is rendered as plain text instead of a link.
 */
export async function CrossLinks({ lang, currentPath }: { lang: string; currentPath?: string }) {
  const t = await getTranslations('SeoShared');
  const feature = await getTranslations('FeaturePages');
  const link =
    'text-fd-muted-foreground transition-colors hover:text-fd-foreground hover:underline';

  const groups: { heading: string; items: { path: string; label: string }[] }[] = [
    {
      heading: t('morePillars'),
      items: featureSlugs.map((slug) => ({
        path: `features/${slug}`,
        label: feature(`pages.${slug}.eyebrow`),
      })),
    },
    {
      heading: t('moreComparisons'),
      items: competitorSlugs.map((slug) => ({
        path: `alternative/${slug}`,
        label: t('vs', { name: competitorNames[slug] }),
      })),
    },
  ];

  return (
    <nav aria-label={t('crossLinksLabel')} className="px-6 pb-20">
      <div className="grid gap-8 border-t border-fd-border/60 pt-10 sm:grid-cols-2">
        {groups.map((group) => (
          <div key={group.heading}>
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-fd-muted-foreground">
              {group.heading}
            </p>
            <ul className="mt-4 flex flex-col gap-2 text-sm">
              {group.items.map((item) => (
                <li key={item.path}>
                  {item.path === currentPath ? (
                    <span className="font-medium text-fd-foreground">{item.label}</span>
                  ) : (
                    <Link href={`/${lang}/${item.path}`} className={link}>
                      {item.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
