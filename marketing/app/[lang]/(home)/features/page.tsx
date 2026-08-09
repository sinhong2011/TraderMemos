import type { Metadata } from 'next';
import Link from 'next/link';
import { Server, Brain, Gauge, ShieldCheck, KeyRound, ArrowRight } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { appName } from '@/lib/shared';
import { resolveLocale } from '@/i18n/locales';
import { featureSlugs, type FeatureSlug } from '@/lib/seo-pages';
import { Eyebrow, PageCta, CrossLinks, focusRing } from '@/components/seo-sections';

const pillarIcons: Record<FeatureSlug, typeof Server> = {
  'self-hosted': Server,
  'behavior-analytics': Brain,
  'prop-firm-mode': Gauge,
  'rule-compliance': ShieldCheck,
  'ai-your-keys': KeyRound,
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const t = await getTranslations({ locale: resolveLocale(lang), namespace: 'FeaturePages' });

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: {
      canonical: `/${lang}/features`,
      languages: {
        en: '/en/features',
        'zh-Hant': '/zh-Hant/features',
        'zh-Hans': '/zh-Hans/features',
        ja: '/ja/features',
      },
    },
    openGraph: {
      title: t('metaTitle'),
      description: t('metaDescription'),
      url: `/${lang}/features`,
      siteName: appName,
      type: 'website',
    },
  };
}

export default async function FeaturesIndexPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  setRequestLocale(resolveLocale(lang));
  const t = await getTranslations('FeaturePages');

  return (
    <main className="flex-1">
      <section className="px-6 pb-4 pt-16 sm:pt-20">
        <Eyebrow label={t('eyebrow')} />
        <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          {t('heading')}
        </h1>
        <p className="mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-fd-muted-foreground">
          {t('sub')}
        </p>
      </section>

      <section className="px-6 py-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featureSlugs.map((slug) => {
            const Icon = pillarIcons[slug];
            return (
              <Link
                key={slug}
                href={`/${lang}/features/${slug}`}
                className={`group flex h-full flex-col rounded-2xl bg-fd-card p-6 shadow-sm transition-colors hover:bg-fd-accent ${focusRing}`}
              >
                <div className="flex size-9 items-center justify-center rounded-lg bg-fd-primary/10">
                  <Icon className="size-4.5 text-fd-primary" />
                </div>
                <h2 className="mt-4 font-medium">{t(`pages.${slug}.eyebrow`)}</h2>
                <p className="mt-1.5 flex-1 text-sm leading-relaxed text-fd-muted-foreground">
                  {t(`pages.${slug}.blurb`)}
                </p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-fd-primary">
                  {t('explore')}
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <PageCta lang={lang} />
      <CrossLinks lang={lang} />
    </main>
  );
}
