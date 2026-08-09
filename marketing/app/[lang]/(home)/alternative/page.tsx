import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Scale } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { appName } from '@/lib/shared';
import { resolveLocale } from '@/i18n/locales';
import { competitorSlugs, competitorNames } from '@/lib/seo-pages';
import { Eyebrow, PageCta, CrossLinks, focusRing } from '@/components/seo-sections';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const t = await getTranslations({ locale: resolveLocale(lang), namespace: 'AlternativePages' });

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: {
      canonical: `/${lang}/alternative`,
      languages: {
        en: '/en/alternative',
        'zh-Hant': '/zh-Hant/alternative',
        'zh-Hans': '/zh-Hans/alternative',
        ja: '/ja/alternative',
      },
    },
    openGraph: {
      title: t('metaTitle'),
      description: t('metaDescription'),
      url: `/${lang}/alternative`,
      siteName: appName,
      type: 'website',
    },
  };
}

export default async function AlternativeIndexPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  setRequestLocale(resolveLocale(lang));
  const t = await getTranslations('AlternativePages');
  const shared = await getTranslations('SeoShared');

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
        <div className="grid gap-4 sm:grid-cols-2">
          {competitorSlugs.map((slug) => (
            <Link
              key={slug}
              href={`/${lang}/alternative/${slug}`}
              className={`group flex h-full flex-col rounded-2xl bg-fd-card p-6 shadow-sm transition-colors hover:bg-fd-accent ${focusRing}`}
            >
              <div className="flex size-9 items-center justify-center rounded-lg bg-fd-primary/10">
                <Scale className="size-4.5 text-fd-primary" />
              </div>
              <h2 className="mt-4 font-medium">
                {shared('vs', { name: competitorNames[slug] })}
              </h2>
              <p className="mt-1.5 flex-1 text-sm leading-relaxed text-fd-muted-foreground">
                {t(`pages.${slug}.blurb`)}
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-fd-primary">
                {t('readComparison')}
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <PageCta lang={lang} />
      <CrossLinks lang={lang} />
    </main>
  );
}
