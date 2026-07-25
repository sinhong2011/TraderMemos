import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { importsApi } from "@/lib/api/imports";

export function useImports() {
  return useQuery({ queryKey: ["imports"], queryFn: () => importsApi.list() });
}

export function useImportPreview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => importsApi.preview(formData),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["imports"] }),
  });
}

export function useImportCommit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, formData }: { id: string; formData: FormData }) =>
      importsApi.commit(id, formData),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["imports"] });
      void queryClient.invalidateQueries({ queryKey: ["trades"] });
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      void queryClient.invalidateQueries({ queryKey: ["cash"] });
    },
  });
}

export function useDeleteImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => importsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["imports"] }),
  });
}
