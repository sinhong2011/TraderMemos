import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cashApi } from "../api/cash";
import type { Filters } from "../api/types";

export function useCash(filters: Filters) {
	return useQuery({
		queryKey: ["cash", filters],
		queryFn: () => cashApi.list(filters),
	});
}

export function useCreateCash() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: cashApi.create,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cash"] }),
	});
}

export function useDeleteCash() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => cashApi.delete(id),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cash"] }),
	});
}
