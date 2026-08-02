import { cn } from "@/lib/cn";
import appIcon from "@/assets/app-icon.png";
import appIconSmall from "@/assets/app-icon-small.png";

type AppLogoProps = {
  size?: number;
  className?: string;
  title?: string;
};

/**
 * TraderMemos app-icon tile — white T over a blue gradient with rising
 * candlesticks and mini P&L bars. Rendered from the raster master; keep
 * web/public icons and brand/app-icon-1024.png cut from the same source
 * (brand/app-icon-source.png).
 */
export function AppLogo({ size = 32, className, title = "TraderMemos" }: AppLogoProps) {
  return (
    <img
      src={size <= 32 ? appIconSmall : appIcon}
      width={size}
      height={size}
      alt={title}
      draggable={false}
      className={cn("shrink-0 select-none", className)}
    />
  );
}
