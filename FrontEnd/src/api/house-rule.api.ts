import api from '@/utils/axios';
import type { ApiSuccessResponse } from '@/types/auth.types';
import type {
  HouseRuleResponse,
  HouseRuleListResponse,
} from '@/types/house-rule.types';

export interface ListHouseRulesParams {
  includeArchived?: boolean;
}

export const houseRuleApi = {
  async listRules(
    householdId: string,
    params: ListHouseRulesParams = {}
  ): Promise<HouseRuleListResponse> {
    const { data } = await api.get<ApiSuccessResponse<HouseRuleListResponse>>(
      `/households/${householdId}/house-rules`,
      { params }
    );
    return data.data;
  },

  async archiveRule(
    householdId: string,
    ruleId: string
  ): Promise<HouseRuleResponse> {
    const { data } = await api.post<
      ApiSuccessResponse<{ rule: HouseRuleResponse }>
    >(`/households/${householdId}/house-rules/${ruleId}/archive`);
    return data.data.rule;
  },

  async restoreRule(
    householdId: string,
    ruleId: string
  ): Promise<HouseRuleResponse> {
    const { data } = await api.post<
      ApiSuccessResponse<{ rule: HouseRuleResponse }>
    >(`/households/${householdId}/house-rules/${ruleId}/restore`);
    return data.data.rule;
  },
};
