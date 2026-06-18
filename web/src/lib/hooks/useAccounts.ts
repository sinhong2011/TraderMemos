import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { accountsApi } from "../api/accounts";

export function useAccounts() {
	return useQuery({
		queryKey: ["accounts"],
		queryFn: () => accountsApi.list(),
	});
}

export function useCreateAccount() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: accountsApi.create,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["accounts"] }),
	});
}

export function useUpdateAccount() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			id,
			body,
		}: Parameters<typeof accountsApi.update>[0] extends infer _I
			? { id: string; body: Parameters<typeof accountsApi.update>[1] }
			: never) => accountsApi.update(id, body),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["accounts"] }),
	});
}

export function useDeleteAccount() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => accountsApi.delete(id),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["accounts"] }),
	});
}
