import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { resolveMarketTimezone, useDisplayTimePrefs, wallClockToIso } from "@/lib/displayPrefs";

/** Conventional forex session hours, each on its own local exchange clock. */
const SESSIONS = [
  { label: "Sydney", tz: "Australia/Sydney", start: 7, end: 16 },
  { label: "Tokyo", tz: "Asia/Tokyo", start: 9, end: 18 },
  { label: "London", tz: "Europe/London", start: 8, end: 17 },
  { label: "New York", tz: "America/New_York", start: 8, end: 17 },
] as const;

/** Fractional hour-of-day (0–24) of an instant in the given zone. */
function hourFractionInTz(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get("hour") + get("minute") / 60;
}

/** Local calendar date (YYYY-MM-DD) of an instant in the given zone. */
function dayInTz(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, dateStyle: "short" }).format(at);
}

interface SessionLane {
  label: string;
  active: boolean;
  /** Track segments as [startFrac, endFrac] on the 0–24 market clock; two when the window wraps midnight. */
  segments: [number, number][];
}

function sessionLanes(now: Date, marketTz: string): SessionLane[] {
  return SESSIONS.map((s) => {
    const localHour = hourFractionInTz(now, s.tz);
    const active = localHour >= s.start && localHour < s.end;
    // Anchor today's session-open instant in the session zone, then read it on
    // the market clock; the window length is fixed so only the start shifts.
    const openIso = wallClockToIso(
      `${dayInTz(now, s.tz)}T${String(s.start).padStart(2, "0")}:00`,
      s.tz,
    );
    const startFrac = hourFractionInTz(new Date(openIso), marketTz);
    const endFrac = startFrac + (s.end - s.start);
    const segments: [number, number][] =
      endFrac > 24
        ? [
            [startFrac, 24],
            [0, endFrac - 24],
          ]
        : [[startFrac, endFrac]];
    return { label: s.label, active, segments };
  });
}

function tickLabel(hour: number, h12: boolean): string {
  if (!h12) return String(hour).padStart(2, "0");
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

/**
 * Compact 24h market-session clock on the market clock (the same axis the
 * hourly charts bucket on), with the live sessions highlighted and a "now"
 * marker. Repaints every minute.
 */
export function ReportsSessionClock() {
  const { timeFormat, marketTimezone } = useDisplayTimePrefs();
  const marketTz = resolveMarketTimezone(marketTimezone);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const lanes = sessionLanes(now, marketTz);
  const nowFrac = hourFractionInTz(now, marketTz);
  const tzCity = marketTz.split("/").pop()?.replace(/_/g, " ") ?? marketTz;

  return (
    <section className="flex min-w-0 flex-col rounded-lg bg-card p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] font-semibold tracking-wide text-chart-3">Market sessions</p>
        <p className="text-[10px] text-muted-foreground">{tzCity} clock</p>
      </div>
      <div className="mt-3 flex gap-3">
        <div className="flex w-16 shrink-0 flex-col gap-1.5">
          {lanes.map((l) => (
            <p
              key={l.label}
              className={cn(
                "flex h-5 items-center text-[10px] leading-none",
                l.active ? "font-semibold text-foreground" : "text-muted-foreground",
              )}
            >
              {l.label}
            </p>
          ))}
        </div>
        <div className="relative flex flex-1 flex-col gap-1.5">
          {lanes.map((l) => (
            <div key={l.label} className="relative h-5">
              <div className="absolute inset-x-0 inset-y-1.5 rounded-full bg-muted" />
              {l.segments.map(([from, to]) => (
                <div
                  key={from}
                  className={cn(
                    "absolute inset-y-1.5 rounded-full",
                    l.active ? "bg-primary" : "bg-primary/25",
                  )}
                  style={{ left: `${(from / 24) * 100}%`, width: `${((to - from) / 24) * 100}%` }}
                />
              ))}
            </div>
          ))}
          <div
            aria-hidden
            className="absolute inset-y-0 w-px bg-foreground/60"
            style={{ left: `${(nowFrac / 24) * 100}%` }}
          />
        </div>
      </div>
      <div className="mt-1.5 flex gap-3">
        <div className="w-16 shrink-0" aria-hidden />
        <div className="relative h-3 flex-1">
          {[0, 6, 12, 18].map((h) => (
            <span
              key={h}
              className={cn(
                "absolute text-[9px] tabular-nums text-muted-foreground",
                h > 0 && "-translate-x-1/2",
              )}
              style={{ left: `${(h / 24) * 100}%` }}
            >
              {tickLabel(h, timeFormat === "h12")}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
