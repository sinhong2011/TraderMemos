import { t } from "@lingui/core/macro";
import { useState } from "react";
import { Card } from "@/components/Card";
import { FormInput, FormTextarea } from "@/components/FormInput";
import { Skeleton } from "@/components/Skeleton";
import { useToastManager } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import type {
  Adherence,
  ChecklistItem,
  ExitState,
  TradeSystemCard as TradeSystemCardDTO,
  TradeSystemCardBody,
} from "@/lib/api/system";
import {
  useSaveTradeSystemCard,
  useTradeSystemCard,
  useTradingSystem,
} from "@/lib/hooks/useSystem";
import {
  ADHERENCES,
  adherenceLabel,
  CHECKLIST,
  checklistLabel,
  EXIT_STATES,
  exitStateCopy,
  STANCES,
  stanceLabel,
} from "@/lib/system";

function cardToBody(c: TradeSystemCardDTO): TradeSystemCardBody {
  return {
    regime: c.regime || c.day_regime,
    trigger_met: c.trigger_met,
    trade_type: c.trade_type,
    thesis: c.thesis,
    planned_hold_days: c.planned_hold_days,
    time_stop_days: c.time_stop_days,
    exit_state: c.exit_state,
    adherence: c.adherence || c.suggested_adherence,
    checklist: { ...c.checklist },
    lesson: c.lesson,
    rule_change: c.rule_change,
  };
}

export function TradeSystemCard({ tradeId }: { tradeId: string }) {
  const cardQ = useTradeSystemCard(tradeId);
  if (cardQ.isLoading) return <Skeleton className="h-40" />;
  if (cardQ.isError || !cardQ.data) return null;
  return (
    <TradeSystemCardForm
      key={`${tradeId}:${cardQ.dataUpdatedAt}`}
      tradeId={tradeId}
      card={cardQ.data}
    />
  );
}

function TradeSystemCardForm({ tradeId, card }: { tradeId: string; card: TradeSystemCardDTO }) {
  const systemQ = useTradingSystem();
  const save = useSaveTradeSystemCard();
  const toast = useToastManager();
  const [body, setBody] = useState(() => cardToBody(card));
  const version = systemQ.data?.active;
  const types = version?.trade_types ?? { momentum: "Momentum", position: "Position" };

  return (
    <Card
      title={t`System card`}
      description={
        card.version_label ? t`Version ${card.version_label}` : t`No active version stamped yet.`
      }
      action={
        <Button
          type="button"
          size="sm"
          disabled={save.isPending}
          onClick={() =>
            save.mutate(
              { tradeId, body },
              {
                onSuccess: () => toast.add({ title: t`System card saved` }),
                onError: (e) =>
                  toast.add({
                    title: t`Could not save`,
                    description: e instanceof Error ? e.message : t`Request failed`,
                  }),
              },
            )
          }
        >
          {t`Save`}
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-2xs">
          <span className="text-muted-foreground">{t`Market regime`}</span>
          <NativeSelect
            value={body.regime ?? ""}
            onChange={(e) => setBody((b) => ({ ...b, regime: e.target.value }))}
          >
            <NativeSelectOption value="">{t`—`}</NativeSelectOption>
            {STANCES.map((s) => (
              <NativeSelectOption key={s} value={s}>
                {stanceLabel(s, version)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1 text-2xs">
          <span className="text-muted-foreground">{t`Trigger met`}</span>
          <NativeSelect
            value={body.trigger_met ?? ""}
            onChange={(e) => setBody((b) => ({ ...b, trigger_met: e.target.value }))}
          >
            <NativeSelectOption value="">{t`—`}</NativeSelectOption>
            <NativeSelectOption value="yes">{t`Yes`}</NativeSelectOption>
            <NativeSelectOption value="no">{t`No`}</NativeSelectOption>
            <NativeSelectOption value="n.a.">{t`N/A`}</NativeSelectOption>
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1 text-2xs">
          <span className="text-muted-foreground">{t`Trade type`}</span>
          <NativeSelect
            value={body.trade_type ?? ""}
            onChange={(e) => setBody((b) => ({ ...b, trade_type: e.target.value }))}
          >
            <NativeSelectOption value="">{t`—`}</NativeSelectOption>
            {Object.entries(types).map(([k, label]) => (
              <NativeSelectOption key={k} value={k}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1 text-2xs">
          <span className="text-muted-foreground">{t`Planned hold (days)`}</span>
          <FormInput
            type="number"
            value={body.planned_hold_days ?? ""}
            onChange={(e) =>
              setBody((b) => ({
                ...b,
                planned_hold_days: e.target.value === "" ? null : Number(e.target.value),
              }))
            }
          />
        </label>
        <label className="col-span-full flex flex-col gap-1 text-2xs">
          <span className="text-muted-foreground">{t`Thesis`}</span>
          <FormInput
            value={body.thesis ?? ""}
            onChange={(e) => setBody((b) => ({ ...b, thesis: e.target.value }))}
          />
        </label>
        <label className="flex flex-col gap-1 text-2xs">
          <span className="text-muted-foreground">{t`Exit state`}</span>
          <NativeSelect
            value={body.exit_state ?? ""}
            onChange={(e) => setBody((b) => ({ ...b, exit_state: e.target.value }))}
          >
            <NativeSelectOption value="">{t`—`}</NativeSelectOption>
            {EXIT_STATES.map((s) => (
              <NativeSelectOption key={s} value={s}>
                {exitStateCopy(s as ExitState).label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1 text-2xs">
          <span className="text-muted-foreground">{t`Adherence`}</span>
          <NativeSelect
            value={body.adherence ?? ""}
            onChange={(e) => setBody((b) => ({ ...b, adherence: e.target.value }))}
          >
            <NativeSelectOption value="">{t`—`}</NativeSelectOption>
            {ADHERENCES.map((a) => (
              <NativeSelectOption key={a} value={a}>
                {adherenceLabel(a as Adherence)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <div className="text-2xs text-muted-foreground">{t`Post-trade checklist`}</div>
        {CHECKLIST.map((item) => (
          <label key={item} className="flex items-center justify-between gap-3 text-sm">
            <span>{checklistLabel(item as ChecklistItem)}</span>
            <Switch
              checked={Boolean(body.checklist?.[item])}
              onCheckedChange={(v) =>
                setBody((b) => ({
                  ...b,
                  checklist: { ...b.checklist, [item]: v },
                }))
              }
            />
          </label>
        ))}
      </div>

      <label className="mt-4 flex flex-col gap-1 text-2xs">
        <span className="text-muted-foreground">{t`Lesson`}</span>
        <FormTextarea
          rows={2}
          value={body.lesson ?? ""}
          onChange={(e) => setBody((b) => ({ ...b, lesson: e.target.value }))}
        />
      </label>
      <label className="mt-3 flex items-center justify-between gap-3 text-sm">
        <span>{t`Should this change a rule?`}</span>
        <Switch
          checked={Boolean(body.rule_change)}
          onCheckedChange={(v) => setBody((b) => ({ ...b, rule_change: v }))}
        />
      </label>
    </Card>
  );
}
