import { t } from "@lingui/core/macro";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/button";
import { useMarketRegime, usePutMarketRegime, useTradingSystem } from "@/lib/hooks/useSystem";
import { STANCES, stanceHint, stanceLabel } from "@/lib/system";
import { cn } from "@/lib/cn";
import { useToastManager } from "@/components/Toast";

export function MarketRegimeCard({ day }: { day: string }) {
  const regimeQ = useMarketRegime(day);
  const systemQ = useTradingSystem();
  const put = usePutMarketRegime();
  const toast = useToastManager();
  const version = systemQ.data?.active ?? systemQ.data?.draft;
  const current = regimeQ.data?.regime ?? "";

  return (
    <Card
      title={t`Market today`}
      description={t`Normal and Defensive allow trading; Paused means stand aside.`}
    >
      <div className="flex flex-wrap gap-2">
        {STANCES.map((s) => (
          <Button
            key={s}
            type="button"
            size="sm"
            variant={current === s ? "default" : "outline"}
            className={cn(current === s && "ring-2 ring-primary")}
            disabled={put.isPending}
            title={stanceHint(s)}
            onClick={() =>
              put.mutate(
                { day, regime: current === s ? "" : s },
                {
                  onError: (e) =>
                    toast.add({
                      title: t`Could not save regime`,
                      description: e instanceof Error ? e.message : t`Request failed`,
                    }),
                },
              )
            }
          >
            {stanceLabel(s, version)}
          </Button>
        ))}
      </div>
    </Card>
  );
}
