import Image from 'next/image';
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { appName, gitConfig } from './shared';

export function baseOptions(locale: string): BaseLayoutProps {
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
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
