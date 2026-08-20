import { cn } from 'panelui-native';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { DashboardCard } from '@/components/dashboard-card';
import { t } from '@lingui/core/macro';
import { resolveMarketTimezone, useDisplayPrefs, wallClockToIso } from '@/lib/prefs';

/** Conventional forex session hours, each on its own local exchange clock. */
const SESSIONS = [
  { label: 'Sydney', tz: 'Australia/Sydney', start: 7, end: 16 },
  { label: 'Tokyo', tz: 'Asia/Tokyo', start: 9, end: 18 },
  { label: 'London', tz: 'Europe/London', start: 8, end: 17 },
  { label: 'New York', tz: 'America/New_York', start: 8, end: 17 },
] as const;

/**
 * Fractional hour-of-day (0–24) of an instant in the given zone. Single-field
 * format() calls, not formatToParts — Hermes mislabels part types.
 */
function hourFractionInTz(at: Date, timeZone: string): number {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(at),
  );
  const minute = Number(
    new Intl.DateTimeFormat('en-US', { timeZone, minute: 'numeric' }).format(at),
  );
  return hour + minute / 60;
}

/** Local calendar date (YYYY-MM-DD) of an instant in the given zone. */
function dayInTz(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, dateStyle: 'short' }).format(at);
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
      `${dayInTz(now, s.tz)}T${String(s.start).padStart(2, '0')}:00`,
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
  if (!h12) return String(hour).padStart(2, '0');
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

/**
 * Compact 24h market-session clock on the market clock (the same axis the
 * hourly charts bucket on), with the live sessions highlighted and a "now"
 * marker. Repaints every minute. Web ReportsSessionClock parity.
 */
export function SessionClockCard() {
  const prefs = useDisplayPrefs();
  const marketTz = resolveMarketTimezone(prefs.marketTimezone);
  const h12 = prefs.timeFormat === 'h12';
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const lanes = sessionLanes(now, marketTz);
  const nowFrac = hourFractionInTz(now, marketTz);
  const tzCity = marketTz.split('/').pop()?.replace(/_/g, ' ') ?? marketTz;

  return (
    <DashboardCard title={t`Market sessions`}>
      <Text className="text-[10px] text-muted-foreground">{t`${tzCity} clock`}</Text>
      <View className="flex-row gap-3">
        <View className="w-16 shrink-0 gap-1.5">
          {lanes.map((lane) => (
            <Text
              key={lane.label}
              className={cn(
                'h-5 text-[10px] leading-5',
                lane.active ? 'font-semibold text-foreground' : 'text-muted-foreground',
              )}
            >
              {lane.label}
            </Text>
          ))}
        </View>
        <View className="relative flex-1 gap-1.5">
          {lanes.map((lane) => (
            <View key={lane.label} className="relative h-5">
              <View className="absolute inset-x-0 bottom-1.5 top-1.5 rounded-full bg-muted" />
              {lane.segments.map(([from, to]) => (
                <View
                  key={from}
                  className={cn(
                    'absolute bottom-1.5 top-1.5 rounded-full',
                    lane.active ? 'bg-primary' : 'bg-primary/25',
                  )}
                  style={{ left: `${(from / 24) * 100}%`, width: `${((to - from) / 24) * 100}%` }}
                />
              ))}
            </View>
          ))}
          <View
            pointerEvents="none"
            className="absolute bottom-0 top-0 w-px bg-foreground/60"
            style={{ left: `${(nowFrac / 24) * 100}%` }}
          />
        </View>
      </View>
      <View className="flex-row gap-3">
        <View className="w-16 shrink-0" />
        <View className="relative h-3 flex-1">
          {[0, 6, 12, 18].map((h) => (
            <Text
              key={h}
              className="absolute text-[9px] tabular-nums text-muted-foreground"
              style={{ left: `${(h / 24) * 100}%` }}
            >
              {tickLabel(h, h12)}
            </Text>
          ))}
        </View>
      </View>
    </DashboardCard>
  );
}
