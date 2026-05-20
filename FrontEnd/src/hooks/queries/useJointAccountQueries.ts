import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { jointAccountApi } from '@/api/joint-account.api';
import type {
  AddTransactionInput,
  UpdateJointAccountConfigInput,
} from '@/types/joint-account.types';

export function useJointAccountSummary(
  householdId: string,
  month: string,
  enabled = true
) {
  return useQuery({
    queryKey: queryKeys.jointAccount.summary(householdId, month),
    queryFn: () => jointAccountApi.getSummary(householdId, month),
    enabled,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useAddJointTransaction(householdId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AddTransactionInput) =>
      jointAccountApi.addTransaction(householdId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.jointAccount.all(householdId),
      });
    },
  });
}

export function useDeleteJointTransaction(householdId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (txId: string) =>
      jointAccountApi.deleteTransaction(householdId, txId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.jointAccount.all(householdId),
      });
    },
  });
}

export function useUpdateJointAccountConfig(householdId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateJointAccountConfigInput) =>
      jointAccountApi.updateConfig(householdId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.jointAccount.all(householdId),
      });
      // Target only THIS household, not every cached household entry.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.household.detail(householdId),
      });
    },
  });
}
