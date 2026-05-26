import api from '@/utils/axios';
import type { ApiSuccessResponse } from '@/types/auth.types';
import type {
  VoteResponse,
  VoteListResponse,
  CreateVoteInput,
  BallotChoice,
} from '@/types/vote.types';

export interface ListVotesParams {
  status?: string;
}

export const voteApi = {
  async listVotes(
    householdId: string,
    params: ListVotesParams = {}
  ): Promise<VoteListResponse> {
    const { data } = await api.get<ApiSuccessResponse<VoteListResponse>>(
      `/households/${householdId}/votes`,
      { params }
    );
    return data.data;
  },

  async createVote(
    householdId: string,
    input: CreateVoteInput
  ): Promise<VoteResponse> {
    const { data } = await api.post<ApiSuccessResponse<{ vote: VoteResponse }>>(
      `/households/${householdId}/votes`,
      input
    );
    return data.data.vote;
  },

  async getVote(
    householdId: string,
    voteId: string
  ): Promise<VoteResponse> {
    const { data } = await api.get<ApiSuccessResponse<{ vote: VoteResponse }>>(
      `/households/${householdId}/votes/${voteId}`
    );
    return data.data.vote;
  },

  async castBallot(
    householdId: string,
    voteId: string,
    choice: BallotChoice
  ): Promise<VoteResponse> {
    const { data } = await api.post<ApiSuccessResponse<{ vote: VoteResponse }>>(
      `/households/${householdId}/votes/${voteId}/ballot`,
      { choice }
    );
    return data.data.vote;
  },

  async closeVote(
    householdId: string,
    voteId: string
  ): Promise<VoteResponse> {
    const { data } = await api.post<ApiSuccessResponse<{ vote: VoteResponse }>>(
      `/households/${householdId}/votes/${voteId}/close`
    );
    return data.data.vote;
  },
};
