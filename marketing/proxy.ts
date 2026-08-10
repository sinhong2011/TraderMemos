import { NextRequest, NextResponse, type NextFetchEvent } from 'next/server';
import { isMarkdownPreferred, rewritePath } from 'fumadocs-core/negotiation';
import { createI18nMiddleware } from 'fumadocs-core/i18n/middleware';
import { docsContentRoute, docsRoute } from '@/lib/shared';
import { i18n } from '@/lib/i18n';

const { rewrite: rewriteDocs } = rewritePath(
  `/:lang${docsRoute}{/*path}`,
  `/:lang${docsContentRoute}{/*path}/content.md`,
);
const { rewrite: rewriteSuffix } = rewritePath(
  `/:lang${docsRoute}{/*path}.md`,
  `/:lang${docsContentRoute}{/*path}/content.md`,
);

const i18nMiddleware = createI18nMiddleware(i18n);

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  const result = rewriteSuffix(request.nextUrl.pathname);
  if (result) {
    return NextResponse.rewrite(new URL(result, request.nextUrl));
  }

  if (isMarkdownPreferred(request)) {
    const result = rewriteDocs(request.nextUrl.pathname);

    if (result) {
      return NextResponse.rewrite(new URL(result, request.nextUrl), {
        // this URL has two representations, selected by `Accept`
        headers: { Vary: 'Accept' },
      });
    }
  }

  // adds/redirects to the locale prefix (e.g. `/` -> `/en`) for all other routes
  return i18nMiddleware(request, event);
}

export const config = {
  // Exclude api routes, Next internals, public/ static assets (favicon, icon, screenshots),
  // and the root metadata routes. The latter are locale-agnostic and have no `/[lang]`
  // counterpart — without the exemption the i18n middleware redirects `/sitemap.xml` to
  // `/en/sitemap.xml`, which 404s, hiding the sitemap and robots.txt from crawlers.
  matcher: [
    '/((?!api|_next/static|_next/image|favicon\\.ico|icon\\.png|icon-1024\\.png|screenshots|sitemap\\.xml|robots\\.txt|llms\\.txt|llms-full\\.txt).*)',
  ],
};
