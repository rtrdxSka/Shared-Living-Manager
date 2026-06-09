import { Types } from 'mongoose';
import { Vote } from '../models/vote.model';
import { VoteBallot } from '../models/vote-ballot.model';
import { HouseRule } from '../models/house-rule.model';
import { Household } from '../models/household.model';
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} from '../utils/error';
import { decideVote, requiredYes } from '../utils/decideVote';
import type { IHousehold } from '../types/household.types';
import type {
  ICreateVoteInput,
  IVoteResponse,
  IVoteTally,
  IVoteListResponse,
  BallotChoice,
  IVote,
  VoteThreshold,
} from '../types/vote.types';

interface IListVotesInput {
  status?: string;
}

class VoteService {
  // ── Public API ────────────────────────────────────────────────────────

  async createVote(
    householdId: string,
    userId: string,
    input: ICreateVoteInput
  ): Promise<IVote> {
    await this.assertMember(householdId, userId);

    const deadlineDays = input.deadlineDays ?? 7;
    if (
      !Number.isInteger(deadlineDays) ||
      deadlineDays < 1 ||
      deadlineDays > 30
    ) {
      throw BadRequestError('deadlineDays must be an integer between 1 and 30');
    }
    const deadline = new Date(Date.now() + deadlineDays * 86_400_000);

    return Vote.create({
      householdId: new Types.ObjectId(householdId),
      ...(input.sourceIssueId && {
        sourceIssueId: new Types.ObjectId(input.sourceIssueId),
      }),
      proposedRuleTitle: input.proposedRuleTitle.trim(),
      proposedRuleText: input.proposedRuleText.trim(),
      proposedBy: new Types.ObjectId(userId),
      threshold: input.threshold ?? 'simple_majority',
      deadline,
    });
  }

  async listVotes(
    householdId: string,
    userId: string,
    opts: IListVotesInput
  ): Promise<IVoteListResponse> {
    const { household } = await this.assertMember(householdId, userId);
    const query: Record<string, unknown> = {
      householdId: new Types.ObjectId(householdId),
    };
    if (opts.status) query.status = opts.status;
    const votes = await Vote.find(query)
      .sort({ deadline: 1, createdAt: -1 })
      .lean();
    const items = await Promise.all(
      votes.map((v) => this.formatVote(v, userId, household))
    );
    return { items };
  }

  async getVote(
    householdId: string,
    userId: string,
    voteId: string
  ): Promise<IVoteResponse> {
    const { household } = await this.assertMember(householdId, userId);
    const vote = await Vote.findOne({
      _id: voteId,
      householdId: new Types.ObjectId(householdId),
    }).lean();
    if (!vote) throw NotFoundError('Vote not found');
    return this.formatVote(vote, userId, household);
  }

  async castBallot(
    householdId: string,
    userId: string,
    voteId: string,
    choice: BallotChoice
  ): Promise<IVoteResponse> {
    const { household } = await this.assertMember(householdId, userId);
    const vote = await Vote.findOne({
      _id: voteId,
      householdId: new Types.ObjectId(householdId),
    });
    if (!vote) throw NotFoundError('Vote not found');
    if (vote.status !== 'open') throw BadRequestError('Vote is not open');
    const eligibleVoters = this.countEligibleVoters(household);
    if (vote.deadline.getTime() <= Date.now()) {
      // Close inline as expired (rejected/passed per tally; not closed_early).
      await this.tallyAndMaybeClose(vote, eligibleVoters, {
        final: true,
        allowEarly: false,
      });
      throw BadRequestError('Vote deadline has passed');
    }

    await VoteBallot.findOneAndUpdate(
      { voteId: vote._id, userId: new Types.ObjectId(userId) },
      {
        voteId: vote._id,
        userId: new Types.ObjectId(userId),
        choice,
        castAt: new Date(),
      },
      { upsert: true, new: true }
    );

    // Auto-close the moment the outcome is locked — pass once enough YES votes
    // exist, reject once YES can no longer reach the bar. Otherwise stays open.
    await this.tallyAndMaybeClose(vote, eligibleVoters, {
      final: false,
      allowEarly: false,
    });

    const refreshed = await Vote.findById(vote._id).lean();
    if (!refreshed) throw NotFoundError('Vote not found');
    return this.formatVote(refreshed, userId, household);
  }

  async closeVoteEarly(
    householdId: string,
    userId: string,
    voteId: string
  ): Promise<IVote> {
    const { household } = await this.assertMember(householdId, userId);
    const role = household.members.find(
      (m) => m.userId?.toString() === userId
    )?.role;
    if (role !== 'owner' && role !== 'admin') {
      throw ForbiddenError('Admin or owner required');
    }
    const vote = await Vote.findOne({
      _id: voteId,
      householdId: new Types.ObjectId(householdId),
      status: 'open',
    });
    if (!vote) throw BadRequestError('Vote is not open');
    return this.tallyAndMaybeClose(vote, this.countEligibleVoters(household), {
      final: true,
      allowEarly: true,
    });
  }

  async autoCloseExpiredVotes(): Promise<void> {
    const expired = await Vote.find({
      status: 'open',
      deadline: { $lte: new Date() },
    });
    // Cache households so multiple expired votes in the same household don't
    // re-query. The eligible-voter count comes from current membership.
    const householdCache = new Map<string, IHousehold | null>();
    for (const v of expired) {
      const key = v.householdId.toString();
      let household = householdCache.get(key);
      if (household === undefined) {
        const fetched = await Household.findById(v.householdId);
        householdCache.set(key, fetched);
        household = fetched;
      }
      if (!household) continue;
      await this.tallyAndMaybeClose(v, this.countEligibleVoters(household), {
        final: true,
        allowEarly: false,
      });
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private countEligibleVoters(household: IHousehold): number {
    return household.members.filter((m) => m.userId).length;
  }

  /**
   * Tally the current ballots and close the vote if the outcome is determined.
   *
   *   - `final: true`  → deadline reached or admin close; the vote always
   *     resolves (pass, or reject/closed_early).
   *   - `final: false` → a ballot was just cast; close only if the result is
   *     already locked, otherwise leave the vote open.
   *
   * A rejection resolves to `closed_early` when `allowEarly` (manual admin
   * close), otherwise `rejected`. Passing always creates the HouseRule.
   */
  private async tallyAndMaybeClose(
    vote: IVote,
    eligibleVoters: number,
    options: { final: boolean; allowEarly: boolean }
  ): Promise<IVote> {
    const ballots = await VoteBallot.find({ voteId: vote._id });
    let yes = 0;
    let no = 0;
    let abstain = 0;
    for (const b of ballots) {
      if (b.choice === 'yes') yes++;
      else if (b.choice === 'no') no++;
      else abstain++;
    }

    const outcome = decideVote({
      yes,
      no,
      abstain,
      eligibleVoters,
      threshold: vote.threshold,
      final: options.final,
    });

    if (outcome === 'undecided') return vote;

    vote.closedAt = new Date();
    if (outcome === 'pass') {
      vote.status = 'passed';
      await vote.save();
      await HouseRule.create({
        householdId: vote.householdId,
        sourceVoteId: vote._id,
        title: vote.proposedRuleTitle,
        text: vote.proposedRuleText,
        passedAt: vote.closedAt,
      });
    } else {
      vote.status = options.allowEarly ? 'closed_early' : 'rejected';
      await vote.save();
    }
    return vote;
  }

  private async assertMember(
    householdId: string,
    userId: string
  ): Promise<{ household: IHousehold }> {
    const household = await Household.findById(householdId);
    if (!household) throw NotFoundError('Household not found');
    const isMember = household.members.some(
      (m) => m.userId?.toString() === userId
    );
    if (!isMember) throw ForbiddenError('Not a household member');
    return { household };
  }

  private async formatVote(
    vote: {
      _id: Types.ObjectId;
      householdId: Types.ObjectId;
      sourceIssueId?: Types.ObjectId;
      proposedRuleTitle: string;
      proposedRuleText: string;
      threshold: VoteThreshold;
      deadline: Date;
      status: IVote['status'];
      closedAt?: Date;
      createdAt: Date;
      updatedAt: Date;
    },
    requestingUserId: string,
    household: IHousehold
  ): Promise<IVoteResponse> {
    const ballots = await VoteBallot.find({ voteId: vote._id }).lean();
    let yes = 0;
    let no = 0;
    let abstain = 0;
    let myBallot: BallotChoice | undefined;
    for (const b of ballots) {
      if (b.choice === 'yes') yes++;
      else if (b.choice === 'no') no++;
      else abstain++;
      if (b.userId.toString() === requestingUserId) myBallot = b.choice;
    }
    const eligibleVoters = this.countEligibleVoters(household);
    const tally: IVoteTally = {
      yes,
      no,
      abstain,
      total: yes + no + abstain,
      eligibleVoters,
      requiredYes: requiredYes(vote.threshold, eligibleVoters),
    };
    return {
      _id: vote._id.toString(),
      householdId: vote.householdId.toString(),
      ...(vote.sourceIssueId && {
        sourceIssueId: vote.sourceIssueId.toString(),
      }),
      proposedRuleTitle: vote.proposedRuleTitle,
      proposedRuleText: vote.proposedRuleText,
      threshold: vote.threshold,
      deadline: vote.deadline.toISOString(),
      status: vote.status,
      ...(vote.closedAt && { closedAt: vote.closedAt.toISOString() }),
      tally,
      ...(myBallot && { myBallot }),
      createdAt: vote.createdAt.toISOString(),
      updatedAt: vote.updatedAt.toISOString(),
    };
  }
}

export const voteService = new VoteService();
