import { describe, it, expect } from 'vitest';
import { requiredYes, decideVote } from '../../../src/utils/decideVote';
import type { VoteThreshold } from '../../../src/types/vote.types';

const decide = (
  threshold: VoteThreshold,
  eligibleVoters: number,
  counts: { yes: number; no?: number; abstain?: number },
  final = false
) =>
  decideVote({
    yes: counts.yes,
    no: counts.no ?? 0,
    abstain: counts.abstain ?? 0,
    eligibleVoters,
    threshold,
    final,
  });

describe('requiredYes', () => {
  it('simple_majority = strictly more than half (floor(N/2)+1)', () => {
    expect(requiredYes('simple_majority', 2)).toBe(2);
    expect(requiredYes('simple_majority', 3)).toBe(2);
    expect(requiredYes('simple_majority', 4)).toBe(3);
    expect(requiredYes('simple_majority', 5)).toBe(3);
    expect(requiredYes('simple_majority', 6)).toBe(4);
  });

  it('supermajority = at least two thirds (ceil(2N/3))', () => {
    expect(requiredYes('supermajority', 2)).toBe(2);
    expect(requiredYes('supermajority', 3)).toBe(2);
    expect(requiredYes('supermajority', 4)).toBe(3);
    expect(requiredYes('supermajority', 5)).toBe(4);
    expect(requiredYes('supermajority', 6)).toBe(4);
  });

  it('unanimous = every member', () => {
    expect(requiredYes('unanimous', 2)).toBe(2);
    expect(requiredYes('unanimous', 3)).toBe(3);
    expect(requiredYes('unanimous', 5)).toBe(5);
  });
});

describe('decideVote — simple_majority', () => {
  it('passes the instant YES reaches the bar (2 of 3)', () => {
    expect(decide('simple_majority', 3, { yes: 2 })).toBe('pass');
  });

  it('stays undecided at 1 yes of 3 (a 2nd yes is still possible)', () => {
    expect(decide('simple_majority', 3, { yes: 1 })).toBe('undecided');
  });

  it('does not pass on a lone yes when the rest abstain/no (fixes ratio-of-cast)', () => {
    // 1 yes, 1 no, 1 abstain → all voted, yes(1) < required(2) → reject.
    expect(decide('simple_majority', 3, { yes: 1, no: 1, abstain: 1 })).toBe('reject');
  });

  it('rejects early once YES can no longer reach the bar', () => {
    // 2 no of 3, 1 left: maxPossibleYes = 0 + 1 = 1 < 2 → reject.
    expect(decide('simple_majority', 3, { yes: 0, no: 2 })).toBe('reject');
  });

  it('abstain counts as not-yes', () => {
    // N=5, required 3. 2 yes, 2 abstain, 1 left → max 3 → still undecided.
    expect(decide('simple_majority', 5, { yes: 2, abstain: 2 })).toBe('undecided');
    // 2 yes, 3 abstain (all voted) → max 2 < 3 → reject.
    expect(decide('simple_majority', 5, { yes: 2, abstain: 3 })).toBe('reject');
  });

  it('final tally rejects when YES short of the bar', () => {
    expect(decide('simple_majority', 5, { yes: 2, no: 1 }, true)).toBe('reject');
    expect(decide('simple_majority', 5, { yes: 3, no: 1 }, true)).toBe('pass');
  });
});

describe('decideVote — supermajority', () => {
  it('passes at exactly two thirds (2 of 3)', () => {
    expect(decide('supermajority', 3, { yes: 2 })).toBe('pass');
  });

  it('needs 4 of 5', () => {
    expect(decide('supermajority', 5, { yes: 3 })).toBe('undecided');
    expect(decide('supermajority', 5, { yes: 4 })).toBe('pass');
  });

  it('rejects early when the bar is unreachable', () => {
    // N=5 needs 4; 2 no cast, 3 left → max 3 < 4 → reject.
    expect(decide('supermajority', 5, { yes: 0, no: 2 })).toBe('reject');
  });
});

describe('decideVote — unanimous', () => {
  it('passes only when every member votes yes (fixes never-passes bug)', () => {
    expect(decide('unanimous', 3, { yes: 2 })).toBe('undecided');
    expect(decide('unanimous', 3, { yes: 3 })).toBe('pass');
    expect(decide('unanimous', 5, { yes: 5 })).toBe('pass');
  });

  it('rejects as soon as any non-yes ballot is cast', () => {
    // One no → max possible yes = N-1 < N → reject.
    expect(decide('unanimous', 3, { yes: 1, no: 1 })).toBe('reject');
    // One abstain likewise makes unanimity impossible.
    expect(decide('unanimous', 3, { yes: 2, abstain: 1 })).toBe('reject');
  });
});
