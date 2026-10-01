import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import type { Trade } from "@/lib/api/types";
import { PRIVACY_MASK, useDisplayPrefs } from "@/lib/displayPrefs";
import { ReportsPeriodReturns } from "./ReportsPeriodReturns";

function trade(id: string, day: string, pnl: number): Trade {
  return {
    id,
    account_id: "a1",
    symbol: "NQ",
    instrument_type: "future",
    direction: "long",
    status: "closed",
    opened_at: `${day}T14:00:00Z`,
    closed_at: `${day}T15:00:00Z`,
    qty_opened: 1,
    qty_remaining: 0,
    avg_entry_price: 100,
    avg_exit_price: 110,
    gross_pnl: pnl,
    fees_total: 0,
    net_pnl: pnl,
    pnl_currency: "USD",
    return_pct: 0.1,
    time_in_trade_secs: 3600,
    notes: "",
    tags: [],
  };
}

describe("ReportsPeriodReturns", () => {
  afterEach(() => {
    useDisplayPrefs.setState({ privacyMode: false });
  });

  it("re-masks amounts when privacy mode flips while mounted", () => {
    const { container } = render(
      <ReportsPeriodReturns
        trades={[trade("t1", "2026-07-01", 100), trade("t2", "2026-07-02", 300)]}
        loading={false}
        currency="USD"
        fxRate={1}
        denominator={0}
      />,
    );
    expect(screen.getByText("Period returns")).toBeInTheDocument();
    expect(container).toHaveTextContent("+$200.00");
    expect(container).not.toHaveTextContent(PRIVACY_MASK);
    act(() => useDisplayPrefs.getState().setPrivacyMode(true));
    expect(container).not.toHaveTextContent("$");
    expect(container).toHaveTextContent(PRIVACY_MASK);
    act(() => useDisplayPrefs.getState().setPrivacyMode(false));
    expect(container).toHaveTextContent("+$200.00");
  });
});
