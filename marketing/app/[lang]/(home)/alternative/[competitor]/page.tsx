import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Check, Minus } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { appName, gitConfig } from '@/lib/shared';
import { localeAlternates, socialCard } from '@/lib/metadata';
import { resolveLocale } from '@/i18n/locales';
import { competitorSlugs, competitorNames, isCompetitorSlug } from '@/lib/seo-pages';
import { Eyebrow, PageCta, CrossLinks } from '@/components/seo-sections';

const repoUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;

interface ComparisonRow {
  row: string;
  them: string;
  tm: string;
}

export function generateStaticParams() {
  return competitorSlugs.map((competitor) => ({ competitor }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; competitor: string }>;
}): Promise<Metadata> {
  const { lang, competitor } = await params;
  if (!isCompetitorSlug(competitor)) notFound();
  const t = await getTranslations({ locale: resolveLocale(lang), namespace: 'AlternativePages' });

  const title = t(`pages.${competitor}.metaTitle`);
  const description = t(`pages.${competitor}.metaDescription`);
  const { images, twitter } = socialCard(title, description);

  return {
    title,
    description,
    alternates: localeAlternates(lang, `/alternative/${competitor}`),
    openGraph: {
      title,
      description,
      url: `/${lang}/alternative/${competitor}`,
      siteName: appName,
      type: 'article',
      images,
    },
    twitter,
  };
}

export default async function AlternativePage({
  params,
}: {
  params: Promise<{ lang: string; competitor: string }>;
}) {
  const { lang, competitor } = await params;
  if (!isCompetitorSlug(competitor)) notFound();
  setRequestLocale(resolveLocale(lang));
  const t = await getTranslations('AlternativePages');
  const name = competitorNames[competitor];
  const rows = t.raw(`pages.${competitor}.rows`) as ComparisonRow[];
  const theyWin = t.raw(`pages.${competitor}.theyWin`) as string[];
  const tmWins = t.raw(`pages.${competitor}.tmWins`) as string[];

  return (
    <main className="flex-1">
      <section className="px-6 pb-4 pt-16 sm:pt-20">
        <Eyebrow label={t('eyebrow')} />
        <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          {t(`pages.${competitor}.title`)}
        </h1>
        <p className="mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-fd-muted-foreground">
          {t(`pages.${competitor}.subtitle`)}
        </p>
      </section>

      {/* Comparison ledger — same treatment as the landing page's why-table. */}
      <section className="px-6 py-12">
        {/* Mobile: one card per category, TM value highlighted */}
        <div className="space-y-3 sm:hidden">
          {rows.map((r) => (
            <div key={r.row} className="rounded-xl bg-fd-card p-4 shadow-sm">
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-fd-muted-foreground">
                {r.row}
              </p>
              <div className="mt-3 space-y-1.5">
                <div className="flex items-baseline justify-between gap-6 px-3">
                  <span className="shrink-0 text-xs text-fd-muted-foreground">{name}</span>
                  <span className="text-right text-sm text-fd-muted-foreground">{r.them}</span>
                </div>
                <div className="flex items-baseline justify-between gap-6 rounded-lg bg-fd-primary/10 px-3 py-2.5">
                  <span className="shrink-0 text-xs font-medium text-fd-primary">{appName}</span>
                  <span className="text-right text-sm font-medium">{r.tm}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden overflow-x-auto rounded-xl bg-fd-card p-2 shadow-sm sm:block">
          <table className="w-full min-w-[36rem] border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr className="font-mono text-[11px] uppercase tracking-[0.15em]">
                <th scope="col" className="px-4 pb-3 pt-3 font-medium text-fd-muted-foreground">
                  {t('tableCategory')}
                </th>
                <th scope="col" className="px-4 pb-3 pt-3 font-medium text-fd-muted-foreground">
                  {name}
                </th>
                <th
                  scope="col"
                  className="rounded-t-lg bg-fd-primary/10 px-4 pb-3 pt-3 font-medium text-fd-primary"
                >
                  {appName}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const last = i === rows.length - 1;
                return (
                  <tr key={r.row}>
                    <th scope="row" className="px-4 py-3.5 text-left font-medium">
                      {r.row}
                    </th>
                    <td className="px-4 py-3.5 text-fd-muted-foreground">{r.them}</td>
                    <td
                      className={`bg-fd-primary/10 px-4 py-3.5 font-medium ${
                        last ? 'rounded-b-lg' : ''
                      }`}
                    >
                      {r.tm}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* The honesty section — both columns, theirs first. */}
      <section className="px-6 pb-12">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-fd-card p-6 shadow-sm">
            <h2 className="font-medium">{t('theyWinHeading', { name })}</h2>
            <ul className="mt-4 flex flex-col gap-3">
              {theyWin.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-relaxed text-fd-muted-foreground">
                  <Minus className="mt-0.5 size-4 shrink-0 text-fd-muted-foreground/60" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-fd-card p-6 shadow-sm">
            <h2 className="font-medium">{t('tmWinsHeading')}</h2>
            <ul className="mt-4 flex flex-col gap-3">
              {tmWins.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-relaxed text-fd-muted-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-tm-profit" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-fd-card p-6 shadow-sm">
          <h2 className="font-medium">{t('verdictHeading')}</h2>
          <p className="mt-2 leading-relaxed text-fd-muted-foreground">
            {t(`pages.${competitor}.verdict`)}
          </p>
        </div>

        <p className="mt-6 text-xs leading-relaxed text-fd-muted-foreground/70">
          {t('disclaimer')}{' '}
          <a href={`${repoUrl}/issues`} rel="noreferrer" className="text-fd-primary hover:underline">
            {t('disclaimerLink')}
          </a>
        </p>
      </section>

      <PageCta lang={lang} />
      <CrossLinks lang={lang} currentPath={`alternative/${competitor}`} />
    </main>
  );
}
