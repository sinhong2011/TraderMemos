import { createMDX } from 'fumadocs-mdx/next';
import createNextIntlPlugin from 'next-intl/plugin';

const withMDX = createMDX();
const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  async redirects() {
    // Docs pages moved into section folders (2026-08)
    return [
      {
        source: '/:lang/docs/quick-start',
        destination: '/:lang/docs/getting-started/quick-start',
        permanent: true,
      },
      {
        source: '/:lang/docs/deploy',
        destination: '/:lang/docs/self-hosting/deploy',
        permanent: true,
      },
      {
        source: '/:lang/docs/fork-deploy',
        destination: '/:lang/docs/self-hosting/fork-deploy',
        permanent: true,
      },
    ];
  },
};

export default withNextIntl(withMDX(config));
