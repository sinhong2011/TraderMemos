import { useFilters } from "../lib/filters";

type Preset = {
  label: string;
  key: string;
};

const PRESETS: Preset[] = [
  { label: "Last 7 days",  key: "7d" },
  { label: "Last 30 days", key: "30d" },
  { label: "Last 90 days", key: "90d" },
  { label: "This month",   key: "month" },
  { label: "All time",     key: "all" },
];

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function computeRange(key: string): { from?: string; to?: string } {
  const now = new Date();
  const today = toISODate(now);

  if (key === "7d") {
    const from = new Date(now);
    from.setDate(from.getDate() - 6);
    return { from: toISODate(from), to: today };
  }
  if (key === "30d") {
    const from = new Date(now);
    from.setDate(from.getDate() - 29);
    return { from: toISODate(from), to: today };
  }
  if (key === "90d") {
    const from = new Date(now);
    from.setDate(from.getDate() - 89);
    return { from: toISODate(from), to: today };
  }
  if (key === "month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: toISODate(from), to: today };
  }
  // "all" - no range constraints
  return { from: undefined, to: undefined };
}

function currentKey(from?: string, to?: string): string {
  if (!from && !to) return "all";
  // best-effort match
  const now = new Date();
  const today = toISODate(now);
  if (to !== today) return "";

  const d = new Date(from ?? "");
  const diffDays = Math.round(
    (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 6) return "7d";
  if (diffDays === 29) return "30d";
  if (diffDays === 89) return "90d";

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  if (from === toISODate(monthStart)) return "month";

  return "";
}

export function DateRangePicker() {
  const { from, to, setRange } = useFilters();
  const active = currentKey(from, to);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const { from: f, to: t } = computeRange(e.target.value);
    setRange(f, t);
  }

  return (
    <select
      value={active}
      onChange={handleChange}
      style={{
        background: "var(--color-surface-hover)",
        color: "var(--color-text)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-control)",
        padding: "6px 10px",
        fontSize: "12px",
        fontFamily: "var(--font-ui)",
        cursor: "pointer",
        outline: "none",
        transition: `border-color var(--duration-fast)`,
      }}
      onFocus={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor =
          "var(--color-accent)";
      }}
      onBlur={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor =
          "var(--color-border)";
      }}
      aria-label="Date range"
    >
      {PRESETS.map((p) => (
        <option key={p.key} value={p.key}
          style={{ background: "var(--color-surface-panel)" }}
        >
          {p.label}
        </option>
      ))}
      {active === "" && (
        <option value="" style={{ background: "var(--color-surface-panel)" }}>
          Custom range
        </option>
      )}
    </select>
  );
}
