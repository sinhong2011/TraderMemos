import Link from 'next/link';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { baseOptions } from '@/lib/layout.shared';
import { appName, gitConfig } from '@/lib/shared';
import { resolveLocale } from '@/i18n/locales';

async function Footer({ lang }: { lang: string }) {
  const t = await getTranslations('Footer');
  const repoUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;
  const link =
    'transition-colors hover:text-fd-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fd-ring';

  return (
    <footer className="mt-auto border-t border-fd-border/60">
      <div className="flex flex-col gap-4 px-6 py-10 text-sm text-fd-muted-foreground">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p>
            <span className="font-medium text-fd-foreground">{appName}</span> — {t('tagline')}
          </p>
          <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href={`/${lang}/docs`} className={link}>
              {t('docs')}
            </Link>
            <Link href={`/${lang}/changelog`} className={link}>
              {t('changelog')}
            </Link>
            <Link href={`/${lang}/privacy`} className={link}>
              {t('privacy')}
            </Link>
            <Link href={`${repoUrl}/blob/main/docs/competitive-day-trader-roadmap.md`} className={link}>
              {t('roadmap')}
            </Link>
            <Link href={repoUrl} className={link}>
              {t('github')}
            </Link>
            <Link href={`${repoUrl}/discussions`} className={link}>
              {t('discussions')}
            </Link>
            <Link href={`${repoUrl}/blob/main/SECURITY.md`} className={link}>
              {t('security')}
            </Link>
            <Link href={`${repoUrl}/blob/main/LICENSE`} className={link}>
              {t('license')}
            </Link>
          </nav>
        </div>
        <p className="text-xs text-fd-muted-foreground/70">{t('privacyNote')}</p>
      </div>
    </footer>
  );
}

export default async function Layout({
  params,
  children,
}: {
  params: Promise<{ lang: string }>;
  children: React.ReactNode;
}) {
  const { lang } = await params;
  setRequestLocale(resolveLocale(lang));

  return (
    <HomeLayout {...baseOptions(lang)}>
      {/* Blueprint chrome: hatched gutters outside the bounded content frame */}
      <div aria-hidden className="tm-gutter left-0" />
      <div aria-hidden className="tm-gutter right-0" />
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col border-x border-fd-border/60 bg-fd-background">
        {children}
        <Footer lang={lang} />
      </div>
    </HomeLayout>
  );
}
