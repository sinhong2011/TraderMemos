import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { StaticImageData } from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { appName } from '@/lib/shared';
import { resolveLocale } from '@/i18n/locales';
import { featureSlugs, isFeatureSlug, type FeatureSlug } from '@/lib/seo-pages';
import { Eyebrow, PageCta, CrossLinks } from '@/components/seo-sections';
import { BrowserFrame } from '@/components/browser-frame';
import dashboardShot from '@/public/screenshots/dashboard.png';
import dashboardLightShot from '@/public/screenshots/dashboard-light.png';
import tradesShot from '@/public/screenshots/trades.png';
import calendarShot from '@/public/screenshots/calendar.png';
import reportsShot from '@/public/screenshots/reports.png';

interface PillarShot {
  image: StaticImageData;
  lightImage?: StaticImageData;
  alt: string;
}

/* Screenshot per pillar — the AI page has no matching screen and gets none. */
const pillarShots: Partial<Record<FeatureSlug, PillarShot>> = {
  'self-hosted': {
    image: dashboardShot,
    lightImage: dashboardLightShot,
    alt: 'TraderMemos dashboard running on localhost — equity curve, expectancy and win-rate stats',
  },
  'behavior-analytics': {
    image: reportsShot,
    alt: 'TraderMemos reports — equity curve, profit factor gauge, win-rate donut, goal pacing',
  },
  'prop-firm-mode': {
    image: calendarShot,
    alt: 'TraderMemos P&L calendar heatmap — daily results against loss limits',
  },
  'rule-compliance': {
    image: tradesShot,
    alt: 'TraderMemos trade log with per-trade P&L, hold time, and tags',
  },
};

interface PillarPoint {
  title: string;
  body: string;
}

export function generateStaticParams() {
  return featureSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isFeatureSlug(slug)) notFound();
  const t = await getTranslations({ locale: resolveLocale(lang), namespace: 'FeaturePages' });

  return {
    title: t(`pages.${slug}.metaTitle`),
    description: t(`pages.${slug}.metaDescription`),
    alternates: {
      canonical: `/${lang}/features/${slug}`,
      languages: {
        en: `/en/features/${slug}`,
        'zh-Hant': `/zh-Hant/features/${slug}`,
        'zh-Hans': `/zh-Hans/features/${slug}`,
        ja: `/ja/features/${slug}`,
      },
    },
    openGraph: {
      title: t(`pages.${slug}.metaTitle`),
      description: t(`pages.${slug}.metaDescription`),
      url: `/${lang}/features/${slug}`,
      siteName: appName,
      type: 'article',
    },
  };
}

export default async function FeaturePillarPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  if (!isFeatureSlug(slug)) notFound();
  setRequestLocale(resolveLocale(lang));
  const t = await getTranslations('FeaturePages');
  const points = t.raw(`pages.${slug}.points`) as PillarPoint[];
  const shot = pillarShots[slug];

  return (
    <main className="flex-1">
      <section className="px-6 pb-4 pt-16 sm:pt-20">
        <Eyebrow label={t(`pages.${slug}.eyebrow`)} />
        <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          {t(`pages.${slug}.title`)}
        </h1>
        <p className="mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-fd-muted-foreground">
          {t(`pages.${slug}.subtitle`)}
        </p>
      </section>

      <section className="px-6 py-12">
        <div className="grid gap-4 sm:grid-cols-2">
          {points.map((point) => (
            <div key={point.title} className="rounded-2xl bg-fd-card p-6 shadow-sm">
              <h2 className="font-medium">{point.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-fd-muted-foreground">
                {point.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {shot ? (
        <section className="px-6 pb-12">
          <BrowserFrame
            image={shot.image}
            lightImage={shot.lightImage}
            alt={shot.alt}
            sizes="(max-width: 1200px) 100vw, 1104px"
          />
        </section>
      ) : null}

      <PageCta lang={lang} />
      <CrossLinks lang={lang} currentPath={`features/${slug}`} />
    </main>
  );
}
