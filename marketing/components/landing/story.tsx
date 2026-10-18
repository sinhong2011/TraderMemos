'use client';

import { useEffect, useRef, useState } from 'react';
import Image, { type StaticImageData } from 'next/image';
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react';

const easeOutExpo = [0.22, 1, 0.36, 1] as const;

/**
 * Hero spotlight: a soft brand-blue light that trails the pointer across the
 * hero canvas. Coordinates go out as CSS variables; .tm-spotlight paints it,
 * so touch and reduced-motion users see the resting glow only.
 */
export function Spotlight({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className={`tm-spotlight ${className ?? ''}`}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!el || e.pointerType !== 'mouse') return;
        const r = el.getBoundingClientRect();
        el.style.setProperty('--tm-sx', `${e.clientX - r.left}px`);
        el.style.setProperty('--tm-sy', `${e.clientY - r.top}px`);
      }}
    >
      {children}
    </div>
  );
}

/**
 * Hero screenshot stage: the frame lifts out of a tilt as the page scrolls,
 * while the journal chips around it drift at their own depth.
 */
export function HeroStage({
  children,
  chips,
}: {
  children: React.ReactNode;
  chips: React.ReactNode[];
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const smooth = useSpring(scrollYProgress, { stiffness: 110, damping: 26, mass: 0.4 });
  const rotateX = useTransform(smooth, [0, 0.42], [16, 0]);
  const scale = useTransform(smooth, [0, 0.42], [0.9, 1]);
  const y = useTransform(smooth, [0, 0.42], [60, 0]);
  // Each chip floats at its own depth, so they part from the frame at different speeds.
  const chipY = [
    useTransform(smooth, [0, 1], [0, -90]),
    useTransform(smooth, [0, 1], [0, -150]),
    useTransform(smooth, [0, 1], [0, -60]),
    useTransform(smooth, [0, 1], [0, -120]),
  ];
  const chipSpots = [
    '-left-14 top-[14%]',
    '-right-14 top-[26%]',
    '-right-10 top-[64%]',
    '-left-12 top-[58%]',
  ];

  if (reduce) {
    return <div className="relative">{children}</div>;
  }

  return (
    <div ref={ref} className="relative" style={{ perspective: '1600px' }}>
      <motion.div style={{ rotateX, scale, y, transformOrigin: 'center top' }}>{children}</motion.div>
      {chips.map((chip, i) => (
        <motion.div
          key={i}
          aria-hidden
          style={{ y: chipY[i % chipY.length] }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: easeOutExpo, delay: 1.1 + i * 0.12 }}
          className={`absolute z-20 hidden xl:block ${chipSpots[i % chipSpots.length]}`}
        >
          {chip}
        </motion.div>
      ))}
    </div>
  );
}

/** Number that counts up from zero the first time it scrolls into view. */
export function CountUp({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  className,
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -60px 0px' });
  const fmt = (n: number) =>
    `${prefix}${n.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}${suffix}`;
  const [shown, setShown] = useState(fmt(value));

  useEffect(() => {
    if (reduce || !inView) return;
    const controls = animate(0, value, {
      duration: 1.4,
      ease: easeOutExpo,
      onUpdate: (n) => setShown(fmt(n)),
    });
    return () => controls.stop();
    // fmt is derived from the same props as value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, reduce, value]);

  return (
    <span ref={ref} className={className}>
      {shown}
    </span>
  );
}

export interface LoopStep {
  title: string;
  body: string;
  tag: string;
}

/**
 * The review loop, told on scroll: the step list pins on the left while the
 * matching screen crossfades on the right. Each step owns an equal slice of
 * the section's scroll range. Below lg the steps simply stack with their shot.
 */
export function LoopStory({
  steps,
  images,
  alts,
}: {
  steps: LoopStep[];
  images: StaticImageData[];
  alts: string[];
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const bar = useSpring(scrollYProgress, { stiffness: 140, damping: 30 });

  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    setActive(Math.min(steps.length - 1, Math.max(0, Math.floor(p * steps.length))));
  });

  return (
    <>
      {/* Small screens: plain stack */}
      <div className="space-y-14 lg:hidden">
        {steps.map((s, i) => (
          <div key={s.title}>
            <StepText step={s} index={i} active />
            <div className="mt-6 overflow-hidden rounded-xl ring-1 ring-fd-border/60">
              <Image src={images[i]!} alt={alts[i]!} sizes="100vw" className="w-full" />
            </div>
          </div>
        ))}
      </div>

      {/* lg+: pinned story */}
      <div ref={ref} className="relative hidden lg:block" style={{ height: `${steps.length * 85}vh` }}>
        <div className="sticky top-0 flex h-screen items-center">
          <div className="grid w-full grid-cols-[minmax(0,5fr)_minmax(0,8fr)] items-center gap-14">
            <div className="relative flex gap-6">
              {/* progress rail */}
              <div aria-hidden className="relative w-px shrink-0 bg-fd-border">
                <motion.div
                  className="absolute inset-x-0 top-0 origin-top bg-fd-primary"
                  style={{ height: '100%', scaleY: reduce ? 1 : bar }}
                />
              </div>
              <ol className="space-y-9">
                {steps.map((s, i) => (
                  <li key={s.title}>
                    <StepText step={s} index={i} active={i === active} />
                  </li>
                ))}
              </ol>
            </div>
            <div className="relative aspect-[1440/900] overflow-hidden rounded-2xl bg-zinc-950 shadow-2xl shadow-black/40 ring-1 ring-white/10">
              <AnimatePresence initial={false} mode="popLayout">
                <motion.div
                  key={active}
                  className="absolute inset-0"
                  initial={reduce ? false : { opacity: 0, scale: 1.04, filter: 'blur(10px)' }}
                  animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                  exit={reduce ? undefined : { opacity: 0, scale: 0.98, filter: 'blur(6px)' }}
                  transition={{ duration: 0.6, ease: easeOutExpo }}
                >
                  <Image
                    src={images[active]!}
                    alt={alts[active]!}
                    fill
                    sizes="(max-width: 1536px) 60vw, 900px"
                    className="object-cover object-top"
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function StepText({ step, index, active }: { step: LoopStep; index: number; active: boolean }) {
  return (
    <div className={`transition-opacity duration-500 ${active ? 'opacity-100' : 'opacity-35'}`}>
      <p className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.18em] text-fd-muted-foreground">
        <span className={active ? 'text-fd-primary' : ''}>{String(index + 1).padStart(2, '0')}</span>
        <span aria-hidden className="h-px w-6 bg-fd-border" />
        {step.tag}
      </p>
      <h3 className="mt-3 font-display text-2xl font-semibold tracking-tight">{step.title}</h3>
      <p className="mt-2 max-w-md text-pretty leading-relaxed text-fd-muted-foreground">{step.body}</p>
    </div>
  );
}

/** Two phones that drift apart vertically as the section scrolls past. */
export function PhonePair({
  front,
  back,
  frontAlt,
  backAlt,
}: {
  front: StaticImageData;
  back: StaticImageData;
  frontAlt: string;
  backAlt: string;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const smooth = useSpring(scrollYProgress, { stiffness: 100, damping: 24 });
  const yFront = useTransform(smooth, [0, 1], [70, -70]);
  const yBack = useTransform(smooth, [0, 1], [-30, 50]);
  const rotate = useTransform(smooth, [0, 1], [-2, 4]);

  return (
    <div ref={ref} className="relative mx-auto flex h-[34rem] w-full max-w-md items-center justify-center sm:h-[38rem]">
      <div
        aria-hidden
        className="absolute inset-x-10 top-1/2 h-64 -translate-y-1/2 rounded-full bg-fd-primary/25 blur-3xl"
      />
      <motion.div
        style={reduce ? undefined : { y: yBack, rotate }}
        className="absolute left-[8%] top-[6%] w-[48%] sm:left-[6%]"
      >
        <Phone image={back} alt={backAlt} dim />
      </motion.div>
      <motion.div style={reduce ? undefined : { y: yFront }} className="absolute right-[6%] top-[14%] w-[52%]">
        <Phone image={front} alt={frontAlt} />
      </motion.div>
    </div>
  );
}

function Phone({ image, alt, dim = false }: { image: StaticImageData; alt: string; dim?: boolean }) {
  return (
    <div
      className={`overflow-hidden rounded-[2.2rem] bg-zinc-950 p-1.5 shadow-2xl shadow-black/50 ring-1 ring-white/15 ${
        dim ? 'opacity-80' : ''
      }`}
    >
      <Image src={image} alt={alt} sizes="240px" className="w-full rounded-[1.8rem]" />
    </div>
  );
}
