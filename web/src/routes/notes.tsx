import { createFileRoute } from "@tanstack/react-router";
import { NotesView } from "@/app/screens/NotesView";
import { useToastManager } from "@/components/Toast";
import { useDeleteNote, useNotes } from "@/lib/hooks/useNotes";
import { useRoutineHistory } from "@/lib/hooks/useRoutines";
import { addDays } from "@/lib/routines";
import { useMarketToday } from "@/lib/today";

export const Route = createFileRoute("/notes")({
  component: NotesPage,
});

function NotesPage() {
  const toast = useToastManager();
  const notesQ = useNotes();
  const deleteM = useDeleteNote();
  // Daily logs show their day's routine; the history endpoint spans at most 400 days.
  const today = useMarketToday();
  const routineQ = useRoutineHistory(addDays(today, -399), today);
  const routineByDay = Object.fromEntries(
    (routineQ.data?.days ?? []).filter((d) => d.total > 0).map((d) => [d.day, d]),
  );

  return (
    <NotesView
      notes={notesQ.data ?? []}
      loading={notesQ.isLoading}
      error={notesQ.isError}
      routineByDay={routineByDay}
      onDelete={async (id) => {
        const title = notesQ.data?.find((n) => n.id === id)?.title ?? "Note";
        try {
          await deleteM.mutateAsync(id);
          toast.add({ title: "Note deleted", description: title });
        } catch (err) {
          toast.add({
            title: "Could not delete note",
            description: err instanceof Error ? err.message : "Request failed",
          });
          throw err;
        }
      }}
    />
  );
}
