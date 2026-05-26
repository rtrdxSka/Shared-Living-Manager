import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { issueApi, type ListIssuesParams } from '@/api/issue.api';
import type { CreateIssueInput, EscalateIssueInput } from '@/types/issue.types';

const issueKeys = {
  all: (householdId: string) => ['issues', householdId] as const,
  list: (householdId: string, params?: ListIssuesParams) =>
    ['issues', householdId, 'list', params] as const,
  detail: (householdId: string, issueId: string) =>
    ['issues', householdId, 'detail', issueId] as const,
  moderation: (householdId: string, issueId: string) =>
    ['issues', householdId, 'moderation', issueId] as const,
};

export function useIssues(householdId: string, params?: ListIssuesParams) {
  return useQuery({
    queryKey: issueKeys.list(householdId, params),
    queryFn: () => issueApi.listIssues(householdId, params),
    enabled: Boolean(householdId),
  });
}

export function useIssue(householdId: string, issueId: string | undefined) {
  return useQuery({
    queryKey: issueId
      ? issueKeys.detail(householdId, issueId)
      : (['issues', householdId, 'detail', 'no-id'] as const),
    queryFn: () => issueApi.getIssue(householdId, issueId as string),
    enabled: Boolean(householdId) && Boolean(issueId),
  });
}

export function useIssueModeration(
  householdId: string,
  issueId: string | undefined
) {
  return useQuery({
    queryKey: issueId
      ? issueKeys.moderation(householdId, issueId)
      : (['issues', householdId, 'moderation', 'no-id'] as const),
    queryFn: () => issueApi.getModeration(householdId, issueId as string),
    enabled: Boolean(householdId) && Boolean(issueId),
  });
}

export function useCreateIssue(householdId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateIssueInput) =>
      issueApi.createIssue(householdId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: issueKeys.all(householdId) });
    },
    onError: () => {
      void qc.invalidateQueries({ queryKey: issueKeys.all(householdId) });
    },
  });
}

export function useToggleUpvote(householdId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (issueId: string) =>
      issueApi.toggleUpvote(householdId, issueId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: issueKeys.all(householdId) });
    },
    onError: () => {
      void qc.invalidateQueries({ queryKey: issueKeys.all(householdId) });
    },
  });
}

export function useAddComment(householdId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ issueId, body }: { issueId: string; body: string }) =>
      issueApi.addComment(householdId, issueId, body),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({
        queryKey: issueKeys.detail(householdId, vars.issueId),
      });
    },
    onError: (_err, vars) => {
      void qc.invalidateQueries({
        queryKey: issueKeys.detail(householdId, vars.issueId),
      });
    },
  });
}

export function useDeleteComment(householdId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      issueId,
      commentId,
    }: {
      issueId: string;
      commentId: string;
    }) => issueApi.deleteComment(householdId, issueId, commentId),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({
        queryKey: issueKeys.detail(householdId, vars.issueId),
      });
    },
    onError: (_err, vars) => {
      void qc.invalidateQueries({
        queryKey: issueKeys.detail(householdId, vars.issueId),
      });
    },
  });
}

export function useDeleteIssue(householdId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (issueId: string) => issueApi.deleteIssue(householdId, issueId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: issueKeys.all(householdId) });
    },
    onError: () => {
      void qc.invalidateQueries({ queryKey: issueKeys.all(householdId) });
    },
  });
}

export function useEscalateIssue(householdId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      issueId,
      input,
    }: {
      issueId: string;
      input: EscalateIssueInput;
    }) => issueApi.escalate(householdId, issueId, input),
    // Escalation creates a Vote and flips the issue's status, so both caches
    // need a refresh.
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: issueKeys.all(householdId) });
      void qc.invalidateQueries({ queryKey: ['votes', householdId] });
    },
    onError: () => {
      void qc.invalidateQueries({ queryKey: issueKeys.all(householdId) });
    },
  });
}
