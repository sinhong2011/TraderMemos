import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import { ImportJournalDetailModal } from "./ImportJournalDetailModal";
import { journalTradePreviewColumns } from "./importPreviewColumns";
import type { JournalTradePreview } from "../lib/api/types";

const sampleTrade: JournalTradePreview = {
  row: 2,
  symbol: "TSLA 240119C00200000",
  market: "OPTION",
  instrument_type: "option",
  option_right: "call",
  side: "LONG",
  status: "WIN",
  qty: 1,
  entry: 2.5,
  exit: 3.1,
  return_usd: 60,
  return_pct: 24,
  open_date: "2026-07-10T15:19:46.000Z",
  close_date: "2026-07-10T15:31:16.000Z",
  setup: "Breakout",
  notes: "Scaled out early",
};

describe("journalTradePreviewColumns", () => {
  it("includes a Details action when onDetails is provided", () => {
    const onDetails = vi.fn();
    const columns = journalTradePreviewColumns("USD", onDetails);
    const marketCol = columns.find((c) => c.id === "market");
    expect(
      marketCol &&
        "accessorFn" in marketCol &&
        typeof marketCol.accessorFn === "function" &&
        marketCol.accessorFn(sampleTrade, 0),
    ).toBe("CALL");

    const actionsCol = columns.find((c) => c.id === "actions");
    expect(actionsCol).toBeDefined();
  });

  it("omits the actions column without onDetails", () => {
    const columns = journalTradePreviewColumns("USD");
    expect(columns.find((c) => c.id === "actions")).toBeUndefined();
  });
});

describe("ImportJournalDetailModal", () => {
  it("shows trade details when open", async () => {
    render(
      <ImportJournalDetailModal
        trade={sampleTrade}
        currency="USD"
        open
        onOpenChange={vi.fn()}
        optionRight="call"
        onOptionRightChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "TSLA 240119C00200000" })).toBeInTheDocument();
    expect(screen.getByText(/Import preview · Row 2/)).toBeInTheDocument();
    expect(screen.getByText("OPT · CALL")).toBeInTheDocument();
    expect(screen.getByLabelText("Option type")).toBeInTheDocument();
    expect(screen.getByText("WIN")).toBeInTheDocument();
    expect(screen.queryByText("Confidence")).not.toBeInTheDocument();
    expect(screen.getByText("Breakout")).toBeInTheDocument();
    expect(screen.getByText("Scaled out early")).toBeInTheDocument();
  });

  it("closes when the close button is clicked", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <ImportJournalDetailModal
        trade={sampleTrade}
        currency="USD"
        open
        onOpenChange={onOpenChange}
      />,
    );

    await user.click(screen.getByLabelText("Close"));
    expect(onOpenChange).toHaveBeenCalled();
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(false);
  });
});
