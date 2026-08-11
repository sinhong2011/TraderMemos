import { createFileRoute } from "@tanstack/react-router";
import { ReplayView } from "@/app/screens/ReplayView";
import type { BarInterval } from "@/lib/api/market";

const INTERVALS: readonly BarInterval[] = ["1", "5", "15", "60", "240", "D"];
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateReplaySearch(search: Record<string, unknown>): {
  symbol?: string;
  iv: BarInterval;
  from?: string;
  to?: string;
} {
  const raw = typeof search.symbol === "string" ? search.symbol.trim().toUpperCase() : "";
  const symbol = /^[A-Z0-9./-]{1,15}$/.test(raw) ? raw : undefined;
  const iv = INTERVALS.includes(search.iv as BarInterval) ? (search.iv as BarInterval) : "D";
  const day = (v: unknown) => (typeof v === "string" && DAY_RE.test(v) ? v : undefined);
  return {
    ...(symbol ? { symbol } : {}),
    iv,
    ...(day(search.from) ? { from: day(search.from) } : {}),
    ...(day(search.to) ? { to: day(search.to) } : {}),
  };
}

export const Route = createFileRoute("/replay")({
  validateSearch: validateReplaySearch,
  component: ReplayPage,
});

function ReplayPage() {
  const { symbol, iv, from, to } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <ReplayView
      symbol={symbol ?? ""}
      interval={iv}
      from={from}
      to={to}
      onSetupChange={(next) => void navigate({ search: (prev) => ({ ...prev, ...next }) })}
    />
  );
}
