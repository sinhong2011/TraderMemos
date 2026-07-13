// Recharts renders one tick per data point by default; equity series can have
// several points per day. Feed XAxis `ticks` with the first point of each day.
export function uniqueDayTicks(points: ReadonlyArray<{ at: string }>): string[] {
  const seen = new Set<string>();
  const ticks: string[] = [];
  for (const p of points) {
    const day = p.at.slice(0, 10);
    if (!seen.has(day)) {
      seen.add(day);
      ticks.push(p.at);
    }
  }
  return ticks;
}
