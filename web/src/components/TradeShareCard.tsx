import { useMemo, useState } from "react";
import type { TradeDetail } from "@/lib/api/types";
import { intlLocale } from "@/lib/locale";
import { buildTradeShareCard, type ShareCardData } from "@/lib/shareCard";
import type { TradeInsights } from "@/lib/tradeInsights";
import { ShareCardModal } from "@/components/ShareCard";

function cardFilename(data: ShareCardData): string {
  const date = data.dateLabel.replaceAll(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  return `tradermemos-${data.title.toLowerCase()}-${date}.png`;
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
  const [showAmounts, setShowAmounts] = useState(false);

  const data = useMemo(
    () => buildTradeShareCard(trade, insights, { showAmounts, locale: intlLocale() }),
    [trade, insights, showAmounts],
  );

  return (
    <ShareCardModal
      data={data}
      filename={cardFilename(data)}
      privacyHint="Off shares only R multiples and percentages — account size stays private."
      showAmounts={showAmounts}
      onShowAmountsChange={setShowAmounts}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}
