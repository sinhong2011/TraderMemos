'use client';

import { useEffect, useRef, useState } from 'react';
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'motion/react';

const easeOutExpo = [0.22, 1, 0.36, 1] as const;

/** Fade-and-rise once when the element scrolls into view. */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -80px 0px' }}
      transition={{ duration: 0.7, ease: easeOutExpo, delay }}
    >
      {children}
    </motion.div>
  );
}

/**
 * GSAP-style staggered word entrance for display headlines.
 * Splits on spaces for latin text, per-character for CJK.
 */
export function WordReveal({
  text,
  className,
  delay = 0,
  perChar = false,
}: {
  text: string;
  className?: string;
  delay?: number;
  perChar?: boolean;
}) {
  const reduce = useReducedMotion();
  const units = perChar ? Array.from(text) : text.split(' ');

  if (reduce) return <span className={className}>{text}</span>;

  return (
    <span className={className} aria-label={text}>
      {units.map((unit, i) => (
        <span key={i} className="inline-block overflow-hidden align-bottom" aria-hidden>
          <motion.span
            className="inline-block"
            initial={{ y: '110%' }}
            animate={{ y: 0 }}
            transition={{
              duration: 0.65,
              ease: easeOutExpo,
              delay: delay + i * (perChar ? 0.035 : 0.07),
            }}
          >
            {unit}
            {!perChar && i < units.length - 1 ? ' ' : ''}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

function FillUnit({
  progress,
  range,
  spaced,
  children,
}: {
  progress: MotionValue<number>;
  range: [number, number];
  spaced: boolean;
  children: string;
}) {
  const opacity = useTransform(progress, range, [0.18, 1]);
  return (
    <>
      <motion.span style={{ opacity }} className="inline">
        {children}
      </motion.span>
      {spaced ? ' ' : ''}
    </>
  );
}

/**
 * Scroll-scrubbed paragraph: words brighten from muted to full as the
 * reader scrolls through — the GSAP text-fill pattern.
 */
export function ScrollFillText({
  text,
  className,
  perChar = false,
}: {
  text: string;
  className?: string;
  perChar?: boolean;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.9', 'end 0.45'],
  });
  const units = perChar ? Array.from(text) : text.split(' ');

  if (reduce) return <p className={className}>{text}</p>;

  return (
    <p ref={ref} className={className}>
      {units.map((unit, i) => (
        <FillUnit
          key={i}
          progress={scrollYProgress}
          range={[i / units.length, Math.min(1, (i + 1.5) / units.length)]}
          spaced={!perChar && i < units.length - 1}
        >
          {unit}
        </FillUnit>
      ))}
    </p>
  );
}

/**
 * Scroll-linked presentation for large screenshots: rises, flattens from a
 * slight tilt, and scales to full size as it enters the viewport.
 */
export function ZoomFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 1.05', 'start 0.35'],
  });
  const smooth = useSpring(scrollYProgress, { stiffness: 120, damping: 24, mass: 0.4 });
  const scale = useTransform(smooth, [0, 1], [0.94, 1]);
  const rotateX = useTransform(smooth, [0, 1], [7, 0]);
  const y = useTransform(smooth, [0, 1], [48, 0]);

  if (reduce) return <div className={className}>{children}</div>;

  return (
    <div ref={ref} className={className} style={{ perspective: '1400px' }}>
      <motion.div style={{ scale, rotateX, y, transformOrigin: 'center top' }}>
        {children}
      </motion.div>
    </div>
  );
}

/** Metric bars that grow to their value when scrolled into view. */
export function StatBars({
  bars,
}: {
  bars: { label: string; width: string; className: string }[];
}) {
  const reduce = useReducedMotion();
  return (
    <div aria-hidden className="mt-5 space-y-2.5">
      {bars.map((b, i) => (
        <div key={b.label} className="flex items-center gap-3">
          <span className="w-28 shrink-0 font-mono text-[10px] tracking-wider text-fd-muted-foreground">
            {b.label}
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fd-muted">
            {reduce ? (
              <div className={`h-full rounded-full ${b.className}`} style={{ width: b.width }} />
            ) : (
              <motion.div
                className={`h-full rounded-full ${b.className}`}
                initial={{ width: 0 }}
                whileInView={{ width: b.width }}
                viewport={{ once: true, margin: '0px 0px -60px 0px' }}
                transition={{ duration: 0.9, ease: easeOutExpo, delay: 0.2 + i * 0.12 }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Terminal body that types its commands, then prints the ready line.
 * Renders the finished state on the server and for reduced motion.
 */
export function TypedTerminal({
  commands,
  ready,
  url,
}: {
  commands: string[];
  ready: string;
  url: string;
}) {
  const reduce = useReducedMotion();
  const [typed, setTyped] = useState(-1); // -1 = SSR/static, chars typed otherwise
  const total = commands.reduce((n, c) => n + c.length, 0);
  const done = typed < 0 || typed >= total;

  useEffect(() => {
    if (reduce) return;
    let n = 0;
    const timer = setInterval(() => {
      n += 1 + Math.floor(Math.random() * 2);
      setTyped(Math.min(n, total));
      if (n >= total) clearInterval(timer);
    }, 24);
    return () => clearInterval(timer);
  }, [reduce, total]);

  const shownCount = typed < 0 ? total : typed;
  const lines = commands.map((cmd, i) => {
    const start = commands.slice(0, i).reduce((n, c) => n + c.length, 0);
    const visible = Math.min(Math.max(shownCount - start, 0), cmd.length);
    return {
      shown: cmd.slice(0, visible),
      active: shownCount > start && shownCount < start + cmd.length,
      prompt: i === 0 || shownCount >= start,
    };
  });

  return (
    <pre className="min-h-[10rem] overflow-x-auto px-5 pb-6 pt-2 font-mono text-[13px] leading-7 text-zinc-300">
      <code>
        {lines.map((l, i) => (
          <span key={i} className="block min-h-7 whitespace-pre-wrap [overflow-wrap:anywhere]">
            {l.prompt ? <span className="select-none text-tm-profit">$ </span> : null}
            {l.shown}
            {l.active ? <span className="tm-caret" aria-hidden /> : null}
          </span>
        ))}
        <motion.span
          className="mt-2 block whitespace-pre-wrap [overflow-wrap:anywhere]"
          initial={false}
          animate={{ opacity: done ? 1 : 0 }}
          transition={{ duration: 0.5 }}
        >
          <span className="text-zinc-600">
            ✓ {ready} →{' '}
          </span>
          <span className="text-fd-primary">{url}</span>
        </motion.span>
      </code>
    </pre>
  );
}
