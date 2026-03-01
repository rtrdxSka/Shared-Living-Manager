import api from '@/utils/axios';
import type { ApiSuccessResponse } from '@/types/auth.types';
import type { HouseholdResponse, CreateHouseholdInput, JoinHouseholdInput, UpdateHouseholdSettingsInput } from '@/types/household.types';

export const householdApi = {
  async create(input: CreateHouseholdInput): Promise<HouseholdResponse> {
    const { data } = await api.post<ApiSuccessResponse<{ household: HouseholdResponse }>>(
      '/households',
      input
    );
    return data.data.household;
  },

  async join(input: JoinHouseholdInput): Promise<HouseholdResponse> {
    const { data } = await api.post<ApiSuccessResponse<{ household: HouseholdResponse }>>(
      '/households/join',
      input
    );
    return data.data.household;
  },

  async getById(id: string): Promise<HouseholdResponse> {
    const { data } = await api.get<ApiSuccessResponse<{ household: HouseholdResponse }>>(
      `/households/${id}`
    );
    return data.data.household;
  },

  async updateMyIncome(householdId: string, monthlyIncome: number): Promise<HouseholdResponse> {
    const { data } = await api.patch<ApiSuccessResponse<{ household: HouseholdResponse }>>(
      `/households/${householdId}/members/me/income`,
      { monthlyIncome }
    );
    return data.data.household;
  },

  async updateSettings(householdId: string, input: UpdateHouseholdSettingsInput): Promise<HouseholdResponse> {
    const { data } = await api.patch<ApiSuccessResponse<{ household: HouseholdResponse }>>(
      `/households/${householdId}/settings`,
      input
    );
    return data.data.household;
  },

  async recordSettlement(householdId: string, month: string, amount: number): Promise<HouseholdResponse> {
    const { data } = await api.post<ApiSuccessResponse<{ household: HouseholdResponse }>>(
      `/households/${householdId}/settlements`,
      { month, amount }
    );
    return data.data.household;
  },
};
