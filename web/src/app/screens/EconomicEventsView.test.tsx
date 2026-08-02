import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import type { EconomicEvent } from "@/lib/api/economicEvents";
import { addDaysKey, EconomicEventsView, weekStartKey } from "./EconomicEventsView";

function ev(overrides: Partial<EconomicEvent>): EconomicEvent {
  return {
    id: 1,
    provider: "forexfactory",
    title: "CPI y/y",
    country: "USD",
    impact: "high",
    time: "2026-08-04T12:30:00Z",
    forecast: "2.9%",
    previous: "3.0%",
    actual: "",
    ...overrides,
  };
}

const baseProps = {
  loading: false,
  error: false,
  weekStart: "2026-08-02",
  isCurrentWeek: true,
  onPrevWeek: vi.fn<() => void>(),
  onNextWeek: vi.fn<() => void>(),
  onThisWeek: vi.fn<() => void>(),
  onImpactChange: vi.fn<(next?: string[]) => void>(),
  onCurrenciesChange: vi.fn<(next?: string[]) => void>(),
};

describe("EconomicEventsView", () => {
  it("groups events by day with impact badges and figures", () => {
    render(
      <EconomicEventsView
        {...baseProps}
        events={[
          ev({ id: 1 }),
          ev({
            id: 2,
            title: "Unemployment Rate",
            country: "EUR",
            impact: "medium",
            time: "2026-08-05T09:00:00Z",
            forecast: "6.2%",
            previous: "6.3%",
          }),
        ]}
      />,
    );
    expect(screen.getByText("CPI y/y")).toBeInTheDocument();
    expect(screen.getByText("Unemployment Rate")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("Medium")).toBeInTheDocument();
    expect(screen.getByText("2.9%")).toBeInTheDocument();
    // Two distinct day sections.
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(2);
  });

  it("filters by impact and currency client-side", () => {
    render(
      <EconomicEventsView
        {...baseProps}
        impact={["high"]}
        currencies={["USD"]}
        events={[ev({ id: 1 }), ev({ id: 2, title: "GDP q/q", country: "EUR", impact: "low" })]}
      />,
    );
    expect(screen.getByText("CPI y/y")).toBeInTheDocument();
    expect(screen.queryByText("GDP q/q")).not.toBeInTheDocument();
  });

  it("shows the filtered empty state when filters hide everything", () => {
    render(<EconomicEventsView {...baseProps} impact={["holiday"]} events={[ev({ id: 1 })]} />);
    expect(screen.getByText("No events match the filters")).toBeInTheDocument();
  });

  it("shows an error state when the query fails", () => {
    render(<EconomicEventsView {...baseProps} error events={[]} />);
    expect(screen.getByText("Couldn't load events")).toBeInTheDocument();
  });
});

describe("week helpers", () => {
  it("weekStartKey returns a Sunday and addDaysKey steps days", () => {
    const start = weekStartKey(0, "UTC");
    expect(new Date(`${start}T12:00:00Z`).getUTCDay()).toBe(0);
    expect(addDaysKey("2026-08-02", 7)).toBe("2026-08-09");
    expect(addDaysKey("2026-08-02", -1)).toBe("2026-08-01");
    // Offset weeks land exactly 7 days apart.
    expect(addDaysKey(weekStartKey(1, "UTC"), -7)).toBe(start);
  });
});
