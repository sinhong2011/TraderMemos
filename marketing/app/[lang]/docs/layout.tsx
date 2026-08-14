import type { Metadata } from 'next';
import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { baseOptions } from '@/lib/layout.shared';
import { appName } from '@/lib/shared';

// Page titles come from MDX frontmatter and are bare nouns ("Introduction",
// "Importing trades") — worthless as title tags on their own, so the section
// brands them here rather than in each of the ~30 files per locale.
export const metadata: Metadata = {
  title: {
    template: `%s — ${appName} docs`,
    default: `${appName} docs`,
  },
};

export default async function Layout({
  params,
  children,
}: {
  params: Promise<{ lang: string }>;
  children: React.ReactNode;
}) {
  const { lang } = await params;

  return (
    <DocsLayout tree={source.getPageTree(lang)} {...(await baseOptions(lang))}>
      {children}
    </DocsLayout>
  );
}
