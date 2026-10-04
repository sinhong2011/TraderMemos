import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  RoutineDayCard,
  RoutineEditorCard,
  RoutineHistoryCard,
  RoutinesView,
} from "@/app/screens/RoutinesView";
import { useToastManager } from "@/components/Toast";
import type { RoutineItem } from "@/lib/api/routines";
import {
  useArchiveRoutine,
  useCheckRoutine,
  useCreateRoutine,
  useOrderRoutines,
  useRoutineDay,
  useRoutineHistory,
  useRoutineItems,
  useUpdateRoutine,
} from "@/lib/hooks/useRoutines";
import { addDays } from "@/lib/routines";
import { useMarketToday } from "@/lib/today";

export const Route = createFileRoute("/routines")({
  component: RoutinesPage,
});

/** Monday of the week twelve weeks before this one: 13 whole-week columns. */
function historyStart(today: string): string {
  const [y, m, d] = today.split("-").map(Number);
  const sinceMonday = (new Date(y, m - 1, d).getDay() + 6) % 7;
  return addDays(today, -sinceMonday - 7 * 12);
}

function RoutinesPage() {
  const toast = useToastManager();
  const today = useMarketToday();
  const [selected, setSelected] = useState(today);

  const itemsQ = useRoutineItems(today);
  const dayQ = useRoutineDay(selected);
  const historyQ = useRoutineHistory(historyStart(today), today);
  const check = useCheckRoutine();
  const create = useCreateRoutine();
  const update = useUpdateRoutine();
  const archive = useArchiveRoutine();
  const order = useOrderRoutines();

  const items = itemsQ.data?.items ?? [];
  const fail = (title: string) => (err: unknown) =>
    toast.add({ title, description: err instanceof Error ? err.message : "Request failed" });

  return (
    <RoutinesView>
      <RoutineDayCard
        day={selected}
        today={today}
        data={dayQ.data}
        loading={dayQ.isLoading || itemsQ.isLoading}
        error={dayQ.isError}
        hasItems={items.length > 0 || (dayQ.data?.total ?? 0) > 0}
        onCheck={(id, done) =>
          check.mutate({ day: selected, id, done }, { onError: fail("Could not save the tick") })
        }
        onToday={() => setSelected(today)}
      />
      <RoutineHistoryCard
        history={historyQ.data}
        loading={historyQ.isLoading}
        error={historyQ.isError}
        today={today}
        selected={selected}
        onSelect={setSelected}
      />
      <RoutineEditorCard
        items={items}
        loading={itemsQ.isLoading}
        onCreate={async (body) => {
          try {
            await create.mutateAsync({ ...body, day: today });
          } catch (err) {
            fail("Could not add the item")(err);
            throw err;
          }
        }}
        onUpdate={(id, body) =>
          update.mutate({ id, body: { ...body, day: today } }, { onError: fail("Could not save") })
        }
        onArchive={(item: RoutineItem) =>
          archive.mutate(
            { id: item.id, day: today },
            {
              onSuccess: () =>
                toast.add({
                  title: "Removed from routine",
                  description: `${item.title} — past days keep it.`,
                }),
              onError: fail("Could not remove the item"),
            },
          )
        }
        onMove={(_stage, ids) => {
          // Positions are global; send every item with this stage's new order spliced in.
          const others = items.filter((it) => !ids.includes(it.id)).map((it) => it.id);
          order.mutate([...others, ...ids], { onError: fail("Could not reorder") });
        }}
      />
    </RoutinesView>
  );
}
