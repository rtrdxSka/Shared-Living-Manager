import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { householdApi } from '@/api/household.api';
import type { HouseholdResponse, UpdateHouseholdSettingsInput } from '@/types/household.types';

export function useHousehold(id?: string) {
  return useQuery({
    queryKey: queryKeys.household.detail(id!),
    queryFn: () => householdApi.getById(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

export function useUpdateSettings(householdId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateHouseholdSettingsInput) =>
      householdApi.updateSettings(householdId, input),
    onSuccess: (updated: HouseholdResponse) => {
      queryClient.setQueryData(queryKeys.household.detail(householdId), updated);
    },
  });
}

export function useUpdateIncome(householdId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (monthlyIncome: number) =>
      householdApi.updateMyIncome(householdId, monthlyIncome),
    onSuccess: (updated: HouseholdResponse) => {
      queryClient.setQueryData(queryKeys.household.detail(householdId), updated);
    },
  });
}

export function useRecordSettlement(householdId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ month, amount }: { month: string; amount: number }) =>
      householdApi.recordSettlement(householdId, month, amount),
    onSuccess: (updated: HouseholdResponse) => {
      queryClient.setQueryData(queryKeys.household.detail(householdId), updated);
    },
  });
}

export function useRegenerateInviteCode(householdId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => householdApi.regenerateInviteCode(householdId),
    onSuccess: (updated: HouseholdResponse) => {
      queryClient.setQueryData(queryKeys.household.detail(householdId), updated);
    },
  });
}
