export const appName = 'TraderMemos';
// Absolute origin for metadata routes (sitemap.xml, robots.txt, OG images, canonical URLs).
// Override per environment with NEXT_PUBLIC_SITE_URL; the default is the production deploy so
// an unset variable can't silently publish localhost URLs to crawlers.
export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://trader-memos.vercel.app';
export const docsRoute = '/docs';
export const docsImageRoute = '/og/docs';
export const docsContentRoute = '/llms.mdx/docs';

export const gitConfig = {
  user: 'sinhong2011',
  repo: 'TraderMemos',
  branch: 'main',
};

// Hosted demo instance surfaced on the landing page (hero CTA) and in the README.
export const demoConfig = {
  url: 'https://tradermemos.netlify.app',
  user: 'tradermemosdemo',
  password: 'demopassword',
};
