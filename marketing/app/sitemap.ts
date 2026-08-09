import type { MetadataRoute } from 'next';
import { source } from '@/lib/source';
import { i18n } from '@/lib/i18n';
import { siteUrl } from '@/lib/shared';
import { featureSlugs, competitorSlugs } from '@/lib/seo-pages';

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const lang of i18n.languages) {
    entries.push({ url: `${siteUrl}/${lang}`, changeFrequency: 'weekly', priority: 1 });
    entries.push({ url: `${siteUrl}/${lang}/changelog`, changeFrequency: 'weekly', priority: 0.5 });
    entries.push({ url: `${siteUrl}/${lang}/privacy`, changeFrequency: 'yearly', priority: 0.3 });

    entries.push({ url: `${siteUrl}/${lang}/features`, changeFrequency: 'monthly', priority: 0.8 });
    for (const slug of featureSlugs) {
      entries.push({
        url: `${siteUrl}/${lang}/features/${slug}`,
        changeFrequency: 'monthly',
        priority: 0.8,
      });
    }
    entries.push({
      url: `${siteUrl}/${lang}/alternative`,
      changeFrequency: 'monthly',
      priority: 0.8,
    });
    for (const slug of competitorSlugs) {
      entries.push({
        url: `${siteUrl}/${lang}/alternative/${slug}`,
        changeFrequency: 'monthly',
        priority: 0.8,
      });
    }

    for (const page of source.getPages(lang)) {
      entries.push({
        url: `${siteUrl}${page.url}`,
        changeFrequency: 'weekly',
        priority: page.slugs.length === 0 ? 0.9 : 0.7,
      });
    }
  }

  return entries;
}
