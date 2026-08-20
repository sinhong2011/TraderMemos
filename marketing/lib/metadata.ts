import type { Metadata } from 'next';
import { locales } from '@/i18n/locales';
import { appName, siteUrl, gitConfig, demoConfig } from '@/lib/shared';

/* The dashboard shot doubles as the social card for pages with no bespoke image.
   Next derives the Twitter card from OpenGraph, and a page that sets no image
   degrades to the small imageless `summary` card — so this travels with the
   `twitter` block below rather than being set on its own. */
export const socialImage = { url: '/screenshots/dashboard.png', width: 1440, height: 900 };

/** Canonical plus the hreflang map, for a route that exists under every locale prefix. */
export function localeAlternates(lang: string, path = ''): Metadata['alternates'] {
  return {
    canonical: `/${lang}${path}`,
    languages: Object.fromEntries(locales.map((locale) => [locale, `/${locale}${path}`])),
  };
}

/** OpenGraph image and the matching large Twitter card. */
export function socialCard(title: string, description: string) {
  return {
    images: [socialImage],
    twitter: {
      card: 'summary_large_image' as const,
      title,
      description,
      images: [socialImage.url],
    },
  };
}

/** schema.org description of the app itself, for the landing page. */
export function softwareSchema(description: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: appName,
    description,
    url: siteUrl,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web, iOS, Android, Docker',
    license: 'https://www.gnu.org/licenses/agpl-3.0.html',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    sameAs: [`https://github.com/${gitConfig.user}/${gitConfig.repo}`],
    downloadUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}/releases/latest`,
    softwareHelp: `${siteUrl}/en/docs`,
    screenshot: `${siteUrl}${socialImage.url}`,
    ...(demoConfig.url ? { installUrl: demoConfig.url } : {}),
  };
}

/* JSON.stringify leaves `<` alone, so a `</script>` inside any embedded string
   would close the tag early. Escaping the three characters that can start a
   markup token keeps the payload inert while staying valid JSON. */
export function jsonLdScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}
