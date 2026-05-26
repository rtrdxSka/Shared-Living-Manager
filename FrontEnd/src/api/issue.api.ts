import api from '@/utils/axios';
import type { ApiSuccessResponse } from '@/types/auth.types';
import type {
  IssueResponse,
  IssueListResponse,
  IssueDetailResponse,
  IssueModerationResponse,
  IssueComment,
  CreateIssueInput,
  EscalateIssueInput,
} from '@/types/issue.types';

export interface ListIssuesParams {
  status?: string;
  category?: string;
  cursor?: string;
  limit?: number;
}

export const issueApi = {
  async listIssues(
    householdId: string,
    params: ListIssuesParams = {}
  ): Promise<IssueListResponse> {
    const { data } = await api.get<ApiSuccessResponse<IssueListResponse>>(
      `/households/${householdId}/issues`,
      { params }
    );
    return data.data;
  },

  async createIssue(
    householdId: string,
    input: CreateIssueInput
  ): Promise<IssueResponse> {
    const { data } = await api.post<ApiSuccessResponse<{ issue: IssueResponse }>>(
      `/households/${householdId}/issues`,
      input
    );
    return data.data.issue;
  },

  async getIssue(
    householdId: string,
    issueId: string
  ): Promise<IssueDetailResponse> {
    const { data } = await api.get<
      ApiSuccessResponse<{ issue: IssueDetailResponse }>
    >(`/households/${householdId}/issues/${issueId}`);
    return data.data.issue;
  },

  async deleteIssue(householdId: string, issueId: string): Promise<void> {
    await api.delete(`/households/${householdId}/issues/${issueId}`);
  },

  async toggleUpvote(
    householdId: string,
    issueId: string
  ): Promise<{ hasUpvoted: boolean; upvoteCount: number }> {
    const { data } = await api.post<
      ApiSuccessResponse<{ hasUpvoted: boolean; upvoteCount: number }>
    >(`/households/${householdId}/issues/${issueId}/upvote`);
    return data.data;
  },

  async addComment(
    householdId: string,
    issueId: string,
    body: string
  ): Promise<IssueComment> {
    const { data } = await api.post<
      ApiSuccessResponse<{ comment: IssueComment }>
    >(`/households/${householdId}/issues/${issueId}/comments`, { body });
    return data.data.comment;
  },

  async deleteComment(
    householdId: string,
    issueId: string,
    commentId: string
  ): Promise<void> {
    await api.delete(
      `/households/${householdId}/issues/${issueId}/comments/${commentId}`
    );
  },

  async escalate(
    householdId: string,
    issueId: string,
    input: EscalateIssueInput
  ): Promise<{ _id: string }> {
    const { data } = await api.post<
      ApiSuccessResponse<{ vote: { _id: string } }>
    >(`/households/${householdId}/issues/${issueId}/escalate`, input);
    return data.data.vote;
  },

  async getModeration(
    householdId: string,
    issueId: string
  ): Promise<IssueModerationResponse> {
    const { data } = await api.get<
      ApiSuccessResponse<{ issue: IssueModerationResponse }>
    >(`/households/${householdId}/issues/${issueId}/moderation`);
    return data.data.issue;
  },
};
