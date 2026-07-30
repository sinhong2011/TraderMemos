import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notesApi, type NoteBody } from "@/lib/api/notes";

export function useNotes(f?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ["notes", f?.from ?? null, f?.to ?? null],
    queryFn: () => notesApi.list(f),
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: NoteBody) => notesApi.create(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notes"] }),
  });
}

export function useUpdateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: NoteBody }) => notesApi.update(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notes"] }),
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notes"] }),
  });
}
