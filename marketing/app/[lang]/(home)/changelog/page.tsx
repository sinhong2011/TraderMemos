import fs from 'node:fs/promises';
import path from 'node:path';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { gitConfig } from '@/lib/shared';
import { resolveLocale } from '@/i18n/locales';

const repoUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;

interface Release {
  version: string;
  url?: string;
  date?: string;
  sections: { title: string; items: string[] }[];
}

/** Parse the release-please CHANGELOG.md shape: `## [x.y.z](url) (date)` → `### Section` → `* item`. */
function parseChangelog(md: string): Release[] {
  const releases: Release[] = [];
  let release: Release | undefined;
  let section: Release['sections'][number] | undefined;

  for (const line of md.split('\n')) {
    const h2 = line.match(/^## \[([^\]]+)\]\(([^)]+)\)(?: \(([^)]+)\))?/) ?? line.match(/^## ([\d.]+)(?: \(([^)]+)\))?/);
    if (h2) {
      release =
        line.includes('](')
          ? { version: h2[1], url: h2[2], date: h2[3], sections: [] }
          : { version: h2[1], date: h2[2], sections: [] };
      releases.push(release);
      section = undefined;
      continue;
    }
    const h3 = line.match(/^### (.+)/);
    if (h3 && release) {
      section = { title: h3[1], items: [] };
      release.sections.push(section);
      continue;
    }
    const bullet = line.match(/^\* (.+)/);
    if (bullet && section) {
      section.items.push(bullet[1]);
    }
  }

  return releases;
}

/** Render the inline `[text](url)`, `**bold**`, and `` `code` `` markdown used in changelog bullets. */
function Inline({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  const pattern = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    if (match[1]) {
      nodes.push(
        <a key={key++} href={match[2]} className="text-fd-primary hover:underline" rel="noreferrer">
          {match[1]}
        </a>,
      );
    } else if (match[3]) {
      nodes.push(<strong key={key++}>{match[3]}</strong>);
    } else {
      nodes.push(
        <code key={key++} className="rounded bg-fd-muted px-1 py-0.5 font-mono text-[0.85em]">
          {match[4]}
        </code>,
      );
    }
    last = pattern.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));

  return <>{nodes}</>;
}

async function loadChangelog(): Promise<Release[]> {
  // Read at build time from the repo root (marketing/ is a workspace inside the monorepo).
  const md = await fs.readFile(path.join(process.cwd(), '..', 'CHANGELOG.md'), 'utf8');
  return parseChangelog(md);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const t = await getTranslations({ locale: resolveLocale(lang), namespace: 'Changelog' });
  return { title: t('title'), description: t('intro') };
}

export default async function ChangelogPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale = resolveLocale(lang);
  setRequestLocale(locale);
  const t = await getTranslations('Changelog');
  const releases = await loadChangelog();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">{t('title')}</h1>
      <p className="mt-3 text-fd-muted-foreground">
        {t('intro')}{' '}
        <a href={`${repoUrl}/releases`} className="text-fd-primary hover:underline" rel="noreferrer">
          {t('viewOnGitHub')}
        </a>
      </p>

      <div className="mt-12 flex flex-col gap-12">
        {releases.map((release) => (
          <section key={release.version}>
            <div className="flex items-baseline gap-3">
              <h2 className="text-2xl font-semibold">
                {release.url ? (
                  <a href={release.url} className="hover:text-fd-primary" rel="noreferrer">
                    v{release.version}
                  </a>
                ) : (
                  <>v{release.version}</>
                )}
              </h2>
              {release.date ? (
                <span className="text-sm text-fd-muted-foreground">{release.date}</span>
              ) : null}
            </div>
            {release.sections.map((section) => (
              <div key={section.title} className="mt-4">
                <h3 className="text-sm font-medium uppercase tracking-wide text-fd-muted-foreground">
                  {section.title}
                </h3>
                <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed">
                  {section.items.map((item, i) => (
                    <li key={i}>
                      <Inline text={item} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}
