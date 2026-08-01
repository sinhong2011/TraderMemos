import { describe, expect, it } from "vite-plus/test";
import { render, screen } from "@testing-library/react";
import { AfterSaveResultPreview, BatchTradeResultPreview } from "./TradeResultPreview";
import type { BatchTradePnlPreview, TradePnlPreview } from "@/lib/tradePnlPreview";

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
    expect(screen.getByText("Balance")).toBeVisible();
    expect(screen.getByText(/\$9,874\.96/)).toBeVisible();
  });

  it("shows the account P&L % against deposited capital", () => {
    render(
      <BatchTradeResultPreview
        batch={batch}
        currency="USD"
        locale="en-US"
        accountNetPnl={-50}
        accountCash={10000}
        depositedCapital={10050}
      />,
    );
    // (-50 - 125.04) / 10050 = -1.7%
    expect(screen.getByText("-1.7%")).toBeVisible();
  });

  it("omits after-save strip without account baseline", () => {
    render(<BatchTradeResultPreview batch={batch} currency="USD" locale="en-US" />);
    expect(screen.queryByTestId("batch-ext-total")).not.toBeInTheDocument();
    expect(screen.getByText(/-\$125\.04/)).toBeVisible();
  });
});

const closedPreview: TradePnlPreview = {
  avgEntry: 1.95,
  avgExit: 2.24,
  positionQty: 0,
  gross: 116,
  feesTotal: 5.41,
  net: 110.59,
  rMultiple: null,
  closed: true,
};

describe("AfterSaveResultPreview", () => {
  it("shows est. P&L with trade return %, balance after, and account P&L after", () => {
    render(
      <AfterSaveResultPreview
        preview={closedPreview}
        entryTotal={780}
        accountNetPnl={-455.12}
        accountCash={1134.35}
        depositedCapital={1589.47}
        currency="USD"
        locale="en-US"
      />,
    );
    expect(screen.getByTestId("after-save-result-preview")).toBeVisible();
    expect(screen.getByText("After save")).toBeVisible();
    expect(screen.getByText(/\+\$110\.59/)).toBeVisible();
    // 110.59 / 780 = +14.2%
    expect(screen.getByText("+14.2%")).toBeVisible();
    // 1134.35 + 110.59 = 1244.94
    expect(screen.getByText(/\$1,244\.94/)).toBeVisible();
    // -455.12 + 110.59 = -344.53
    expect(screen.getByText(/-\$344\.53/)).toBeVisible();
    // -344.53 / 1589.47 = -21.7%
    expect(screen.getByText("-21.7%")).toBeVisible();
  });

  it("renders nothing until a fill exists", () => {
    render(
      <AfterSaveResultPreview
        preview={{ ...closedPreview, avgEntry: null, avgExit: null, net: null, closed: false }}
        entryTotal={null}
        accountNetPnl={null}
        accountCash={null}
        depositedCapital={null}
        currency="USD"
        locale="en-US"
      />,
    );
    expect(screen.queryByTestId("after-save-result-preview")).not.toBeInTheDocument();
  });
});
