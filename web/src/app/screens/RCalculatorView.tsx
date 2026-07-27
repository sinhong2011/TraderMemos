import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useFilters } from "@/lib/filters";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { useRiskRules } from "@/lib/hooks/useRiskRules";
import { useFvgStore } from "@/lib/r-calculator/useFvgStore";
import { useRCalculatorStore } from "@/lib/r-calculator/useRCalculatorStore";
import { Page } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { CalculatorPanel } from "@/components/tools/r-calculator/CalculatorPanel";
import { FvgPanel } from "@/components/tools/r-calculator/FvgPanel";
import { SegmentedControl } from "@/components/SegmentedControl";
import { SessionRail } from "@/components/tools/r-calculator/SessionRail";

type AppMode = "rmultiple" | "fvg";

const HINT_KEY = "tradermemos/r-calc/position-size-hint";

const MODE_COPY: Record<AppMode, { title: string; description: string }> = {
  rmultiple: {
    title: "R-Multiple Calculator",
    description:
      "Size positions by risk, plan exit ladders, and visualize reward/risk. Cash positions only — no leverage, fees, or slippage.",
  },
  fvg: {
    title: "FVG Calculator",
    description:
      "Size an entry inside a fair-value gap against a buffered stop. Cash positions only — no leverage, fees, or slippage.",
  },
};

export function RCalculatorView() {
  const [mode, setMode] = useState<AppMode>("rmultiple");
  // Read on first render so the hint doesn't flash in after mount.
  const [hintDismissed, setHintDismissed] = useState(() => localStorage.getItem(HINT_KEY) === "1");

  const accountId = useFilters((s) => s.accountId);
  const accounts = useAccounts().data ?? [];
  const account = accounts.find((a) => a.id === accountId) ?? accounts[0];
  const riskRules = useRiskRules().data;
  const defaultPct = riskRules?.default_account_risk_pct ?? 1;

  const rStore = useRCalculatorStore();
  const fvgStore = useFvgStore();

  useEffect(() => {
    if (!account) return;
    const rState = useRCalculatorStore.getState();
    const session = rState.sessions.find((s) => s.id === rState.activeId);
    if (session && session.capital === 1000) {
      rState.setField("capital", account.starting_balance);
    }
    const fvgState = useFvgStore.getState();
    const fvgSession = fvgState.sessions.find((s) => s.id === fvgState.activeId);
    if (fvgSession && fvgSession.account === 1000) {
      fvgState.setField("account", account.starting_balance);
    }
  }, [account]);

  useEffect(() => {
    if (defaultPct == null) return;
    const rState = useRCalculatorStore.getState();
    const session = rState.sessions.find((s) => s.id === rState.activeId);
    if (session && session.riskPct === 1) {
      rState.setField("riskPct", defaultPct);
    }
    const fvgState = useFvgStore.getState();
    const fvgSession = fvgState.sessions.find((s) => s.id === fvgState.activeId);
    if (fvgSession && fvgSession.riskPct === 1) {
      fvgState.setField("riskPct", defaultPct);
    }
  }, [defaultPct]);

  const sessionRail =
    mode === "rmultiple" ? (
      <SessionRail
        sessions={rStore.sessions}
        activeId={rStore.activeId}
        onSelect={rStore.setActive}
        onAdd={rStore.addSession}
        onDuplicate={rStore.duplicateSession}
        onRemove={rStore.removeSession}
        onRename={rStore.renameSession}
      />
    ) : (
      <SessionRail
        sessions={fvgStore.sessions}
        activeId={fvgStore.activeId}
        onSelect={fvgStore.setActive}
        onAdd={fvgStore.addSession}
        onDuplicate={fvgStore.duplicateSession}
        onRemove={fvgStore.removeSession}
        onRename={fvgStore.renameSession}
      />
    );

  return (
    <Page fill className="min-h-[calc(100vh-52px)] gap-4 p-4 sm:gap-5 sm:p-6">
      <header className="shrink-0">
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground">
          {MODE_COPY[mode].title}
        </h1>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
          {MODE_COPY[mode].description}
        </p>
        {!hintDismissed ? (
          <div className="mt-2 flex max-w-2xl items-center gap-1 text-xs text-muted-foreground">
            <span>Need a quick share count? Use Tools → Position size in the header.</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Dismiss hint"
              onClick={() => {
                localStorage.setItem(HINT_KEY, "1");
                setHintDismissed(true);
              }}
              className="shrink-0 text-muted-foreground"
            >
              <X />
            </Button>
          </div>
        ) : null}
      </header>

      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {sessionRail}
        <SegmentedControl
          ariaLabel="Calculator mode"
          value={mode}
          onChange={(v) => setMode(v as AppMode)}
          options={[
            { value: "rmultiple", label: "R-Multiple" },
            { value: "fvg", label: "FVG" },
          ]}
        />
      </div>

      <div className="flex min-h-[min(640px,calc(100vh-240px))] flex-1 flex-col">
        {mode === "rmultiple" ? <CalculatorPanel /> : <FvgPanel />}
      </div>
    </Page>
  );
}
