import { createFileRoute } from "@tanstack/react-router";
import { NotesView } from "@/app/screens/NotesView";
import { useToastManager } from "@/components/Toast";
import { useDeleteNote, useNotes } from "@/lib/hooks/useNotes";

export const Route = createFileRoute("/notes")({
  component: NotesPage,
});

function NotesPage() {
  const toast = useToastManager();
  const notesQ = useNotes();
  const deleteM = useDeleteNote();

  return (
    <NotesView
      notes={notesQ.data ?? []}
      loading={notesQ.isLoading}
      error={notesQ.isError}
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
