import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { appName, gitConfig } from '@/lib/shared';
import { localeAlternates, socialCard } from '@/lib/metadata';
import { resolveLocale } from '@/i18n/locales';

const repoUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;

/** Render order for `Privacy.sections` — the JSON is keyed, not ordered. */
const sectionIds = [
  'scope',
  'controller',
  'device',
  'permissions',
  'server',
  'ai',
  'thirdParties',
  'website',
  'children',
  'rights',
  'changes',
] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const t = await getTranslations({ locale: resolveLocale(lang), namespace: 'Privacy' });

  const title = t('metaTitle');
  const description = t('metaDescription');
  const { images, twitter } = socialCard(title, description);

  return {
    title,
    description,
    alternates: localeAlternates(lang, '/privacy'),
    openGraph: {
      title,
      description,
      url: `/${lang}/privacy`,
      siteName: appName,
      type: 'article',
      images,
    },
    twitter,
  };
}

export default async function PrivacyPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale = resolveLocale(lang);
  setRequestLocale(locale);
  const t = await getTranslations('Privacy');

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">{t('title')}</h1>
      <p className="mt-3 text-sm text-fd-muted-foreground">{t('updated')}</p>
      <p className="mt-6 text-lg leading-relaxed text-fd-muted-foreground">{t('intro')}</p>

      <div className="mt-12 flex flex-col gap-10">
        {sectionIds.map((id) => (
          <section key={id}>
            <h2 className="text-xl font-semibold tracking-tight">{t(`sections.${id}.title`)}</h2>
            <div className="mt-3 flex flex-col gap-3 leading-relaxed text-fd-muted-foreground">
              {(t.raw(`sections.${id}.body`) as string[]).map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}

        <section>
          <h2 className="text-xl font-semibold tracking-tight">{t('contactTitle')}</h2>
          <p className="mt-3 leading-relaxed text-fd-muted-foreground">
            {t('contactBody')}{' '}
            <a
              href={`${repoUrl}/discussions`}
              className="text-fd-primary hover:underline"
              rel="noreferrer"
            >
              {t('contactLink')}
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
