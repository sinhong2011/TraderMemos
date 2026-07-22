import { describe, expect, it } from "vite-plus/test";
import { render, screen } from "@testing-library/react";
import { BatchTradeResultPreview } from "./TradeResultPreview";
import type { BatchTradePnlPreview } from "../lib/tradePnlPreview";

const batch: BatchTradePnlPreview = {
  symbolCount: 4,
  withFills: 4,
  closedCount: 4,
  openCount: 0,
  feesTotal: 26.07,
  net: -125.04,
  riskTotal: null,
  rMultiple: null,
};

describe("BatchTradeResultPreview", () => {
  it("renders hero P&L, meta, and after-save strip when account baseline is provided", () => {
    render(
      <BatchTradeResultPreview
        batch={batch}
        currency="USD"
        locale="en-US"
        accountNetPnl={-50}
        accountCash={10000}
      />,
    );
    expect(screen.getByTestId("batch-trade-result-preview")).toBeVisible();
    expect(screen.getByText("Batch result")).toBeVisible();
    expect(screen.getByText("Est. P&L")).toBeVisible();
    expect(screen.getByText(/-\$125\.04/)).toBeVisible();
    expect(screen.getByText("Symbols")).toBeVisible();
    expect(screen.getByText("Fees")).toBeVisible();
    expect(screen.getByText("Closed")).toBeVisible();
    expect(screen.getByTestId("batch-ext-total")).toBeVisible();
    expect(screen.getByText("After save")).toBeVisible();
    expect(screen.getByText("Account P&L")).toBeVisible();
    // -50 + (-125.04) = -175.04
    expect(screen.getByText(/-\$175\.04/)).toBeVisible();
    // 10000 + (-125.04) = 9874.96
    expect(screen.getByText("Cash")).toBeVisible();
    expect(screen.getByText(/\$9,874\.96/)).toBeVisible();
  });

  it("omits after-save strip without account baseline", () => {
    render(<BatchTradeResultPreview batch={batch} currency="USD" locale="en-US" />);
    expect(screen.queryByTestId("batch-ext-total")).not.toBeInTheDocument();
    expect(screen.getByText(/-\$125\.04/)).toBeVisible();
  });
});
