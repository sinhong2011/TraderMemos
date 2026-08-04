# TraderMemos marketing site

Marketing + docs site for [TraderMemos](https://github.com/sinhong2011/TraderMemos), built with
[Next.js](https://nextjs.org) and [Fumadocs](https://fumadocs.dev). Supports English (`en`) and
Traditional Chinese (`zh-Hant`).

Run development server:

```bash
pnpm dev
```

Open http://localhost:3000 with your browser — it redirects to `/en`.

## Explore

- `lib/i18n.ts` / `lib/translations.ts`: locale config and fumadocs-ui chrome translations.
- `lib/home-content.ts`: per-locale copy for the landing page.
- `lib/source.ts`: content source adapter ([`loader()`](https://fumadocs.dev/docs/headless/source-api)).
- `lib/layout.shared.tsx`: shared nav/layout options, locale-aware.
- `proxy.ts`: locale routing + markdown content negotiation (merged, since Next allows only one proxy).

| Route                            | Description                                             |
| --------------------------------- | -------------------------------------------------------- |
| `app/[lang]/(home)`               | Landing page route group, one per locale.                |
| `app/[lang]/docs`                 | Documentation layout and pages.                           |
| `app/[lang]/llms.mdx`, `app/[lang]/og` | Per-page markdown/OG-image routes, locale-scoped.    |
| `app/api/search/route.ts`         | Search API route handler (locale-agnostic).               |
| `app/llms.txt`, `app/llms-full.txt` | Global docs index/full-text for LLMs.                    |

### Content

Docs live in `content/docs/`. English is the default (`quick-start.mdx`); Traditional Chinese
translations use the `.zh-Hant` suffix (`quick-start.zh-Hant.mdx`), per
[Fumadocs i18n routing](https://fumadocs.dev/docs/headless/page-conventions#i18n-routing).

## Learn more

- [Next.js Documentation](https://nextjs.org/docs)
- [Fumadocs](https://fumadocs.dev)
- [Fumadocs i18n (Next.js)](https://fumadocs.dev/docs/internationalization/next)
