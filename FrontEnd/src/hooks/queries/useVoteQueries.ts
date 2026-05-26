import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { voteApi, type ListVotesParams } from '@/api/vote.api';
import type { CreateVoteInput, BallotChoice } from '@/types/vote.types';

const voteKeys = {
  all: (householdId: string) => ['votes', householdId] as const,
  list: (householdId: string, params?: ListVotesParams) =>
    ['votes', householdId, 'list', params] as const,
  detail: (householdId: string, voteId: string) =>
    ['votes', householdId, 'detail', voteId] as const,
};

export function useVotes(householdId: string, params?: ListVotesParams) {
  return useQuery({
    queryKey: voteKeys.list(householdId, params),
    queryFn: () => voteApi.listVotes(householdId, params),
    enabled: Boolean(householdId),
  });
}

export function useVote(householdId: string, voteId: string | undefined) {
  return useQuery({
    queryKey: voteId
      ? voteKeys.detail(householdId, voteId)
      : (['votes', householdId, 'detail', 'no-id'] as const),
    queryFn: () => voteApi.getVote(householdId, voteId as string),
    enabled: Boolean(householdId) && Boolean(voteId),
  });
}

export function useCreateVote(householdId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateVoteInput) =>
      voteApi.createVote(householdId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: voteKeys.all(householdId) });
    },
    onError: () => {
      void qc.invalidateQueries({ queryKey: voteKeys.all(householdId) });
    },
  });
}

export function useCastBallot(householdId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      voteId,
      choice,
    }: {
      voteId: string;
      choice: BallotChoice;
    }) => voteApi.castBallot(householdId, voteId, choice),
    // Casting a ballot can trigger an inline-close that creates a HouseRule,
    // so both caches need a refresh.
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: voteKeys.all(householdId) });
      void qc.invalidateQueries({ queryKey: ['house-rules', householdId] });
    },
    onError: () => {
      void qc.invalidateQueries({ queryKey: voteKeys.all(householdId) });
    },
  });
}

export function useCloseVote(householdId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (voteId: string) => voteApi.closeVote(householdId, voteId),
    // Closing can create a HouseRule when the proposal passes; also invalidate
    // issues because the originating issue moves to "resolved".
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: voteKeys.all(householdId) });
      void qc.invalidateQueries({ queryKey: ['house-rules', householdId] });
      void qc.invalidateQueries({ queryKey: ['issues', householdId] });
    },
    onError: () => {
      void qc.invalidateQueries({ queryKey: voteKeys.all(householdId) });
    },
  });
}
