import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import type { RoutineDay, RoutineHistory, RoutineItem } from "@/lib/api/routines";
import { weekdaysLabel } from "@/lib/routines";
import { RoutineDayCard, RoutineEditorCard, RoutineHistoryCard } from "./RoutinesView";

const item = (over: Partial<RoutineItem>): RoutineItem => ({
  id: "a",
  title: "Mark key levels",
  stage: "pre",
  weekdays: [1, 2, 3, 4, 5],
  position: 0,
  start_day: "2026-09-01",
  ...over,
});

const day: RoutineDay = {
  day: "2026-10-01",
  total: 2,
  done: 1,
  items: [
    { ...item({ id: "a" }), done: true },
    { ...item({ id: "b", title: "Journal the day", stage: "post" }), done: false },
  ],
};

describe("weekdaysLabel", () => {
  it("names common schedules and lists the rest Monday first", () => {
    expect(weekdaysLabel([0, 1, 2, 3, 4, 5, 6])).toBe("Every day");
    expect(weekdaysLabel([1, 2, 3, 4, 5])).toBe("Weekdays");
    expect(weekdaysLabel([0, 6])).toBe("Weekends");
    expect(weekdaysLabel([0, 2, 4])).toBe("Tue, Thu, Sun");
  });
});

describe("RoutineDayCard", () => {
  const base = {
    day: "2026-10-01",
    today: "2026-10-01",
    loading: false,
    error: false,
    hasItems: true,
    onToday: vi.fn<() => void>(),
  };

  it("groups by stage and ticks through onCheck", () => {
    const onCheck = vi.fn<(id: string, done: boolean) => void>();
    render(<RoutineDayCard {...base} data={day} onCheck={onCheck} />);
    expect(screen.getByText("Before trading")).toBeTruthy();
    expect(screen.getByText("After trading")).toBeTruthy();
    expect(screen.getByTestId("routine-day-progress").textContent).toBe("1/2");
    fireEvent.click(screen.getByLabelText("Journal the day"));
    expect(onCheck).toHaveBeenCalledWith("b", true);
    fireEvent.click(screen.getByLabelText("Mark key levels"));
    expect(onCheck).toHaveBeenCalledWith("a", false);
  });

  it("offers a way back from a past day", () => {
    const onToday = vi.fn<() => void>();
    render(
      <RoutineDayCard
        {...base}
        day="2026-09-29"
        data={day}
        onCheck={vi.fn<(id: string, done: boolean) => void>()}
        onToday={onToday}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Back to today" }));
    expect(onToday).toHaveBeenCalled();
  });

  it("says when nothing is scheduled, and when there is no routine at all", () => {
    const { rerender } = render(
      <RoutineDayCard
        {...base}
        data={{ ...day, items: [], total: 0, done: 0 }}
        onCheck={vi.fn<(id: string, done: boolean) => void>()}
      />,
    );
    expect(screen.getByText("Nothing scheduled for today.")).toBeTruthy();
    rerender(
      <RoutineDayCard
        {...base}
        hasItems={false}
        data={undefined}
        onCheck={vi.fn<(id: string, done: boolean) => void>()}
      />,
    );
    expect(screen.getByText("No routine yet")).toBeTruthy();
  });
});

describe("RoutineHistoryCard", () => {
  const history: RoutineHistory = {
    from: "2026-09-28",
    to: "2026-10-01",
    days: [
      { day: "2026-09-28", total: 2, done: 2 },
      { day: "2026-09-29", total: 2, done: 0 },
      { day: "2026-09-30", total: 2, done: 2 },
      { day: "2026-10-01", total: 2, done: 1 },
    ],
    completion_rate: 5 / 8,
    streak: 1,
    by_stage: {
      pre: { total: 4, done: 3 },
      during: { total: 0, done: 0 },
      post: { total: 4, done: 2 },
    },
  };

  it("shows rate, streak and per-stage rates, and selects a day", () => {
    const onSelect = vi.fn<(day: string) => void>();
    render(
      <RoutineHistoryCard
        history={history}
        loading={false}
        error={false}
        today="2026-10-01"
        selected="2026-10-01"
        onSelect={onSelect}
      />,
    );
    expect(screen.getByTestId("routine-completion").textContent).toBe("63%");
    expect(screen.getByTestId("routine-streak").textContent).toBe("1 day");
    expect(screen.getByText("75%")).toBeTruthy(); // before trading
    expect(screen.queryByText("During trading")).toBeNull(); // no list, no rate
    fireEvent.click(screen.getByLabelText("2026-09-29: 0/2"));
    expect(onSelect).toHaveBeenCalledWith("2026-09-29");
    expect(
      (screen.getByLabelText("2026-10-02") as HTMLButtonElement).disabled,
      "future days can't be picked",
    ).toBe(true);
  });
});

describe("RoutineEditorCard", () => {
  const handlers = () => ({
    onCreate: vi.fn<(b: { title: string; stage: string; weekdays: number[] }) => Promise<void>>(
      async () => {},
    ),
    onUpdate: vi.fn<(id: string, b: object) => void>(),
    onArchive: vi.fn<(it: RoutineItem) => void>(),
    onMove: vi.fn<(stage: string, ids: string[]) => void>(),
  });

  it("adds an item with Monday to Friday by default", async () => {
    const h = handlers();
    render(<RoutineEditorCard items={[]} loading={false} {...h} />);
    fireEvent.change(screen.getByLabelText("New routine item"), {
      target: { value: "  Check news " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await vi.waitFor(() =>
      expect(h.onCreate).toHaveBeenCalledWith({
        title: "Check news",
        stage: "pre",
        weekdays: [1, 2, 3, 4, 5],
      }),
    );
  });

  it("renames on Enter and abandons on Escape", () => {
    const h = handlers();
    render(<RoutineEditorCard items={[item({})]} loading={false} {...h} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark key levels" }));
    const input = screen.getByLabelText("Rename Mark key levels");
    fireEvent.change(input, { target: { value: "Mark levels" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(h.onUpdate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Mark key levels" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Mark key levels" }));
    const again = screen.getByLabelText("Rename Mark key levels");
    fireEvent.change(again, { target: { value: "Mark levels" } });
    fireEvent.keyDown(again, { key: "Enter" });
    expect(h.onUpdate).toHaveBeenCalledWith("a", { title: "Mark levels" });
  });

  it("toggles a weekday, keeps the last one on, and reorders within a stage", () => {
    const h = handlers();
    render(
      <RoutineEditorCard
        items={[item({}), item({ id: "b", title: "Bias", position: 1, weekdays: [3] })]}
        loading={false}
        {...h}
      />,
    );
    const days = screen.getByRole("group", { name: "Days for Mark key levels" });
    fireEvent.click(days.querySelector('[aria-label="Sat"]')!);
    expect(h.onUpdate).toHaveBeenCalledWith("a", { weekdays: [1, 2, 3, 4, 5, 6] });
    const only = screen.getByRole("group", { name: "Days for Bias" });
    expect((only.querySelector('[aria-label="Wed"]') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Move Bias up" }));
    expect(h.onMove).toHaveBeenCalledWith("pre", ["b", "a"]);
  });
});
