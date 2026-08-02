import { useMemo, useRef, useState } from "react";
import type { TradeDetail } from "@/lib/api/types";
import { intlLocale } from "@/lib/locale";
import { buildTradeShareCard, type ShareCardData } from "@/lib/shareCard";
import { downloadBlob, svgToPngBlob } from "@/lib/svgToPng";
import type { TradeInsights } from "@/lib/tradeInsights";
import { Modal } from "@/components/Modal";
import { useToastManager } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export const SHARE_CARD_WIDTH = 1200;
export const SHARE_CARD_HEIGHT = 630;

const CARD = {
  bg: "#0d1017",
  text: "#e8eaf0",
  muted: "#8a92a6",
  brand: "#1f9ad9",
  profit: "#52ca96",
  loss: "#eb4b68",
  flat: "#8a92a6",
} as const;

const FONT = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";

function chipWidth(text: string): number {
  return text.length * 15 + 40;
}

function Chip({ x, y, text, color }: { x: number; y: number; text: string; color: string }) {
  const w = chipWidth(text);
  return (
    <g>
      <rect x={x} y={y} width={w} height={46} rx={23} fill={color} opacity={0.14} />
      <text
        x={x + w / 2}
        y={y + 31}
        textAnchor="middle"
        fontFamily={FONT}
        fontSize={22}
        fontWeight={600}
        letterSpacing="0.08em"
        fill={color}
      >
        {text}
      </text>
    </g>
  );
}

/** Self-contained 1200×630 share card — inline SVG only, safe to rasterize. */
export function ShareCardSvg({
  data,
  svgRef,
}: {
  data: ShareCardData;
  svgRef?: React.Ref<SVGSVGElement>;
}) {
  const tone = CARD[data.tone];
  const outcomeColor = data.outcome === "OPEN" ? CARD.brand : tone;
  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${SHARE_CARD_WIDTH} ${SHARE_CARD_HEIGHT}`}
      width="100%"
      role="img"
      aria-label={`${data.symbol} trade card`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width={SHARE_CARD_WIDTH} height={SHARE_CARD_HEIGHT} fill={CARD.bg} />
      <circle cx={1080} cy={560} r={330} fill={tone} opacity={0.055} />
      <circle cx={1180} cy={80} r={180} fill={CARD.brand} opacity={0.05} />

      <circle cx={92} cy={84} r={9} fill={CARD.brand} />
      <text x={114} y={93} fontFamily={FONT} fontSize={26} fontWeight={600} fill={CARD.muted}>
        TraderMemos
      </text>
      <text
        x={1120}
        y={93}
        textAnchor="end"
        fontFamily={FONT}
        fontSize={24}
        fill={CARD.muted}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {data.dateLabel}
      </text>

      <text x={80} y={240} fontFamily={FONT} fontSize={78} fontWeight={700} fill={CARD.text}>
        {data.symbol}
      </text>
      <Chip x={80} y={272} text={data.directionLabel} color={CARD.muted} />
      <Chip
        x={80 + chipWidth(data.directionLabel) + 14}
        y={272}
        text={data.outcome}
        color={outcomeColor}
      />

      <text
        x={80}
        y={470}
        fontFamily={FONT}
        fontSize={132}
        fontWeight={700}
        fill={tone}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {data.hero.value}
      </text>
      <text
        x={80}
        y={512}
        fontFamily={FONT}
        fontSize={24}
        fontWeight={600}
        letterSpacing="0.14em"
        fill={CARD.muted}
      >
        {data.hero.label.toUpperCase()}
      </text>

      {data.stats.map((s, i) => (
        <g key={s.label}>
          <text
            x={80 + i * 310}
            y={562}
            fontFamily={FONT}
            fontSize={20}
            fontWeight={600}
            letterSpacing="0.14em"
            fill={CARD.muted}
          >
            {s.label.toUpperCase()}
          </text>
          <text
            x={80 + i * 310}
            y={600}
            fontFamily={FONT}
            fontSize={34}
            fontWeight={600}
            fill={CARD.text}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {s.value}
          </text>
        </g>
      ))}
    </svg>
  );
}

function cardFilename(data: ShareCardData): string {
  const date = data.dateLabel.replaceAll(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  return `tradermemos-${data.symbol.toLowerCase()}-${date}.png`;
}

export function TradeShareModal({
  trade,
  insights,
  open,
  onOpenChange,
}: {
  trade: TradeDetail;
  insights: TradeInsights;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const toast = useToastManager();
  const svgRef = useRef<SVGSVGElement>(null);
  const [showAmounts, setShowAmounts] = useState(false);
  const [busy, setBusy] = useState<"copy" | "download" | null>(null);

  const data = useMemo(
    () => buildTradeShareCard(trade, insights, { showAmounts, locale: intlLocale() }),
    [trade, insights, showAmounts],
  );

  const canCopy =
    typeof navigator !== "undefined" &&
    Boolean(navigator.clipboard) &&
    typeof ClipboardItem !== "undefined";

  async function renderPng(): Promise<Blob | null> {
    const svg = svgRef.current;
    if (!svg) return null;
    return svgToPngBlob(svg, SHARE_CARD_WIDTH, SHARE_CARD_HEIGHT, 2);
  }

  async function onCopy() {
    setBusy("copy");
    try {
      const blob = await renderPng();
      if (!blob) return;
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast.add({ title: "Card copied", description: "PNG is on your clipboard." });
    } catch {
      toast.add({ title: "Copy failed", description: "Try Download PNG instead." });
    } finally {
      setBusy(null);
    }
  }

  async function onDownload() {
    setBusy("download");
    try {
      const blob = await renderPng();
      if (blob) downloadBlob(blob, cardFilename(data));
    } catch {
      toast.add({ title: "Export failed", description: "Could not render the card image." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Share card"
      className="max-w-[min(640px,94vw)]"
      footer={
        <>
          {canCopy && (
            <Button type="button" variant="soft" disabled={busy != null} onClick={onCopy}>
              {busy === "copy" ? "Copying…" : "Copy image"}
            </Button>
          )}
          <Button type="button" disabled={busy != null} onClick={onDownload}>
            {busy === "download" ? "Exporting…" : "Download PNG"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="overflow-hidden rounded-lg">
          <ShareCardSvg data={data} svgRef={svgRef} />
        </div>
        <label className="flex items-center justify-between gap-3 text-[13px] text-muted-foreground">
          <span>
            Show dollar amounts
            <span className="block text-[11px]">
              Off shares only R multiples and percentages — account size stays private.
            </span>
          </span>
          <Switch checked={showAmounts} onCheckedChange={setShowAmounts} />
        </label>
      </div>
    </Modal>
  );
}
