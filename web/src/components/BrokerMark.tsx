import { useState } from "react";
import type { BrokerDef } from "@/lib/brokers";
import { cn } from "@/lib/cn";

const SIZES = {
  sm: "size-8 text-[11px] rounded-md",
  md: "size-10 text-[13px] rounded-lg",
} as const;

/**
 * A broker's mark: the logo at `public/broker-logos/<key>.svg` when the
 * deployment ships one, otherwise a monogram tile tinted with the broker's
 * colour.
 *
 * The repo ships no third-party logo files — broker marks are trademarks and
 * most are only published under non-free terms, which is not something a
 * self-hosted install should inherit from us. Dropping `<key>.svg` into
 * `web/public/broker-logos/` lights it up with no code change; the tile is a
 * designed fallback, not a placeholder.
 */
export function BrokerMark({
  broker,
  size = "md",
  className,
}: {
  broker: BrokerDef;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden font-semibold leading-none",
        SIZES[size],
        className,
      )}
      style={
        logoFailed
          ? // 14% tint reads as a surface in both themes, where a solid brand
            // fill would fight the calm card palette.
            { backgroundColor: `${broker.brand}24`, color: broker.brand }
          : undefined
      }
      aria-hidden
    >
      {logoFailed ? (
        broker.monogram
      ) : (
        <img
          src={`/broker-logos/${broker.key}.svg`}
          alt=""
          className="size-full object-contain"
          onError={() => setLogoFailed(true)}
        />
      )}
    </span>
  );
}
