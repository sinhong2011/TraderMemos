import { Card } from "@/components/Card";
import { ItemGroup } from "@/components/Item";
import { Skeleton } from "@/components/Skeleton";
import { TradeListItem } from "@/components/TradeListItem";
import type { Trade } from "@/lib/api/types";
import { intlLocale } from "@/lib/locale";
import { useMoneyFormatters } from "@/lib/useMoneyFormatters";

export interface OpenPositionsCardProps {
  trades: Trade[];
  loading: boolean;
  error: boolean;
  currency: string;
  fxRate?: number;
  onSelect: (t: Trade) => void;
}

/**
 * What is on the book right now, and how much of it is at risk. Open risk sums
 * the initial risk recorded at entry; positions without a stop are counted
 * apart rather than silently treated as zero risk.
 */
export function OpenPositionsCard({
  trades,
  loading,
  error,
  currency,
  fxRate = 1,
  onSelect,
}: OpenPositionsCardProps) {
  const { fmtMoney } = useMoneyFormatters();
  const locale = intlLocale();
  const withRisk = trades.filter((t) => t.initial_risk != null && t.initial_risk > 0);
  const openRisk = withRisk.reduce((sum, t) => sum + (t.initial_risk ?? 0), 0) * fxRate;
  const unknown = trades.length - withRisk.length;

  const action =
    trades.length > 0 ? (
      <span className="text-xs font-medium text-muted-foreground tabular-nums">
        {withRisk.length > 0
          ? `${fmtMoney(openRisk, currency, locale)} at risk`
          : "No stops recorded"}
        {withRisk.length > 0 && unknown > 0 ? ` · ${unknown} without a stop` : ""}
      </span>
    ) : undefined;

  const body = () => {
    if (loading) return <Skeleton height="72px" />;
    if (error) return <p className="m-0 text-xs text-destructive">Failed to load positions.</p>;
    if (trades.length === 0) {
      return <p className="m-0 text-[13px] text-muted-foreground">Flat. No open positions.</p>;
    }
    return (
      <ItemGroup className="gap-2">
        {trades.map((t) => (
          <TradeListItem
            key={t.id}
            trade={t}
            currency={currency}
            fxRate={fxRate}
            onSelect={onSelect}
          />
        ))}
      </ItemGroup>
    );
  };

  return (
    <Card title={`Open positions (${trades.length})`} action={action}>
      {body()}
    </Card>
  );
}
