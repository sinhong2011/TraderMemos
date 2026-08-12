import Image from 'next/image';
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { getTranslations } from 'next-intl/server';
import { appName, gitConfig } from './shared';
import { resolveLocale } from '@/i18n/locales';

export async function baseOptions(locale: string): Promise<BaseLayoutProps> {
  const t = await getTranslations({ locale: resolveLocale(locale), namespace: 'Footer' });

  return {
    i18n: true,
    nav: {
      url: `/${locale}`,
      title: (
        <>
          <Image src="/icon.png" alt="" width={20} height={20} unoptimized className="rounded-sm" />
          {appName}
        </>
      ),
    },
    links: [
      { text: t('docs'), url: `/${locale}/docs` },
      { text: t('features'), url: `/${locale}/features` },
      { text: t('compare'), url: `/${locale}/alternative` },
      { text: t('changelog'), url: `/${locale}/changelog` },
    ],
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
