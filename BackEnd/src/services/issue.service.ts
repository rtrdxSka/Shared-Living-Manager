import { Types } from 'mongoose';
import { Issue } from '../models/issue.model';
import { IssueComment } from '../models/issue-comment.model';
import { Vote } from '../models/vote.model';
import { Household } from '../models/household.model';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/error';
import type { IHousehold } from '../types/household.types';
import type {
  ICreateIssueInput,
  IEscalateIssueInput,
  IIssueResponse,
  IIssueDetailResponse,
  IIssueModerationResponse,
  IIssueCommentResponse,
  IIssueListResponse,
} from '../types/issue.types';

interface IListIssuesInput {
  status?: string;
  category?: string;
  cursor?: string;
  limit?: number;
}

class IssueService {
  // ── Public API ────────────────────────────────────────────────────────

  async createIssue(
    householdId: string,
    userId: string,
    input: ICreateIssueInput
  ): Promise<IIssueResponse> {
    await this.assertMember(householdId, userId);
    const issue = await Issue.create({
      householdId: new Types.ObjectId(householdId),
      authorId: new Types.ObjectId(userId),
      title: input.title.trim(),
      body: input.body.trim(),
      category: input.category,
    });
    return this.formatIssue(issue.toObject(), userId, 0);
  }

  async listIssues(
    householdId: string,
    userId: string,
    opts: IListIssuesInput
  ): Promise<IIssueListResponse> {
    await this.assertMember(householdId, userId);
    const limit = Math.min(opts.limit ?? 20, 50);
    const query: Record<string, unknown> = {
      householdId: new Types.ObjectId(householdId),
    };
    if (opts.status) query.status = opts.status;
    if (opts.category) query.category = opts.category;
    if (opts.cursor) {
      try {
        const decoded = Buffer.from(opts.cursor, 'base64').toString('ascii');
        const [ts, id] = decoded.split('|');
        if (ts && id && /^[a-fA-F0-9]{24}$/.test(id)) {
          const tsDate = new Date(ts);
          if (!Number.isNaN(tsDate.getTime())) {
            query.$or = [
              { createdAt: { $lt: tsDate } },
              { createdAt: tsDate, _id: { $lt: new Types.ObjectId(id) } },
            ];
          }
        }
      } catch {
        // bad cursor, ignore
      }
    }

    const docs = await Issue.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = docs.length > limit;
    const slice = docs.slice(0, limit);

    const commentCounts = await IssueComment.aggregate([
      { $match: { issueId: { $in: slice.map((d) => d._id) } } },
      { $group: { _id: '$issueId', count: { $sum: 1 } } },
    ]);
    const ccMap = new Map<string, number>(
      commentCounts.map((c: { _id: Types.ObjectId; count: number }) => [
        c._id.toString(),
        c.count,
      ])
    );

    const items = slice.map((d) =>
      this.formatIssue(d, userId, ccMap.get(d._id.toString()) ?? 0)
    );

    let nextCursor: string | null = null;
    if (hasMore && slice.length > 0) {
      const last = slice[slice.length - 1];
      nextCursor = Buffer.from(
        `${last.createdAt.toISOString()}|${last._id.toString()}`
      ).toString('base64');
    }

    return { items, nextCursor };
  }

  async getIssue(
    householdId: string,
    userId: string,
    issueId: string
  ): Promise<IIssueDetailResponse> {
    await this.assertMember(householdId, userId);
    const issue = await Issue.findOne({
      _id: issueId,
      householdId: new Types.ObjectId(householdId),
    }).lean();
    if (!issue) throw NotFoundError('Issue not found');

    const comments = await IssueComment.find({ issueId: issue._id })
      .sort({ createdAt: 1 })
      .lean();

    return {
      ...this.formatIssue(issue, userId, comments.length),
      comments: comments.map((c) => this.formatComment(c, userId)),
    };
  }

  async toggleUpvote(
    householdId: string,
    userId: string,
    issueId: string
  ): Promise<{ hasUpvoted: boolean; upvoteCount: number }> {
    await this.assertMember(householdId, userId);
    const issue = await Issue.findOne({
      _id: issueId,
      householdId: new Types.ObjectId(householdId),
    });
    if (!issue) throw NotFoundError('Issue not found');

    const uid = new Types.ObjectId(userId);
    const has = issue.upvotedBy.some((u) => u.toString() === userId);
    if (has) {
      await Issue.updateOne(
        { _id: issue._id },
        { $pull: { upvotedBy: uid } }
      );
    } else {
      await Issue.updateOne(
        { _id: issue._id },
        { $addToSet: { upvotedBy: uid } }
      );
    }
    const refreshed = await Issue.findById(issue._id).lean();
    return {
      hasUpvoted: !has,
      upvoteCount: refreshed?.upvotedBy.length ?? 0,
    };
  }

  async deleteIssue(
    householdId: string,
    userId: string,
    issueId: string
  ): Promise<void> {
    const { household } = await this.assertMember(householdId, userId);
    const issue = await Issue.findOne({
      _id: issueId,
      householdId: new Types.ObjectId(householdId),
    });
    if (!issue) throw NotFoundError('Issue not found');

    const isAuthor = issue.authorId.toString() === userId;
    const role = household.members.find(
      (m) => m.userId?.toString() === userId
    )?.role;
    const isAdmin = role === 'owner' || role === 'admin';
    if (!isAuthor && !isAdmin) throw ForbiddenError('Not allowed');

    await IssueComment.deleteMany({ issueId: issue._id });
    await Issue.deleteOne({ _id: issue._id });
  }

  async addComment(
    householdId: string,
    userId: string,
    issueId: string,
    body: string
  ): Promise<IIssueCommentResponse> {
    await this.assertMember(householdId, userId);
    const issue = await Issue.findOne({
      _id: issueId,
      householdId: new Types.ObjectId(householdId),
    });
    if (!issue) throw NotFoundError('Issue not found');

    const c = await IssueComment.create({
      issueId: issue._id,
      authorId: new Types.ObjectId(userId),
      body: body.trim(),
    });
    return this.formatComment(c.toObject(), userId);
  }

  async deleteComment(
    householdId: string,
    userId: string,
    commentId: string
  ): Promise<void> {
    const { household } = await this.assertMember(householdId, userId);
    const c = await IssueComment.findById(commentId);
    if (!c) throw NotFoundError('Comment not found');

    // Cross-household guard: ensure the parent issue belongs to this household.
    const issue = await Issue.findOne({
      _id: c.issueId,
      householdId: new Types.ObjectId(householdId),
    });
    if (!issue) throw NotFoundError('Comment not found');

    const isAuthor = c.authorId.toString() === userId;
    const role = household.members.find(
      (m) => m.userId?.toString() === userId
    )?.role;
    const isAdmin = role === 'owner' || role === 'admin';
    if (!isAuthor && !isAdmin) throw ForbiddenError('Not allowed');

    await IssueComment.deleteOne({ _id: c._id });
  }

  async escalateToVote(
    householdId: string,
    userId: string,
    issueId: string,
    input: IEscalateIssueInput
  ) {
    await this.assertMember(householdId, userId);

    const deadlineDays = input.deadlineDays ?? 7;
    if (
      !Number.isInteger(deadlineDays) ||
      deadlineDays < 1 ||
      deadlineDays > 30
    ) {
      throw BadRequestError('deadlineDays must be an integer between 1 and 30');
    }

    const issue = await Issue.findOne({
      _id: issueId,
      householdId: new Types.ObjectId(householdId),
      status: 'open',
    });
    if (!issue) {
      throw BadRequestError('Issue is not open or has already been escalated');
    }

    const deadline = new Date(Date.now() + deadlineDays * 86_400_000);
    const vote = await Vote.create({
      householdId: issue.householdId,
      sourceIssueId: issue._id,
      proposedRuleTitle: input.proposedRuleTitle.trim(),
      proposedRuleText: input.proposedRuleText.trim(),
      proposedBy: new Types.ObjectId(userId),
      threshold: input.threshold ?? 'simple_majority',
      deadline,
    });

    issue.status = 'escalated';
    issue.escalatedToVoteId = vote._id;
    await issue.save();

    return vote;
  }

  async getIssueForModeration(
    householdId: string,
    userId: string,
    issueId: string
  ): Promise<IIssueModerationResponse> {
    const { household } = await this.assertMember(householdId, userId);
    const role = household.members.find(
      (m) => m.userId?.toString() === userId
    )?.role;
    if (role !== 'owner' && role !== 'admin') {
      throw ForbiddenError('Admin or owner required');
    }

    const issue = await Issue.findOne({
      _id: issueId,
      householdId: new Types.ObjectId(householdId),
    }).lean();
    if (!issue) throw NotFoundError('Issue not found');

    const author = household.members.find(
      (m) => m.userId?.toString() === issue.authorId.toString()
    );

    const commentCount = await IssueComment.countDocuments({
      issueId: issue._id,
    });

    return {
      ...this.formatIssue(issue, userId, commentCount),
      authorId: issue.authorId.toString(),
      authorNickname: author?.nickname ?? 'Unknown',
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private formatIssue(
    issue: {
      _id: Types.ObjectId;
      householdId: Types.ObjectId;
      authorId: Types.ObjectId;
      title: string;
      body: string;
      category: IIssueResponse['category'];
      status: IIssueResponse['status'];
      escalatedToVoteId?: Types.ObjectId;
      upvotedBy: Types.ObjectId[];
      createdAt: Date;
      updatedAt: Date;
    },
    requestingUserId: string,
    commentCount: number
  ): IIssueResponse {
    return {
      _id: issue._id.toString(),
      householdId: issue.householdId.toString(),
      title: issue.title,
      body: issue.body,
      category: issue.category,
      status: issue.status,
      ...(issue.escalatedToVoteId && {
        escalatedToVoteId: issue.escalatedToVoteId.toString(),
      }),
      upvoteCount: issue.upvotedBy.length,
      hasUpvoted: issue.upvotedBy.some(
        (u) => u.toString() === requestingUserId
      ),
      isMine: issue.authorId.toString() === requestingUserId,
      commentCount,
      createdAt: issue.createdAt.toISOString(),
      updatedAt: issue.updatedAt.toISOString(),
    };
  }

  private formatComment(
    c: {
      _id: Types.ObjectId;
      issueId: Types.ObjectId;
      authorId: Types.ObjectId;
      body: string;
      createdAt: Date;
    },
    requestingUserId: string
  ): IIssueCommentResponse {
    return {
      _id: c._id.toString(),
      issueId: c.issueId.toString(),
      body: c.body,
      isMine: c.authorId.toString() === requestingUserId,
      createdAt: c.createdAt.toISOString(),
    };
  }
}

export const issueService = new IssueService();
