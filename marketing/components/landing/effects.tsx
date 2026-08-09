'use client';

import { useRef } from 'react';

/**
 * Cursor-tracking glow card: a radial border highlight and a soft interior
 * wash follow the pointer (the Aceternity "card spotlight" pattern). The
 * component only forwards pointer coordinates as CSS variables — all painting
 * happens in .tm-glow-card's pseudo-elements, so touch devices and
 * reduced-motion users simply see the plain card.
 */
export function GlowCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      className={`tm-glow-card ${className ?? ''}`}
      onMouseMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty('--tm-x', `${e.clientX - r.left}px`);
        el.style.setProperty('--tm-y', `${e.clientY - r.top}px`);
      }}
    >
      {children}
    </div>
  );
}
