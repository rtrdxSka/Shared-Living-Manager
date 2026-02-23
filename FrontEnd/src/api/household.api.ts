import api from '@/utils/axios';
import type { ApiSuccessResponse } from '@/types/auth.types';
import type { HouseholdResponse, CreateHouseholdInput } from '@/types/household.types';

export const householdApi = {
  async create(input: CreateHouseholdInput): Promise<HouseholdResponse> {
    const { data } = await api.post<ApiSuccessResponse<{ household: HouseholdResponse }>>(
      '/households',
      input
    );
    return data.data.household;
  },
};
