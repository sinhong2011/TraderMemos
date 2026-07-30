import { useId } from "react";
import { cn } from "@/lib/cn";

type AppLogoProps = {
  size?: number;
  className?: string;
  /** Rounded app-icon tile (nav, favicon). */
  showBackground?: boolean;
  title?: string;
};

/**
 * TraderMemos mark — "the T being typed": glass T monogram with a glowing
 * green terminal block cursor, on a violet gradient tile where an etched
 * equity step-line climbs behind the T to the cursor.
 * Keep in sync with web/public/favicon.svg and brand/app-icon.svg
 * (favicon additionally carries a film-grain layer, invisible at nav sizes).
 */
export function AppLogo({
  size = 32,
  className,
  showBackground = true,
  title = "TraderMemos",
}: AppLogoProps) {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;
  const url = (name: string) => `url(#${id(name)})`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      className={cn("shrink-0", className)}
    >
      <title>{title}</title>

      <defs>
        <linearGradient id={id("bg")} x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#b591ff" />
          <stop offset="0.45" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#5426c9" />
        </linearGradient>
        <radialGradient id={id("light")} cx="0.3" cy="-0.1" r="1.1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.30" />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("vig")} cx="0.5" cy="1.15" r="1">
          <stop offset="0" stopColor="#2a0f6e" stopOpacity="0.45" />
          <stop offset="0.7" stopColor="#2a0f6e" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id("mark")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#e6dff8" />
        </linearGradient>
        <linearGradient id={id("cur")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a2ffc4" />
          <stop offset="0.5" stopColor="#4ade80" />
          <stop offset="1" stopColor="#23bd68" />
        </linearGradient>
        <radialGradient id={id("glow")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#7bffae" stopOpacity="0.65" />
          <stop offset="1" stopColor="#7bffae" stopOpacity="0" />
        </radialGradient>
        <filter id={id("sh")} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodColor="#31137e" floodOpacity="0.6" />
        </filter>
      </defs>

      {showBackground && (
        <>
          <rect width="32" height="32" rx="7" fill={url("bg")} />
          <rect width="32" height="32" rx="7" fill={url("light")} />
          <rect width="32" height="32" rx="7" fill={url("vig")} />
          {/* etched equity steps climbing behind the T to the cursor */}
          <path
            d="M4 27 H9.5 V23 H14.5 V19 H19.5 V14.6 H23.9 V11.6"
            stroke="rgba(255,255,255,0.30)"
            strokeWidth="0.9"
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </>
      )}

      {/* extruded glass T */}
      <g filter={url("sh")}>
        <rect x="5.75" y="7.9" width="14.5" height="4.25" rx="1.1" fill="#5b34c9" opacity="0.8" />
        <rect x="10.875" y="7.9" width="4.25" height="18" rx="1.1" fill="#5b34c9" opacity="0.8" />
        <rect x="5.75" y="7" width="14.5" height="4.25" rx="1.1" fill={url("mark")} />
        <rect x="10.875" y="7" width="4.25" height="17.4" rx="1.1" fill={url("mark")} />
      </g>
      <rect x="5.75" y="7" width="14.5" height="1" rx="0.5" fill="#fff" opacity="0.5" />

      {/* glowing terminal cursor */}
      <circle cx="23.9" cy="9.2" r="7.6" fill={url("glow")} />
      <g filter={url("sh")}>
        <rect x="21.7" y="6.85" width="4.4" height="4.6" rx="1.2" fill={url("cur")} />
      </g>
      <rect x="22.15" y="7.3" width="3.5" height="1" rx="0.5" fill="#fff" opacity="0.55" />

      {showBackground && (
        <rect
          x="0.5"
          y="0.5"
          width="31"
          height="31"
          rx="6.5"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="1"
        />
      )}
    </svg>
  );
}
