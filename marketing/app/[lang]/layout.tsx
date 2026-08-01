import type { Metadata } from 'next';
import { Bricolage_Grotesque, JetBrains_Mono } from 'next/font/google';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { i18nProvider } from 'fumadocs-ui/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { translations } from '@/lib/translations';
import { i18n } from '@/lib/i18n';
import { siteUrl } from '@/lib/shared';
import { resolveLocale } from '@/i18n/locales';
import '../global.css';

const displayFont = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
});

const monoFont = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
};

export function generateStaticParams() {
  return i18n.languages.map((lang) => ({ lang }));
}

export default async function Layout({
  params,
  children,
}: {
  params: Promise<{ lang: string }>;
  children: React.ReactNode;
}) {
  const { lang } = await params;
  const locale = resolveLocale(lang);
  // Locale routing is handled by the fumadocs middleware; forward the resolved
  // locale to next-intl (picked up by i18n/request.ts via `requestLocale`).
  setRequestLocale(locale);

  return (
    <html
      lang={lang}
      suppressHydrationWarning
      className={`${displayFont.variable} ${monoFont.variable}`}
    >
      <body className="flex flex-col min-h-screen">
        <NextIntlClientProvider>
          <RootProvider
            theme={{ defaultTheme: 'dark' }}
            i18n={i18nProvider(translations, lang)}
          >
            {children}
          </RootProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
