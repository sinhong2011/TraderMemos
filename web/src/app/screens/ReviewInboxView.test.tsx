import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import type { Tag, Trade, TradeDetail } from "@/lib/api/types";
import { ReviewInboxView, type ReviewInboxViewProps } from "./ReviewInboxView";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a>,
}));

const chased: Tag = { id: "m1", name: "Chased", kind: "mistake" } as Tag;
const moved: Tag = { id: "m2", name: "Moved stop", kind: "mistake" } as Tag;
const custom: Tag = { id: "c1", name: "A+ setup", kind: "custom" } as Tag;

const trade = {
  id: "t1",
  symbol: "TSLA",
  direction: "long",
  closed_at: "2026-10-02T19:00:00Z",
  avg_entry_price: 100,
  avg_exit_price: 98.6,
  net_pnl: -140,
  pnl_currency: "USD",
  tags: [custom, chased],
} as Trade;

const detail = {
  ...trade,
  notes: "## Entry reason\nBreak of PM high\n\n## Review notes\nOld lesson",
  trade_quality: null,
  r_multiple: -1.4,
  setup: null,
} as unknown as TradeDetail;

function setup(overrides: Partial<ReviewInboxViewProps> = {}) {
  const onSave = vi.fn<ReviewInboxViewProps["onSave"]>(async () => {});
  const props: ReviewInboxViewProps = {
    items: [trade],
    loading: false,
    error: false,
    backlog: 0,
    windowDays: 14,
    detail,
    detailLoading: false,
    mistakeTags: [chased, moved],
    index: 0,
    onIndexChange: vi.fn<(n: number) => void>(),
    onSave,
    saving: false,
    onDismissBacklog: async () => {},
    dismissing: false,
    reviewedThisSession: 0,
    ...overrides,
  };
  render(<ReviewInboxView {...props} />);
  return { onSave, props };
}

describe("ReviewInboxView", () => {
  it("prefills the lesson and mistakes from the trade's journal", () => {
    setup();
    expect(screen.getByDisplayValue("Old lesson")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chased" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Moved stop" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("needs a grade before it saves", () => {
    setup();
    expect(screen.getByRole("button", { name: "Save & next" })).toBeDisabled();
  });

  it("saves the grade, merges the lesson and keeps the other notes and tags", async () => {
    const { onSave } = setup();
    await userEvent.keyboard("4"); // B
    expect(screen.getByRole("radio", { name: /^B/ })).toHaveAttribute("aria-checked", "true");
    const lesson = screen.getByDisplayValue("Old lesson");
    await userEvent.clear(lesson);
    await userEvent.type(lesson, "Wait for the retest");
    await userEvent.click(screen.getByRole("button", { name: "Chased" })); // off
    await userEvent.click(screen.getByRole("button", { name: "Moved stop" })); // on
    await userEvent.click(screen.getByRole("button", { name: "Save & next" }));

    expect(onSave).toHaveBeenCalledWith("t1", {
      trade_quality: 2,
      notes: "## Entry reason\nBreak of PM high\n\n## Review notes\nWait for the retest",
      tag_ids: ["c1", "m2"],
    });
  });

  it("shows inbox zero when nothing is left", () => {
    setup({ items: [], reviewedThisSession: 3 });
    expect(screen.getByText("Inbox zero")).toBeInTheDocument();
    expect(screen.getByText(/3 trades reviewed/)).toBeInTheDocument();
  });

  it("asks before dismissing the backlog", async () => {
    const onDismissBacklog = vi.fn<() => Promise<void>>(async () => {});
    setup({ backlog: 12, onDismissBacklog });
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onDismissBacklog).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    await userEvent.click(screen.getByRole("button", { name: "Stop counting them" }));
    expect(onDismissBacklog).toHaveBeenCalledTimes(1);
  });
});
