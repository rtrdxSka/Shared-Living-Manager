import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { houseRuleApi, type ListHouseRulesParams } from '@/api/house-rule.api';

const houseRuleKeys = {
  all: (householdId: string) => ['house-rules', householdId] as const,
  list: (householdId: string, params?: ListHouseRulesParams) =>
    ['house-rules', householdId, 'list', params] as const,
};

export function useHouseRules(
  householdId: string,
  params?: ListHouseRulesParams
) {
  return useQuery({
    queryKey: houseRuleKeys.list(householdId, params),
    queryFn: () => houseRuleApi.listRules(householdId, params),
    enabled: Boolean(householdId),
  });
}

export function useArchiveRule(householdId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ruleId: string) =>
      houseRuleApi.archiveRule(householdId, ruleId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: houseRuleKeys.all(householdId) });
    },
    onError: () => {
      void qc.invalidateQueries({ queryKey: houseRuleKeys.all(householdId) });
    },
  });
}

export function useRestoreRule(householdId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ruleId: string) =>
      houseRuleApi.restoreRule(householdId, ruleId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: houseRuleKeys.all(householdId) });
    },
    onError: () => {
      void qc.invalidateQueries({ queryKey: houseRuleKeys.all(householdId) });
    },
  });
}
