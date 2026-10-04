import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { useDisplayPrefs } from "@/lib/displayPrefs";
import { HomeMiniCalendar } from "./HomeMiniCalendar";

const initial = useDisplayPrefs.getState().marketTimezone;

function renderOctober() {
  render(
    <HomeMiniCalendar
      year={2026}
      month={10}
      dailyPnl={{}}
      currency="USD"
      onOpenCalendar={() => {}}
    />,
  );
}

describe("HomeMiniCalendar", () => {
  afterEach(() => {
    vi.useRealTimers();
    useDisplayPrefs.getState().setMarketTimezone(initial);
  });

  it("marks today on the market clock, like the Calendar page", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // 09:45 on Oct 4 in Hong Kong is still the evening of Oct 3 in New York.
    vi.setSystemTime(new Date("2026-10-04T01:45:00Z"));
    useDisplayPrefs.getState().setMarketTimezone("America/New_York");
    renderOctober();
    const current = document.querySelector('[aria-current="date"]');
    expect(current?.textContent).toBe("3");
    expect(screen.getAllByText("4")[0].closest('[aria-current="date"]')).toBeNull();
  });
});
