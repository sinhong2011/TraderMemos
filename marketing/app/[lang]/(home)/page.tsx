import type { Metadata } from 'next';
import Link from 'next/link';
import {
  LayoutDashboard,
  ListChecks,
  CalendarDays,
  BarChart3,
  BookOpen,
  Upload,
  Calculator,
  Bot,
  Plug,
  MoonStar,
  ArrowRight,
  ArrowUpRight,
  Star,
  TrendingUp,
  DollarSign,
  Percent,
  Clock,
  Tag,
  LineChart,
  type LucideIcon,
} from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { appName, demoConfig, gitConfig } from '@/lib/shared';
import { resolveLocale } from '@/i18n/locales';
import {
  Reveal,
  WordReveal,
  ScrollFillText,
  ZoomFrame,
  StatBars,
  TypedTerminal,
} from '@/components/landing/motion';
import { BrowserFrame } from '@/components/browser-frame';
import { GlowCard } from '@/components/landing/effects';
import dashboardShot from '@/public/screenshots/dashboard.png';
import dashboardLightShot from '@/public/screenshots/dashboard-light.png';
import tradesShot from '@/public/screenshots/trades.png';
import calendarShot from '@/public/screenshots/calendar.png';
import reportsShot from '@/public/screenshots/reports.png';

const repoUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fd-ring';

const featureIcons = {
  dashboard: LayoutDashboard,
  tradeLog: ListChecks,
  calendar: CalendarDays,
  reports: BarChart3,
  playbook: BookOpen,
  import: Upload,
  tools: Calculator,
  ai: Bot,
  api: Plug,
  themes: MoonStar,
} as const;

const bentoFeatureIds = ['dashboard', 'tradeLog', 'calendar', 'reports'] as const;
const listFeatureIds = ['playbook', 'import', 'tools', 'ai', 'api', 'themes'] as const;

type FeatureId = (typeof bentoFeatureIds)[number] | (typeof listFeatureIds)[number];

interface TickerItem {
  label: string;
  value: string;
  tone: 'profit' | 'loss' | 'neutral';
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const locale = resolveLocale(lang);
  const t = await getTranslations({ locale, namespace: 'Home' });
  const ogImage = { url: '/screenshots/dashboard.png', width: 1440, height: 900 };

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: {
      canonical: `/${lang}`,
      languages: { en: '/en', 'zh-Hant': '/zh-Hant', 'zh-Hans': '/zh-Hans', ja: '/ja' },
    },
    openGraph: {
      title: t('metaTitle'),
      description: t('metaDescription'),
      url: `/${lang}`,
      siteName: appName,
      type: 'website',
      locale:
        locale === 'zh-Hant'
          ? 'zh_TW'
          : locale === 'zh-Hans'
            ? 'zh_CN'
            : locale === 'ja'
              ? 'ja_JP'
              : 'en_US',
      images: [ogImage],
    },
    twitter: {
      card: 'summary_large_image',
      title: t('metaTitle'),
      description: t('metaDescription'),
      images: [ogImage.url],
    },
  };
}

function GithubMark({ className }: { className?: string }) {
  return (
    <svg fill="currentColor" viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

/* Tailwind-site style section rule with crosshair markers at the frame edges. */
function CrossMark({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`absolute -top-[8.5px] hidden size-4 text-fd-muted-foreground/50 xl:block ${className}`}
      aria-hidden
    >
      <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function SectionRule() {
  return (
    <div aria-hidden className="relative border-t border-fd-border/60">
      <CrossMark className="-left-[8.5px]" />
      <CrossMark className="-right-[8.5px]" />
    </div>
  );
}

/* Chart-legend eyebrow: swatch square + mono label, like a series legend. */
function Eyebrow({
  label,
  tone = 'primary',
  centered = false,
}: {
  label: string;
  tone?: 'primary' | 'profit';
  centered?: boolean;
}) {
  return (
    <p
      className={`flex items-center gap-2 font-mono text-xs font-medium uppercase tracking-[0.18em] text-fd-muted-foreground ${centered ? 'justify-center' : ''}`}
    >
      <span
        aria-hidden
        className={`size-2 rounded-[2px] ${tone === 'profit' ? 'bg-tm-profit' : 'bg-fd-primary'}`}
      />
      {label}
    </p>
  );
}

/*
 * Signature: the journal plotted on the curve. An equity curve — drawdowns
 * included — draws itself behind the hero, with a trade entry annotated on it
 * the way journal notes annotate a session.
 */
function EquityCurve() {
  const line =
    'M0,368 L80,344 L140,354 L220,306 L290,322 L370,270 L440,288 L560,224 L640,246 L730,188 L820,208 L910,152 L1010,174 L1110,108 L1200,84';

  return (
    <svg
      viewBox="0 0 1200 420"
      preserveAspectRatio="none"
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[26rem] w-full sm:h-[30rem]"
    >
      <defs>
        <linearGradient id="tm-curve-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-fd-primary)" stopOpacity="0.14" />
          <stop offset="100%" stopColor="var(--color-fd-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path className="tm-curve-fill" d={`${line} L1200,420 L0,420 Z`} fill="url(#tm-curve-area)" />
      <path
        className="tm-curve-path text-fd-primary/50"
        d={line}
        pathLength={1}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
      {/* Light pulse traveling along the curve after it draws in */}
      <path
        className="tm-curve-pulse text-fd-primary"
        d={line}
        pathLength={1}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* Trade annotation — a journal entry pinned to the curve */}
      <g
        className="tm-annot font-mono max-sm:hidden"
        style={{ '--tm-delay': '2s' } as React.CSSProperties}
      >
        <circle cx="1110" cy="108" r="3.5" className="fill-tm-profit" />
        <text x="1052" y="88" fontSize="12" className="fill-tm-profit">
          +1.8R · A-setup
        </text>
      </g>
    </svg>
  );
}

/*
 * Glyph lattice — the shadcn.io hero-canvas pattern, in this product's
 * vocabulary: journal glyphs scattered at ~5% opacity across the panel, with
 * a radial mask keeping the center clear for the headline.
 */
const latticeGlyphs: [LucideIcon, string, string, number, number][] = [
  [TrendingUp, '5%', '6%', 22, -8],
  [CalendarDays, '8%', '22%', 16, 6],
  [DollarSign, '4%', '40%', 18, 0],
  [BarChart3, '7%', '58%', 20, 10],
  [Tag, '4%', '76%', 16, -12],
  [LineChart, '9%', '91%', 22, 6],
  [BookOpen, '24%', '3%', 18, 8],
  [Percent, '22%', '15%', 16, -6],
  [Clock, '27%', '86%', 18, 0],
  [Upload, '23%', '95%', 16, 10],
  [Calculator, '46%', '4%', 20, -10],
  [ListChecks, '50%', '13%', 16, 4],
  [LayoutDashboard, '45%', '88%', 18, -4],
  [Plug, '52%', '95%', 16, 8],
  [MoonStar, '68%', '6%', 16, -8],
  [LineChart, '72%', '17%', 20, 6],
  [Percent, '66%', '84%', 16, 12],
  [TrendingUp, '73%', '94%', 18, -6],
  [Clock, '88%', '10%', 16, 8],
  [DollarSign, '91%', '26%', 20, -4],
  [CalendarDays, '87%', '45%', 16, 6],
  [BarChart3, '92%', '62%', 18, -10],
  [Tag, '88%', '78%', 16, 4],
  [BookOpen, '91%', '92%', 20, -6],
];

function HeroLattice() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 hidden sm:block"
      style={{
        maskImage: 'radial-gradient(60% 55% at 50% 42%, transparent 38%, black 80%)',
      }}
    >
      {latticeGlyphs.map(([Icon, top, left, size, rotate], i) => (
        <Icon
          key={i}
          className="absolute text-fd-foreground/5"
          style={{ top, left, width: size, height: size, transform: `rotate(${rotate}deg)` }}
        />
      ))}
    </div>
  );
}

/* Decorative mini-visuals for the bento feature cards. */
function DecoSparkline() {
  return (
    <svg viewBox="0 0 240 56" aria-hidden className="mt-5 h-14 w-full">
      <path
        d="M0,46 L28,38 L52,42 L80,28 L104,33 L136,18 L164,24 L196,10 L240,4 L240,56 L0,56 Z"
        className="fill-tm-profit/10"
      />
      <path
        d="M0,46 L28,38 L52,42 L80,28 L104,33 L136,18 L164,24 L196,10 L240,4"
        fill="none"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
        className="stroke-tm-profit"
      />
    </svg>
  );
}

function DecoTradeRows() {
  const rows = [
    { sym: 'NQ', side: 'L', val: '+$312.50', win: true },
    { sym: 'ES', side: 'S', val: '−$85.00', win: false },
    { sym: 'CL', side: 'L', val: '+$1,204.10', win: true },
  ];
  return (
    <div aria-hidden className="mt-5 space-y-1.5 font-mono text-xs">
      {rows.map((r) => (
        <div
          key={r.sym}
          className="flex items-center justify-between rounded-md bg-fd-muted/60 px-3 py-1.5"
        >
          <span className="text-fd-muted-foreground">
            {r.sym} <span className="text-fd-muted-foreground/50">· {r.side}</span>
          </span>
          <span className={r.win ? 'text-tm-profit' : 'text-tm-loss'}>{r.val}</span>
        </div>
      ))}
    </div>
  );
}

function DecoHeatmap() {
  const cells = [
    'bg-tm-profit/70',
    'bg-tm-profit/30',
    'bg-tm-loss/50',
    'bg-tm-profit/90',
    'bg-fd-muted',
    'bg-tm-profit/40',
    'bg-tm-profit/60',
    'bg-tm-loss/30',
    'bg-tm-profit/80',
    'bg-tm-profit/25',
    'bg-fd-muted',
    'bg-tm-profit/55',
    'bg-tm-loss/60',
    'bg-tm-profit/95',
  ];
  return (
    <div aria-hidden className="mt-5 grid grid-cols-7 gap-1.5">
      {cells.map((c, i) => (
        <div key={i} className={`aspect-square rounded-[4px] ${c}`} />
      ))}
    </div>
  );
}

const statBars = [
  { label: 'WIN RATE', width: '59%', className: 'bg-fd-primary' },
  { label: 'PROFIT FACTOR', width: '73%', className: 'bg-tm-profit' },
  { label: 'EXPECTANCY', width: '46%', className: 'bg-fd-primary/60' },
];

const bentoDecos = {
  dashboard: DecoSparkline,
  tradeLog: DecoTradeRows,
  calendar: DecoHeatmap,
  reports: () => <StatBars bars={statBars} />,
} as const;

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale = resolveLocale(lang);
  setRequestLocale(locale);
  const t = await getTranslations('Home');
  const d = await getTranslations('Deploy');
  const isCjk = locale !== 'en';
  const badgeParts = t('badge')
    .split('·')
    .map((s) => s.trim());
  const ticker = t.raw('ticker') as TickerItem[];
  const tickerItems = [...ticker, ...ticker];
  const features = t.raw('features') as Record<FeatureId, { title: string; description: string }>;
  const comparison = t.raw('comparison') as { row: string; cloud: string; tm: string }[];
  const stack = t.raw('stack') as { layer: string; value: string }[];

  return (
    <>
      {/* Hero — one centered canvas panel (shadcn.io pattern): bordered muted
          surface, glyph lattice at the edges, content stacked in the middle */}
      <section className="px-6 pt-8 sm:pt-12">
        <div className="relative isolate overflow-hidden rounded-3xl border border-fd-border/60 bg-fd-card/40">
          <div aria-hidden className="tm-hero-grid pointer-events-none absolute inset-0 -z-20" />
          <HeroLattice />
          <EquityCurve />

          <div className="px-6 pb-14 pt-16 text-center sm:pb-16 sm:pt-24">
            <div
              className="tm-fade-up flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-mono text-xs text-fd-muted-foreground"
              style={{ '--tm-delay': '0s' } as React.CSSProperties}
            >
              {badgeParts.map((part, i) => (
                <span key={part} className="flex items-center gap-3">
                  {i > 0 && (
                    <span aria-hidden className="text-fd-muted-foreground/40">
                      /
                    </span>
                  )}
                  <span className="uppercase tracking-[0.15em]">{part}</span>
                </span>
              ))}
            </div>
            <h1 className="mx-auto mt-6 max-w-3xl text-balance font-display text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              <WordReveal text={t('heroTitleLine1')} perChar={isCjk} delay={0.15} />
              <br />
              <WordReveal
                text={t('heroTitleLine2')}
                perChar={isCjk}
                delay={0.4}
                className="text-fd-muted-foreground"
              />
            </h1>
            <p
              className="tm-fade-up mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-fd-muted-foreground"
              style={{ '--tm-delay': '0.55s' } as React.CSSProperties}
            >
              {t('heroSubtitle')}
            </p>
            <div
              className="tm-fade-up mt-8 flex flex-wrap items-center justify-center gap-3"
              style={{ '--tm-delay': '0.7s' } as React.CSSProperties}
            >
              <Link
                href={`/${lang}/docs`}
                className={`inline-flex items-center gap-2 rounded-xl bg-fd-primary px-6 py-3 text-sm font-semibold text-fd-primary-foreground transition-colors hover:bg-fd-primary/90 ${focusRing}`}
              >
                {t('ctaGetStarted')}
                <ArrowRight className="size-4" />
              </Link>
              <a
                href={demoConfig.url}
                rel="noreferrer"
                className={`inline-flex items-center gap-2 rounded-xl border border-fd-border bg-fd-background px-6 py-3 text-sm font-medium transition-colors hover:bg-fd-accent ${focusRing}`}
              >
                {t('ctaDemo')}
                <ArrowUpRight className="size-4 opacity-60" />
              </a>
              <Link
                href={repoUrl}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-fd-muted-foreground transition-colors hover:text-fd-foreground ${focusRing}`}
              >
                <GithubMark className="size-4" />
                {t('ctaGithub')}
              </Link>
            </div>
            <p
              className="tm-fade-up mt-4 font-mono text-xs text-fd-muted-foreground"
              style={{ '--tm-delay': '0.85s' } as React.CSSProperties}
            >
              {t('demoCreds')}{' '}
              <span className="text-fd-foreground">{demoConfig.user}</span>
              <span className="text-fd-muted-foreground/50"> / </span>
              <span className="text-fd-foreground">{demoConfig.password}</span>
            </p>
            {/* Stat row — bold value, muted label */}
            <div
              className="tm-fade-up mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-2"
              style={{ '--tm-delay': '1s' } as React.CSSProperties}
            >
              {ticker.slice(0, 3).map((s) => (
                <span key={s.label} className="flex items-baseline gap-2 text-sm">
                  <span className="font-semibold tabular-nums text-fd-foreground">{s.value}</span>
                  <span className="text-fd-muted-foreground">{s.label}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        <ZoomFrame className="mt-12 pb-20">
          <BrowserFrame
            glare
            image={dashboardShot}
            lightImage={dashboardLightShot}
            alt="TraderMemos dashboard — equity curve, annual P&L goal, expectancy and win-rate stats"
            sizes="(max-width: 1200px) 100vw, 1104px"
            priority
          />
        </ZoomFrame>
      </section>

      <SectionRule />

      {/* Metrics ticker — the numbers a daily review runs on, as drifting glass chips */}
      <div aria-hidden className="select-none overflow-hidden py-5">
        <div
          className="tm-ticker-track flex w-max items-center gap-3 pr-3"
          style={{
            maskImage:
              'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
          }}
        >
          {tickerItems.map((s, i) => (
            <span
              key={i}
              className="flex items-center gap-2.5 whitespace-nowrap rounded-full bg-fd-card px-4 py-1.5 font-mono text-xs shadow-sm ring-1 ring-fd-border/70"
            >
              <span className="uppercase tracking-[0.15em] text-fd-muted-foreground">
                {s.label}
              </span>
              <span
                className={
                  s.tone === 'profit'
                    ? 'text-tm-profit'
                    : s.tone === 'loss'
                      ? 'text-tm-loss'
                      : 'text-fd-foreground'
                }
              >
                {s.value}
              </span>
            </span>
          ))}
        </div>
      </div>

      <SectionRule />

      {/* Why — scroll-scrubbed manifesto, then the comparison ledger */}
      <section className="px-6 py-24">
        <Reveal className="text-center">
          <Eyebrow label={t('eyebrowWhy')} centered />
          <h2 className="mt-4 text-balance font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {t('whyHeading')}
          </h2>
        </Reveal>
        <ScrollFillText
          text={t('whyBody')}
          perChar={isCjk}
          className="mx-auto mt-8 max-w-4xl text-center font-display text-2xl font-medium leading-snug tracking-tight text-fd-foreground sm:text-3xl"
        />
        <Reveal className="mt-14" delay={0.1}>
          {/* Mobile: the ledger stacks — one card per category, TM value highlighted */}
          <div className="space-y-3 sm:hidden">
            {comparison.map((r) => (
              <div key={r.row} className="rounded-xl border border-fd-border/60 bg-fd-card p-4">
                <p className="font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-fd-muted-foreground">
                  {r.row}
                </p>
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-baseline justify-between gap-6 px-3">
                    <span className="shrink-0 text-xs text-fd-muted-foreground">
                      {t('comparisonHeaderCloud')}
                    </span>
                    <span className="text-right text-sm text-fd-muted-foreground">{r.cloud}</span>
                  </div>
                  <div className="flex items-baseline justify-between gap-6 rounded-lg bg-fd-primary/10 px-3 py-2.5">
                    <span className="shrink-0 text-xs font-medium text-fd-primary">
                      {t('comparisonHeaderTm')}
                    </span>
                    <span className="text-right text-sm font-medium">{r.tm}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mx-auto hidden max-w-3xl overflow-x-auto rounded-xl border border-fd-border/60 bg-fd-card p-2 sm:block">
            <table className="w-full min-w-[28rem] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="font-mono text-[11px] uppercase tracking-[0.15em]">
                  <th scope="col" className="px-4 pb-3 pt-3 font-medium text-fd-muted-foreground">
                    {t('comparisonHeaderFeature')}
                  </th>
                  <th scope="col" className="px-4 pb-3 pt-3 font-medium text-fd-muted-foreground">
                    {t('comparisonHeaderCloud')}
                  </th>
                  <th
                    scope="col"
                    className="rounded-t-lg bg-fd-primary/10 px-4 pb-3 pt-3 font-medium text-fd-primary"
                  >
                    {t('comparisonHeaderTm')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((r, i) => {
                  const last = i === comparison.length - 1;
                  return (
                    <tr key={r.row}>
                      <th scope="row" className="px-4 py-3.5 text-left font-medium">
                        {r.row}
                      </th>
                      <td className="px-4 py-3.5 text-fd-muted-foreground">{r.cloud}</td>
                      <td
                        className={`bg-fd-primary/10 px-4 py-3.5 font-medium ${
                          last ? 'rounded-b-lg' : ''
                        }`}
                      >
                        {r.tm}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Reveal>
      </section>

      <SectionRule />

      {/* Features */}
      <section className="px-6 py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Eyebrow label={t('eyebrowFeatures')} centered />
          <h2 className="mt-4 text-balance font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {t('featuresHeading')}
          </h2>
          <p className="mt-4 text-pretty leading-relaxed text-fd-muted-foreground">
            {t('featuresSub')}
          </p>
        </Reveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {bentoFeatureIds.map((id, i) => {
            const Icon = featureIcons[id];
            const Deco = bentoDecos[id];
            const { title, description } = features[id];
            return (
              <Reveal key={id} delay={i * 0.08} className="h-full">
                <GlowCard className="flex h-full flex-col rounded-2xl border border-fd-border/60 bg-fd-card p-6">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-fd-primary/10">
                    <Icon className="size-4.5 text-fd-primary" />
                  </div>
                  <h3 className="mt-4 font-medium">{title}</h3>
                  <p className="mt-1.5 flex-1 text-sm leading-relaxed text-fd-muted-foreground">
                    {description}
                  </p>
                  <Deco />
                </GlowCard>
              </Reveal>
            );
          })}
        </div>

        <Reveal className="mt-12" delay={0.1}>
          <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {listFeatureIds.map((id) => {
              const Icon = featureIcons[id];
              const { title, description } = features[id];
              return (
                <div key={id} className="flex gap-4">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-fd-muted">
                    <Icon className="size-4.5 text-fd-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-medium">{title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-fd-muted-foreground">
                      {description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Reveal>
      </section>

      <SectionRule />

      {/* A look inside */}
      <section className="px-6 py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Eyebrow label={t('eyebrowInside')} centered />
          <h2 className="mt-4 text-balance font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {t('lookInsideHeading')}
          </h2>
        </Reveal>
        <div className="mt-12 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2">
          <Reveal>
            <figure>
              <BrowserFrame
                glare
                image={tradesShot}
                alt="Trade log with per-trade P&L, hold time, and tags"
                sizes="(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 540px"
              />
              <figcaption className="mt-4 text-sm leading-relaxed text-fd-muted-foreground">
                <strong className="text-fd-foreground">{t('tradeLogCaptionTitle')}</strong> —{' '}
                {t('tradeLogCaptionBody')}
              </figcaption>
            </figure>
          </Reveal>
          <Reveal delay={0.12}>
            <figure>
              <BrowserFrame
                glare
                image={calendarShot}
                alt="P&L calendar heatmap by day and week"
                sizes="(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 540px"
              />
              <figcaption className="mt-4 text-sm leading-relaxed text-fd-muted-foreground">
                <strong className="text-fd-foreground">{t('calendarCaptionTitle')}</strong> —{' '}
                {t('calendarCaptionBody')}
              </figcaption>
            </figure>
          </Reveal>
        </div>
        <figure className="mt-12">
          <ZoomFrame>
            <BrowserFrame
              glare
              image={reportsShot}
              alt="Reports — equity curve, profit factor gauge, win-rate donut, annual goal pacing"
              sizes="(max-width: 1200px) 100vw, 1104px"
            />
          </ZoomFrame>
          <figcaption className="mt-4 text-sm leading-relaxed text-fd-muted-foreground">
            <strong className="text-fd-foreground">{t('reportsCaptionTitle')}</strong> —{' '}
            {t('reportsCaptionBody')}
          </figcaption>
        </figure>
      </section>

      <SectionRule />

      {/* Tech stack — read like a config, because it is one */}
      <section className="px-6 py-24">
        <Reveal>
          <div className="grid gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-16">
            <div>
              <Eyebrow label={t('eyebrowStack')} />
              <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                {t('techStackHeading')}
              </h2>
            </div>
            <div className="relative self-center">
              <div className="overflow-hidden rounded-xl bg-zinc-950 ring-1 ring-white/10">
                <div className="flex items-center gap-2 px-4 py-2.5">
                  <span aria-hidden className="size-2.5 rounded-full bg-zinc-700" />
                  <span aria-hidden className="size-2.5 rounded-full bg-zinc-700" />
                  <span aria-hidden className="size-2.5 rounded-full bg-zinc-700" />
                  <span className="mx-auto rounded-md bg-zinc-900 px-6 py-0.5 font-mono text-[11px] text-zinc-500">
                    tradermemos/stack.yaml
                  </span>
                </div>
                <dl className="px-5 pb-6 pt-2 font-mono text-[13px] leading-8">
                  <div aria-hidden className="flex items-baseline gap-4">
                    <span className="w-4 shrink-0 select-none text-right text-zinc-700">1</span>
                    <span className="text-zinc-600">{t('stackComment')}</span>
                  </div>
                  {stack.map(({ layer, value }, i) => (
                    <div key={layer} className="flex items-baseline gap-4">
                      <span
                        aria-hidden
                        className="w-4 shrink-0 select-none text-right text-zinc-700"
                      >
                        {i + 2}
                      </span>
                      <dt className="shrink-0 lowercase text-sky-400">
                        {layer}
                        <span className="text-zinc-600">:</span>
                      </dt>
                      <dd className="flex-1 text-zinc-300">
                        {value.split(' · ').map((tok, j, arr) => (
                          <span key={j} className="whitespace-nowrap">
                            {tok}
                            {j < arr.length - 1 ? (
                              <span className="whitespace-normal text-zinc-600"> · </span>
                            ) : null}
                          </span>
                        ))}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <SectionRule />

      {/* Deploy strip — one-click buttons + the clone-free compose path */}
      <section className="px-6 py-24">
        <Reveal>
          <div className="grid gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-16">
            <div>
              <Eyebrow label={d('eyebrow')} />
              <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                {d('heading')}
              </h2>
              <p className="mt-4 text-pretty leading-relaxed text-fd-muted-foreground">
                {d('sub')}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                {(
                  [
                    [
                      'Vercel',
                      'https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fsinhong2011%2FTraderMemos&root-directory=web&project-name=tradermemos&repository-name=tradermemos&env=VITE_API',
                    ],
                    [
                      'Cloudflare',
                      'https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2Fsinhong2011%2FTraderMemos%2Ftree%2Fmain%2Fweb',
                    ],
                    [
                      'Netlify',
                      'https://app.netlify.com/start/deploy?repository=https://github.com/sinhong2011/TraderMemos',
                    ],
                    [
                      'Railway',
                      'https://railway.com/new/template?template=https%3A%2F%2Fgithub.com%2Fsinhong2011%2FTraderMemos',
                    ],
                  ] as const
                ).map(([name, href]) => (
                  <a
                    key={name}
                    href={href}
                    rel="noreferrer"
                    className={`inline-flex items-center gap-2 rounded-lg bg-fd-secondary px-5 py-2.5 text-sm font-medium text-fd-secondary-foreground ring-1 ring-fd-border transition hover:-translate-y-0.5 hover:bg-fd-accent ${focusRing}`}
                  >
                    {name}
                    <ArrowRight className="size-3.5 opacity-60" />
                  </a>
                ))}
                <a
                  href={repoUrl}
                  rel="noreferrer"
                  className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-fd-muted-foreground transition-colors hover:text-fd-foreground ${focusRing}`}
                >
                  <Star className="size-4" />
                  {d('star')}
                </a>
              </div>
              <p className="mt-4 text-sm text-fd-muted-foreground/80">{d('note')}</p>
            </div>
            <div className="relative self-center">
              <div className="overflow-hidden rounded-xl bg-zinc-950 ring-1 ring-white/10">
                <div className="flex items-center gap-2 px-4 py-2.5">
                  <span aria-hidden className="size-2.5 rounded-full bg-zinc-700" />
                  <span aria-hidden className="size-2.5 rounded-full bg-zinc-700" />
                  <span aria-hidden className="size-2.5 rounded-full bg-zinc-700" />
                  <span className="mx-auto rounded-md bg-zinc-900 px-6 py-0.5 font-mono text-[11px] text-zinc-500">
                    ~/tradermemos — zsh
                  </span>
                </div>
                <TypedTerminal
                  commands={[
                    'curl -fsSLO https://raw.githubusercontent.com/sinhong2011/TraderMemos/main/docker-compose.yml',
                    'docker compose up -d',
                  ]}
                  ready="tradermemos ready"
                  url="http://localhost:3000"
                />
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <SectionRule />

      {/* License CTA */}
      <section className="px-6 py-24">
        <Reveal>
          {/* Statement band — a second bordered canvas carrying the glyph lattice */}
          <div className="relative isolate overflow-hidden rounded-3xl border border-fd-border/60 bg-fd-card/40 px-8 pb-14 pt-14 text-center sm:px-12 sm:pb-16 sm:pt-16">
            <HeroLattice />
            <h2 className="text-balance font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              {t('licenseHeading')}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-pretty leading-relaxed text-fd-muted-foreground">
              {t('licenseBody')}
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <p className="inline-block rounded-xl bg-zinc-950 px-4 py-3 font-mono text-sm text-zinc-300 ring-1 ring-white/10">
                <span aria-hidden className="select-none text-tm-profit">
                  ${' '}
                </span>
                make up
              </p>
              <Link
                href={`/${lang}/docs`}
                className={`inline-flex shrink-0 items-center gap-2 rounded-xl bg-fd-primary px-6 py-3 text-sm font-semibold text-fd-primary-foreground transition-colors hover:bg-fd-primary/90 ${focusRing}`}
              >
                {t('readDocs')}
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
