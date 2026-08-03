import { useMemo, useState } from "react";
import { intlLocale } from "@/lib/locale";
import { buildWrappedShareCard } from "@/lib/shareCard";
import type { YearWrapped } from "@/lib/wrapped";
import { ShareCardModal } from "@/components/ShareCard";

export function WrappedShareModal({
  wrapped,
  currency,
  fxRate,
  inProgress,
  open,
  onOpenChange,
}: {
  wrapped: YearWrapped;
  currency: string;
  fxRate: number;
  inProgress: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [showAmounts, setShowAmounts] = useState(false);

  const data = useMemo(
    () =>
      buildWrappedShareCard(wrapped, {
        showAmounts,
        locale: intlLocale(),
        currency,
        fxRate,
        inProgress,
      }),
    [wrapped, showAmounts, currency, fxRate, inProgress],
  );

  return (
    <ShareCardModal
      data={data}
      filename={`tradermemos-${wrapped.year}-wrapped.png`}
      privacyHint="Off shares only win rate and ratios — account size stays private."
      showAmounts={showAmounts}
      onShowAmountsChange={setShowAmounts}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}
