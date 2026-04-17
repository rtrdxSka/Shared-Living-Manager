import api from '@/utils/axios';
import type { ApiSuccessResponse } from '@/types/auth.types';
import type { HouseholdResponse } from '@/types/household.types';
import type {
  JointAccountSummaryResponse,
  JointAccountTransactionResponse,
  AddTransactionInput,
  UpdateJointAccountConfigInput,
} from '@/types/joint-account.types';

export const jointAccountApi = {
  async getSummary(
    householdId: string,
    month?: string
  ): Promise<JointAccountSummaryResponse> {
    const params = month ? { month } : undefined;
    const { data } = await api.get<
      ApiSuccessResponse<{ summary: JointAccountSummaryResponse }>
    >(`/households/${householdId}/joint-account`, { params });
    return data.data.summary;
  },

  async addTransaction(
    householdId: string,
    input: AddTransactionInput
  ): Promise<JointAccountTransactionResponse> {
    const { data } = await api.post<
      ApiSuccessResponse<{ transaction: JointAccountTransactionResponse }>
    >(`/households/${householdId}/joint-account/transactions`, input);
    return data.data.transaction;
  },

  async deleteTransaction(
    householdId: string,
    txId: string
  ): Promise<void> {
    await api.delete(
      `/households/${householdId}/joint-account/transactions/${txId}`
    );
  },

  async updateConfig(
    householdId: string,
    input: UpdateJointAccountConfigInput
  ): Promise<HouseholdResponse> {
    const { data } = await api.patch<
      ApiSuccessResponse<{ household: HouseholdResponse }>
    >(`/households/${householdId}/joint-account/config`, input);
    return data.data.household;
  },
};
