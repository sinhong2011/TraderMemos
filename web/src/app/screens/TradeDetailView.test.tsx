import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { Execution, Setup, Tag, TradeAttachment, TradeDetail } from "../../lib/api/types";
import {
  type JournalFormState,
  JournalPanel,
  TradeDetailView,
  journalDraftKey,
} from "./TradeDetailView";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// AuthedImage calls fetch + URL.createObjectURL; stub the whole module so we
// don't need network or real DOM APIs in the unit test.
vi.mock("../../lib/api/client", () => ({
  getToken: () => "test-token",
  apiFetch: vi.fn(),
}));

vi.mock("../../components/charts/TradeChartSection", () => ({
  TradeChartSection: () => <div data-testid="trade-chart-stub" />,
}));

// Stub globalThis.fetch so AuthedImage does not throw (returns a fake blob).
globalThis.fetch = vi.fn().mockResolvedValue({
  ok: false, // triggers the error path -> renders filename fallback
  status: 403,
  blob: vi.fn(),
} as unknown as Response);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockSetup: Setup = {
  id: "s1",
  user_id: "u1",
  name: "ORB",
  description: "",
  created_at: "2026-01-01T00:00:00Z",
  thesis: "",
  symbol: "",
  direction: "",
  target_price: null,
  stop_price: null,
  checklist: [],
};

const mockTags: Tag[] = [
  {
    id: "tag1",
    user_id: "u1",
    name: "Trending",
    color: "#34d399",
    description: "",
    kind: "custom",
  },
  {
    id: "tag2",
    user_id: "u1",
    name: "Chased entry",
    color: "#f87171",
    description: "",
    kind: "mistake",
  },
];

const fill1: Execution = {
  id: "f1",
  user_id: "u1",
  account_id: "a1",
  external_id: null,
  symbol: "AAPL",
  instrument_type: "stock",
  side: "buy",
  quantity: 100,
  price: 175.5,
  fees: 1,
  commission: 0.5,
  executed_at: "2026-03-10T09:30:00Z",
  multiplier: 1,
  details: null,
  import_batch_id: null,
  dedup_hash: "abc",
  created_at: "2026-03-10T09:30:01Z",
};

const fill2: Execution = {
  id: "f2",
  user_id: "u1",
  account_id: "a1",
  external_id: null,
  symbol: "AAPL",
  instrument_type: "stock",
  side: "sell",
  quantity: 100,
  price: 183.0,
  fees: 1,
  commission: 0.5,
  executed_at: "2026-03-10T11:45:00Z",
  multiplier: 1,
  details: null,
  import_batch_id: null,
  dedup_hash: "def",
  created_at: "2026-03-10T11:45:01Z",
};

const mockAttachment: TradeAttachment = {
  id: "att1",
  user_id: "u1",
  trade_id: "t1",
  filename: "entry-chart.png",
  content_type: "image/png",
  size_bytes: 204800,
  storage_key: "some/key",
  created_at: "2026-03-10T12:00:00Z",
};

const mockTrade: TradeDetail = {
  id: "t1",
  account_id: "a1",
  symbol: "AAPL",
  instrument_type: "stock",
  direction: "long",
  status: "closed",
  opened_at: "2026-03-10T09:30:00Z",
  closed_at: "2026-03-10T11:45:00Z",
  qty_opened: 100,
  qty_remaining: 0,
  avg_entry_price: 175.5,
  avg_exit_price: 183.0,
  gross_pnl: 750,
  fees_total: 3,
  net_pnl: 747,
  pnl_currency: "USD",
  return_pct: 4.27,
  time_in_trade_secs: 8100,
  notes: "clean break",
  tags: [mockTags[0]],
  fills: [fill1, fill2],
  setup: mockSetup,
  setup_ids: [mockSetup.id],
  initial_risk: 300,
  target_price: null,
  stop_price: null,
  r_multiple: 2,
  emotional_state: "Focused",
  confidence: 4,
  trade_quality: 5,
  mae: 50,
  mfe: 200,
  dividend_total: 0,
  total_pnl: 747,
  attachments: [mockAttachment],
};

// ---------------------------------------------------------------------------
// Default props
// ---------------------------------------------------------------------------

const defaultProps = {
  trade: mockTrade,
  loading: false,
  error: false,
  setups: [mockSetup],
  allTags: mockTags,
  attachments: [mockAttachment],
  attachmentsLoading: false,
  saving: false,
  uploading: false,
  onSave: vi.fn(),
  onUpload: vi.fn(),
  onDeleteAttachment: vi.fn(),
  onBack: vi.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TradeDetailView", () => {
  async function enterEditMode() {
    await userEvent.click(screen.getByRole("button", { name: "Edit trade log" }));
  }

  async function expandJournal() {
    await userEvent.click(screen.getByRole("button", { name: "Journal" }));
  }

  it("defaults to view mode with journal and dividend collapsed", () => {
    render(<TradeDetailView {...defaultProps} onSaveDividend={vi.fn()} />);
    expect(screen.queryByText("clean break")).not.toBeInTheDocument();
    expect(screen.queryByText("No dividend recorded")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit buy fill/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });

  it("shows read-only journal content when expanded in view mode", async () => {
    render(<TradeDetailView {...defaultProps} />);
    await expandJournal();
    expect(screen.getByText("clean break")).toBeInTheDocument();
    expect(screen.getByText("ORB · main")).toBeInTheDocument();
  });

  it("renders the notes value in the textarea after entering edit mode", async () => {
    render(<TradeDetailView {...defaultProps} />);
    await enterEditMode();
    await expandJournal();
    const textarea = screen.getByRole("textbox", { name: /review notes/i });
    expect(textarea).toHaveValue("clean break");
  });

  it("renders ORB as the main selected setup chip in edit mode", async () => {
    render(<TradeDetailView {...defaultProps} />);
    await enterEditMode();
    await expandJournal();
    expect(screen.getByRole("button", { name: "ORB · main" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("renders R-multiple of 2 in the header", () => {
    render(<TradeDetailView {...defaultProps} />);
    expect(screen.getAllByText("+2.00R").length).toBeGreaterThan(0);
  });

  it("renders trade metrics in the header and coach panel separately", () => {
    render(<TradeDetailView {...defaultProps} />);
    expect(screen.getByText("Coach")).toBeInTheDocument();
    expect(screen.getByText("Gross")).toBeInTheDocument();
    expect(screen.getByText("Plan")).toBeInTheDocument();
    expect(screen.getByText("Capture")).toBeInTheDocument();
    expect(screen.getByText("MAE")).toBeInTheDocument();
    expect(screen.getByText("MFE")).toBeInTheDocument();
    expect(screen.getByText("374%")).toBeInTheDocument(); // net 747 / mfe 200
    expect(screen.getAllByText("Focused").length).toBeGreaterThan(0);
  });

  it("collapses coach when the header is clicked", async () => {
    render(<TradeDetailView {...defaultProps} />);
    expect(screen.getByText(/Write why you entered while it's fresh/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Coach" }));
    expect(screen.queryByText(/Write why you entered while it's fresh/i)).not.toBeInTheDocument();
    expect(screen.getByText("Gross")).toBeInTheDocument();
  });

  it("shows dividend read-only summary in view mode", async () => {
    render(<TradeDetailView {...defaultProps} onSaveDividend={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Dividend" }));
    expect(screen.queryByLabelText("Dividend amount")).not.toBeInTheDocument();
    expect(screen.getByText("No dividend recorded")).toBeInTheDocument();
  });

  it("shows dividend form in edit mode", async () => {
    render(<TradeDetailView {...defaultProps} onSaveDividend={vi.fn()} />);
    await enterEditMode();
    await userEvent.click(screen.getByRole("button", { name: "Dividend" }));
    expect(screen.getByLabelText("Dividend amount")).toBeVisible();
    expect(screen.getByLabelText("Dividend date")).toBeVisible();
    expect(screen.getByRole("button", { name: "Add dividend" })).toBeInTheDocument();
  });

  it("renders two fill rows", () => {
    render(<TradeDetailView {...defaultProps} />);
    // Fills table has BUY and SELL rows
    expect(screen.getByText("BUY")).toBeInTheDocument();
    expect(screen.getByText("SELL")).toBeInTheDocument();
  });

  it("shows edit and delete actions when fill handlers are provided in edit mode", async () => {
    const onEditFill = vi.fn();
    const onDeleteFill = vi.fn();
    render(
      <TradeDetailView {...defaultProps} onEditFill={onEditFill} onDeleteFill={onDeleteFill} />,
    );
    expect(screen.queryByRole("button", { name: /edit buy fill/i })).not.toBeInTheDocument();

    await enterEditMode();
    expect(screen.getByRole("button", { name: /edit buy fill/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete sell fill/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /edit buy fill/i }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Edit fill")).toBeInTheDocument();
  });

  it("renders the fill quantities", () => {
    render(<TradeDetailView {...defaultProps} />);
    // Both fills have qty 100; expect at least one
    const qtyCells = screen.getAllByText("100");
    expect(qtyCells.length).toBeGreaterThanOrEqual(1);
  });

  it("shows Skeleton elements while loading", () => {
    const { container } = render(
      <TradeDetailView {...defaultProps} trade={undefined} loading={true} />,
    );
    const skeletons = container.querySelectorAll('[aria-hidden="true"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows empty/error state when error and no trade", () => {
    render(<TradeDetailView {...defaultProps} trade={undefined} loading={false} error={true} />);
    expect(screen.getByText("Trade not found")).toBeInTheDocument();
  });

  it("renders the attachment filename when journal is expanded", async () => {
    render(<TradeDetailView {...defaultProps} />);
    await expandJournal();
    expect(screen.getAllByText(/entry-chart\.png/).length).toBeGreaterThan(0);
  });

  it("renders the symbol in the header", () => {
    render(<TradeDetailView {...defaultProps} />);
    expect(screen.getByText("AAPL")).toBeInTheDocument();
  });

  it("renders the net P&L in the header", () => {
    render(<TradeDetailView {...defaultProps} />);
    // fmtSignedMoney(747, "USD", "en-US") => "+$747.00" (header + insights)
    expect(screen.getAllByText("+$747.00").length).toBeGreaterThan(0);
  });

  it("renders a WIN outcome badge for a closed profitable trade", () => {
    render(<TradeDetailView {...defaultProps} />);
    expect(screen.getByText("WIN")).toBeInTheDocument();
  });

  it("renders the hold duration in the header timeline", () => {
    render(<TradeDetailView {...defaultProps} />);
    // 8100 secs -> "2h" in compact timeline + insights
    expect(screen.getAllByText(/2h/).length).toBeGreaterThan(0);
  });

  it("marks setup rating A as checked for confidence 4 in edit mode", async () => {
    render(<TradeDetailView {...defaultProps} />);
    await enterEditMode();
    await expandJournal();
    expect(screen.getByRole("radio", { name: "Setup rating A" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("toggles a mistake tag chip in edit mode", async () => {
    render(<TradeDetailView {...defaultProps} />);
    await enterEditMode();
    await expandJournal();
    const chip = screen.getByRole("button", { name: "Chased entry" });
    expect(chip).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
  });

  it("marks main setup and toggles a secondary setup in edit mode", async () => {
    const second: Setup = { ...mockSetup, id: "setup-2", name: "FVG" };
    render(
      <TradeDetailView
        {...defaultProps}
        setups={[mockSetup, second]}
        trade={{ ...mockTrade, setup_ids: [mockSetup.id] }}
      />,
    );
    await enterEditMode();
    await expandJournal();
    expect(screen.getByRole("button", { name: `${mockSetup.name} · main` })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const secondary = screen.getByRole("button", { name: "FVG" });
    expect(secondary).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(secondary);
    expect(secondary).toHaveAttribute("aria-pressed", "true");
  });
});

const emptyJournal: JournalFormState = {
  notes: "",
  session: "",
  entry_reason: "",
  exit_reason: "",
  review_notes: "",
  setup_id: "",
  setup_ids: [],
  initial_risk: "",
  target_price: "",
  stop_price: "",
  emotional_state: "",
  confidence: "",
  trade_quality: "",
  mae: "",
  mfe: "",
  tag_ids: [],
};

function renderJournal(tradeId: string, initial: JournalFormState = emptyJournal) {
  return render(
    <JournalPanel
      tradeId={tradeId}
      initialState={initial}
      setups={[]}
      customTags={[]}
      mistakeTags={[]}
      currency="USD"
      saving={false}
      onSave={vi.fn()}
    />,
  );
}

describe("JournalPanel drafts", () => {
  afterEach(() => localStorage.clear());

  it("restores a differing draft on mount and discards it on request", () => {
    localStorage.setItem(
      journalDraftKey("t1"),
      JSON.stringify({
        at: Date.now(),
        form: { ...emptyJournal, notes: "draft note" },
      }),
    );
    renderJournal("t1");
    expect(screen.getByLabelText("Review notes")).toHaveValue("draft note");
    expect(screen.getByText("Unsaved draft restored.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Discard draft" }));
    expect(screen.getByLabelText("Review notes")).toHaveValue("");
    expect(localStorage.getItem(journalDraftKey("t1"))).toBeNull();
  });

  it("drops a stale draft identical to the server state", () => {
    localStorage.setItem(
      journalDraftKey("t2"),
      JSON.stringify({ at: Date.now(), form: emptyJournal }),
    );
    renderJournal("t2");
    expect(screen.queryByText("Unsaved draft restored.")).not.toBeInTheDocument();
    expect(localStorage.getItem(journalDraftKey("t2"))).toBeNull();
  });

  it("persists edits to a draft after the debounce window", () => {
    vi.useFakeTimers();
    try {
      renderJournal("t3");
      fireEvent.change(screen.getByLabelText("Review notes"), {
        target: { value: "half-written thought" },
      });
      expect(localStorage.getItem(journalDraftKey("t3"))).toBeNull();
      vi.advanceTimersByTime(600);
      const raw = localStorage.getItem(journalDraftKey("t3"));
      expect(raw).not.toBeNull();
      expect(JSON.parse(raw!).form.review_notes).toBe("half-written thought");
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not write a draft when the form is untouched across re-renders", () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(
        <JournalPanel
          tradeId="t4"
          initialState={{ ...emptyJournal }}
          setups={[]}
          customTags={[]}
          mistakeTags={[]}
          currency="USD"
          saving={false}
          onSave={vi.fn()}
        />,
      );
      rerender(
        <JournalPanel
          tradeId="t4"
          initialState={{ ...emptyJournal }}
          setups={[]}
          customTags={[]}
          mistakeTags={[]}
          currency="USD"
          saving={false}
          onSave={vi.fn()}
        />,
      );
      vi.advanceTimersByTime(600);
      expect(localStorage.getItem(journalDraftKey("t4"))).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
