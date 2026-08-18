import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/Toaster";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type RowData,
} from "@/lib/table";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { Execution, Setup, Tag, TradeAttachment, TradeDetail } from "@/lib/api/types";
import {
  type JournalFormState,
  JournalPanel,
  TradeDetailView,
  journalDraftKey,
} from "./TradeDetailView";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("../../lib/api/client", () => ({
  getToken: () => "test-token",
  getBaseUrl: () => "http://test.local",
  apiFetch: vi.fn<(...args: any[]) => any>(),
}));

const tradeCoachMock = vi.hoisted(() => ({
  current: {
    coachConfigured: false,
    settingsPending: false,
    data: undefined as
      | {
          source: "llm" | "off" | "error";
          notes: {
            id: string;
            tone: "neg" | "warn" | "pos" | "tip";
            headline: string;
            detail: string;
            priority: number;
          }[];
          next_action?: string;
          error?: string;
          id?: string;
          created_at?: string;
        }
      | undefined,
    isPending: false,
    isError: false,
    fromStorage: false,
    history: [] as unknown[],
    generate: vi.fn<(...args: any[]) => any>(),
    reset: vi.fn<(...args: any[]) => any>(),
  },
}));

vi.mock("../../lib/hooks/useTradeCoach", () => ({
  useTradeCoach: () => tradeCoachMock.current,
}));

vi.mock("../../components/charts/TradeChartSection", () => ({
  TradeChartSection: () => <div data-testid="trade-chart-stub" />,
}));

// Mock DataTable: the real one virtualizes against a measured container, which
// jsdom never gives it, so it renders zero rows. Mirrors HomeView.test.
vi.mock("../../components/DataTable", () => ({
  DataTable: function MockDataTable<T extends RowData>({
    columns,
    data,
  }: {
    columns: ColumnDef<T>[];
    data: T[];
  }) {
    const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });
    return (
      <table>
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th key={h.id}>
                  {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  },
}));

globalThis.fetch = vi.fn<(...args: any[]) => any>().mockResolvedValue({
  ok: false,
  status: 403,
  blob: vi.fn<(...args: any[]) => any>(),
} as unknown as Response);

function renderView(ui: ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <Toaster>{ui}</Toaster>
    </QueryClientProvider>,
  );
}

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
  tags: [mockTags[0]!],
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
  post_exit_mae: null,
  post_exit_mfe: null,
  dividend_total: 0,
  total_pnl: 747,
  attachments: [mockAttachment],
};

const defaultProps = {
  trade: mockTrade,
  loading: false,
  error: false,
  onBack: vi.fn<(...args: any[]) => any>(),
  onEdit: vi.fn<(...args: any[]) => any>(),
};

describe("TradeDetailView", () => {
  afterEach(() => {
    tradeCoachMock.current = {
      coachConfigured: false,
      settingsPending: false,
      data: undefined,
      isPending: false,
      isError: false,
      fromStorage: false,
      history: [],
      generate: vi.fn<(...args: any[]) => any>(),
      reset: vi.fn<(...args: any[]) => any>(),
    };
  });

  it("renders the executions table on the shared DataTable", () => {
    renderView(<TradeDetailView {...defaultProps} />);
    expect(screen.getByText("Executions (2)")).toBeInTheDocument();
    expect(screen.getByText("BUY")).toBeInTheDocument();
    expect(screen.getByText("SELL")).toBeInTheDocument();
    // Value = qty × price × multiplier — 100 × 175.50 on the buy, 100 × 183 on
    // the sell — the same number the trade log's Ent tot / Ext tot columns show.
    expect(screen.getAllByText("$17,550.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$18,300.00").length).toBeGreaterThan(0);
    // Two fills is not a scaled trade, so the position column stays out.
    expect(screen.queryByText("Pos")).not.toBeInTheDocument();
    // Fee total rides in the card header rather than a footer band.
    expect(screen.getByText(/\$3\.00 fees/)).toBeInTheDocument();
  });

  it("renders the journal read-only and routes editing to the drawer", async () => {
    const onEdit = vi.fn<(...args: any[]) => any>();
    renderView(<TradeDetailView {...defaultProps} onEdit={onEdit} />);
    expect(screen.getByText("Journal")).toBeInTheDocument();
    // Freeform pre-template notes still surface.
    expect(screen.getByText("clean break")).toBeInTheDocument();
    expect(screen.getByText("ORB")).toBeInTheDocument();
    // No inline form on the page — the drawer owns every journal input.
    expect(screen.queryByLabelText("Review notes")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Edit journal" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("places Edit at the page top right and calls onEdit", async () => {
    const onEdit = vi.fn<(...args: any[]) => any>();
    renderView(<TradeDetailView {...defaultProps} onEdit={onEdit} />);
    await userEvent.click(screen.getByRole("button", { name: "Edit trade" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("requires typing the symbol before removing a trade", async () => {
    const onDelete = vi.fn<(...args: any[]) => any>();
    renderView(<TradeDetailView {...defaultProps} onDelete={onDelete} />);
    await userEvent.click(screen.getByRole("button", { name: "Trade actions" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Remove trade" }));
    const dialog = screen.getByRole("dialog", { name: /Remove AAPL/i });
    expect(dialog).toBeVisible();
    const footerRemove = within(dialog).getByRole("button", { name: "Remove trade" });
    expect(footerRemove).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText(/Type AAPL to confirm/i), "AAPL");
    expect(footerRemove).toBeEnabled();
    await userEvent.click(footerRemove);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("renders R-multiple of 2 in the header", () => {
    renderView(<TradeDetailView {...defaultProps} />);
    expect(screen.getAllByText("+2.00R").length).toBeGreaterThan(0);
  });

  it("splits summary, plan, and coach across their own cards", () => {
    renderView(<TradeDetailView {...defaultProps} />);
    expect(screen.getByText("Coach")).toBeInTheDocument();
    expect(screen.getByText("Gross")).toBeInTheDocument();
    expect(screen.getByText("Plan vs actual")).toBeInTheDocument();
    // Excursion lives with the plan now, not inside the coach panel.
    expect(screen.getByText("Capture")).toBeInTheDocument();
    expect(screen.getByText("MAE")).toBeInTheDocument();
    expect(screen.getByText("MFE")).toBeInTheDocument();
    expect(screen.getByText("374%")).toBeInTheDocument();
    expect(screen.getAllByText("Focused").length).toBeGreaterThan(0);
  });

  it("keeps net P&L to a single hero figure", () => {
    renderView(<TradeDetailView {...defaultProps} />);
    // Once in the summary hero, once as the realized bar in Plan vs actual —
    // never twice inside the same card as the old bento did.
    expect(screen.getAllByText("+$747.00")).toHaveLength(2);
  });

  it("prompts for a plan instead of rendering a grid of dashes", () => {
    const onEdit = vi.fn<(...args: any[]) => any>();
    renderView(
      <TradeDetailView
        {...defaultProps}
        onEdit={onEdit}
        trade={{ ...mockTrade, initial_risk: null, r_multiple: null, mae: null, mfe: null }}
      />,
    );
    expect(screen.getByText(/No plan recorded/i)).toBeInTheDocument();
    expect(screen.queryByText("Planned R:R")).not.toBeInTheDocument();
    // A closed stock trade can still auto-fill excursion from bars.
    expect(
      screen.getByRole("button", { name: /Auto-fill MAE\/MFE from market data/i }),
    ).toBeInTheDocument();
  });

  it("computes MAE/MFE from bars via the plan card", async () => {
    const { apiFetch } = await import("../../lib/api/client");
    // Route only the excursion call; other queries (attachments…) keep the
    // undefined default so this stub cannot leak into later tests.
    vi.mocked(apiFetch).mockImplementation(async (path: unknown) =>
      String(path).endsWith("/excursion")
        ? { mae: 120, mfe: 300, interval: "1", bars_used: 42, provider: "yahoo" }
        : undefined,
    );
    renderView(<TradeDetailView {...defaultProps} />);
    await userEvent.click(screen.getByRole("button", { name: /Recompute from bars/i }));
    expect(vi.mocked(apiFetch).mock.calls).toContainEqual([
      "/trades/t1/excursion",
      { method: "POST" },
    ]);
    expect(await screen.findByText("Excursion updated")).toBeInTheDocument();
    vi.mocked(apiFetch).mockReset();
  });

  it("hides auto excursion for open trades and options", () => {
    const { unmount } = renderView(
      <TradeDetailView {...defaultProps} trade={{ ...mockTrade, status: "open" }} />,
    );
    expect(screen.queryByRole("button", { name: /from bars/i })).not.toBeInTheDocument();
    unmount();
    renderView(
      <TradeDetailView {...defaultProps} trade={{ ...mockTrade, instrument_type: "option" }} />,
    );
    expect(screen.queryByRole("button", { name: /from bars/i })).not.toBeInTheDocument();
  });

  it("collapses coach when the header is clicked", async () => {
    renderView(<TradeDetailView {...defaultProps} />);
    expect(screen.getByText(/Write why you entered while it's fresh/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Coach" }));
    expect(screen.queryByText(/Write why you entered while it's fresh/i)).not.toBeInTheDocument();
    expect(screen.getByText("Gross")).toBeInTheDocument();
  });

  it("shows Ask AI when coach is configured and generates on click", async () => {
    const generate = vi.fn<(...args: any[]) => any>();
    tradeCoachMock.current = {
      coachConfigured: true,
      settingsPending: false,
      data: undefined,
      isPending: false,
      isError: false,
      fromStorage: false,
      history: [],
      generate,
      reset: vi.fn<(...args: any[]) => any>(),
    };
    renderView(<TradeDetailView {...defaultProps} />);
    expect(screen.getByText(/click Ask AI for model coaching/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Ask AI coach" }));
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("shows LLM coach notes when the coach API returns them", () => {
    tradeCoachMock.current = {
      coachConfigured: true,
      settingsPending: false,
      data: {
        source: "llm",
        notes: [
          {
            id: "llm-1",
            tone: "tip",
            headline: "Hold winners longer",
            detail: "MFE capture was only 40% — trail the stop next time.",
            priority: 1,
          },
        ],
      },
      isPending: false,
      isError: false,
      fromStorage: false,
      history: [],
      generate: vi.fn<(...args: any[]) => any>(),
      reset: vi.fn<(...args: any[]) => any>(),
    };
    renderView(<TradeDetailView {...defaultProps} />);
    expect(screen.getByText("AI")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Regenerate AI coach" })).toBeInTheDocument();
    expect(screen.getByText("Hold winners longer")).toBeInTheDocument();
    expect(screen.getByText(/trail the stop next time/i)).toBeInTheDocument();
    expect(screen.queryByText(/Write why you entered while it's fresh/i)).not.toBeInTheDocument();
  });

  it("shows the next action the model committed to", () => {
    tradeCoachMock.current = {
      coachConfigured: true,
      settingsPending: false,
      data: {
        source: "llm",
        notes: [
          {
            id: "llm-1",
            tone: "warn",
            headline: "Size ran ahead of the plan",
            detail: "Risk was 1.8× your recent median.",
            priority: 1,
          },
        ],
        next_action: "Size the next trade at or below 1R before entering.",
      },
      isPending: false,
      isError: false,
      fromStorage: false,
      history: [],
      generate: vi.fn<(...args: any[]) => any>(),
      reset: vi.fn<(...args: any[]) => any>(),
    };
    renderView(<TradeDetailView {...defaultProps} />);
    expect(screen.getByText("Next action")).toBeInTheDocument();
    expect(screen.getByText(/at or below 1R before entering/i)).toBeInTheDocument();
  });

  // A review read back from storage is dated, so it does not read as advice
  // just written about the trade in front of you.
  it("dates a review that came from storage", () => {
    tradeCoachMock.current = {
      coachConfigured: true,
      settingsPending: false,
      data: {
        source: "llm",
        notes: [{ id: "llm-1", tone: "tip", headline: "Stored note", detail: "D", priority: 1 }],
        next_action: "Size at or below 1R.",
        id: "rev-1",
        created_at: "2026-03-12T14:30:00Z",
      },
      isPending: false,
      isError: false,
      fromStorage: true,
      history: [],
      generate: vi.fn<(...args: any[]) => any>(),
      reset: vi.fn<(...args: any[]) => any>(),
    };
    renderView(<TradeDetailView {...defaultProps} />);
    expect(screen.getByText(/Saved review from/i)).toBeInTheDocument();
    expect(screen.getByText("Stored note")).toBeInTheDocument();
    expect(screen.getByText("Next action")).toBeInTheDocument();
  });

  it("labels a freshly generated review as generated, not saved", () => {
    tradeCoachMock.current = {
      coachConfigured: true,
      settingsPending: false,
      data: {
        source: "llm",
        notes: [{ id: "llm-1", tone: "tip", headline: "Fresh note", detail: "D", priority: 1 }],
        id: "rev-2",
        created_at: "2026-03-12T14:30:00Z",
      },
      isPending: false,
      isError: false,
      fromStorage: false,
      history: [],
      generate: vi.fn<(...args: any[]) => any>(),
      reset: vi.fn<(...args: any[]) => any>(),
    };
    renderView(<TradeDetailView {...defaultProps} />);
    expect(screen.queryByText(/Saved review from/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Generated from this trade/i)).toBeInTheDocument();
  });

  it("omits the next action when the model returned none", () => {
    tradeCoachMock.current = {
      coachConfigured: true,
      settingsPending: false,
      data: {
        source: "llm",
        notes: [{ id: "llm-1", tone: "tip", headline: "H", detail: "D", priority: 1 }],
      },
      isPending: false,
      isError: false,
      fromStorage: false,
      history: [],
      generate: vi.fn<(...args: any[]) => any>(),
      reset: vi.fn<(...args: any[]) => any>(),
    };
    renderView(<TradeDetailView {...defaultProps} />);
    expect(screen.queryByText("Next action")).not.toBeInTheDocument();
  });

  // The action is the model's; pairing it with rule-based fallback notes would
  // attribute it to advice that never ran.
  it("does not show a next action alongside rule-based notes", () => {
    tradeCoachMock.current = {
      coachConfigured: true,
      settingsPending: false,
      data: {
        source: "error",
        notes: [],
        next_action: "Should never surface.",
        error: "coach api 502: boom",
      },
      isPending: false,
      isError: false,
      fromStorage: false,
      history: [],
      generate: vi.fn<(...args: any[]) => any>(),
      reset: vi.fn<(...args: any[]) => any>(),
    };
    renderView(<TradeDetailView {...defaultProps} />);
    expect(screen.getByText("Rules")).toBeInTheDocument();
    expect(screen.queryByText("Next action")).not.toBeInTheDocument();
    expect(screen.queryByText(/Should never surface/i)).not.toBeInTheDocument();
  });

  it("falls back to rule notes when coach API errors", () => {
    tradeCoachMock.current = {
      coachConfigured: true,
      settingsPending: false,
      data: { source: "error", notes: [], error: "coach api 502: boom" },
      isPending: false,
      isError: false,
      fromStorage: false,
      history: [],
      generate: vi.fn<(...args: any[]) => any>(),
      reset: vi.fn<(...args: any[]) => any>(),
    };
    renderView(<TradeDetailView {...defaultProps} />);
    expect(screen.getByText("Rules")).toBeInTheDocument();
    expect(screen.getByText(/Write why you entered while it's fresh/i)).toBeInTheDocument();
    expect(screen.getByText(/coach api 502/i)).toBeInTheDocument();
  });

  it("does not show Ask AI when coach is not configured", () => {
    renderView(<TradeDetailView {...defaultProps} />);
    expect(screen.queryByRole("button", { name: "Ask AI coach" })).not.toBeInTheDocument();
    expect(screen.getByText(/Write why you entered while it's fresh/i)).toBeInTheDocument();
  });

  it("shows Skeleton elements while loading", () => {
    const { container } = renderView(
      <TradeDetailView {...defaultProps} trade={undefined} loading={true} />,
    );
    const skeletons = container.querySelectorAll('[aria-hidden="true"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows empty/error state when error and no trade", () => {
    renderView(
      <TradeDetailView {...defaultProps} trade={undefined} loading={false} error={true} />,
    );
    expect(screen.getByText("Trade not found")).toBeInTheDocument();
  });

  it("renders the symbol in the header", () => {
    renderView(<TradeDetailView {...defaultProps} />);
    expect(screen.getByText("AAPL")).toBeInTheDocument();
  });

  it("renders the net P&L in the header", () => {
    renderView(<TradeDetailView {...defaultProps} />);
    expect(screen.getAllByText("+$747.00").length).toBeGreaterThan(0);
  });

  it("renders a WIN outcome badge for a closed profitable trade", () => {
    renderView(<TradeDetailView {...defaultProps} />);
    expect(screen.getByText("WIN")).toBeInTheDocument();
  });

  it("renders the hold duration in the header timeline", () => {
    renderView(<TradeDetailView {...defaultProps} />);
    expect(screen.getAllByText(/2h/).length).toBeGreaterThan(0);
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
      onSave={vi.fn<(...args: any[]) => any>()}
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
          onSave={vi.fn<(...args: any[]) => any>()}
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
          onSave={vi.fn<(...args: any[]) => any>()}
        />,
      );
      vi.advanceTimersByTime(600);
      expect(localStorage.getItem(journalDraftKey("t4"))).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
