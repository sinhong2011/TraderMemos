import { loader } from 'fumadocs-core/source';
import { lucideIconsPlugin } from 'fumadocs-core/source/lucide-icons';
import { docsContentRoute, docsImageRoute, docsRoute } from './shared';
import { i18n } from './i18n';
import { openapi } from './openapi';
import { defineDocs } from 'fumadocs-mdx/macro';
import { metaSchema, pageSchema } from 'fumadocs-core/source/schema';

const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    schema: pageSchema,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

// One page per OpenAPI tag, as virtual files under content/docs/api-reference — nothing is
// written to disk. The folder's title and ordering come from the real (and translated)
// content/docs/api-reference/meta*.json, so the section reads like the rest of the docs.
const apiReference = await openapi.staticSource({ baseDir: 'api-reference', per: 'tag' });

// Two sources merged into one tree: `page.type` discriminates them at render time.
// See https://fumadocs.dev/docs/headless/source-api for more info
export const source = loader(
  { docs: docs.toFumadocsSource(), openapi: apiReference },
  {
    baseUrl: docsRoute,
    // openapi.loaderPlugin() adds the GET/POST/… method badges to the sidebar.
    plugins: [lucideIconsPlugin(), openapi.loaderPlugin()],
    i18n,
  },
);

export type DocsPage = ReturnType<typeof source.getPages>[number];

/** The OpenAPI pages are generated in English only; i18n falls back for the other locales. */
export function isOpenAPIPage(
  page: DocsPage,
): page is Extract<DocsPage, { type: 'openapi' }> {
  return page.type === 'openapi';
}

export function getPageImageUrl(page: (typeof source)['$inferPage']) {
  const segments = [...page.slugs, 'image.png'];

  return {
    segments,
    url: '/' + [page.locale, ...docsImageRoute.split('/'), ...segments].filter(Boolean).join('/'),
  };
}

export function getPageMarkdownUrl(page: (typeof source)['$inferPage']) {
  const segments = [...page.slugs, 'content.md'];

  return {
    segments,
    url: '/' + [page.locale, ...docsContentRoute.split('/'), ...segments].filter(Boolean).join('/'),
  };
}

/**
 * OpenAPI pages have no MDX body to serve as Markdown — they're rendered from the schema.
 * They still appear in llms.txt, the sitemap and search, which index title/description.
 */
export function getMarkdownPages(lang?: string) {
  return source.getPages(lang).filter((page) => !isOpenAPIPage(page));
}

export async function getLLMText(page: Extract<DocsPage, { type: 'docs' }>) {
  const processed = await page.data.getText('processed');

  return `# ${page.data.title} (${page.url})

${processed}`;
}
