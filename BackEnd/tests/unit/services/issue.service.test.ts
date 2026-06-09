import { describe, it, expect, beforeEach } from 'vitest';
import { issueService } from '../../../src/services/issue.service';
import { Issue } from '../../../src/models/issue.model';
import { IssueComment } from '../../../src/models/issue-comment.model';
import { Household } from '../../../src/models/household.model';
import { User } from '../../../src/models/user.model';

// Counter used to generate unique emails / invite codes per beforeEach run
// to avoid collisions with seed data and across test runs in this file.
let counter = 0;

describe('issueService', () => {
  let hid: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let alice: any, bob: any, carol: any;

  beforeEach(async () => {
    counter += 1;
    const suffix = `${Date.now()}-${counter}`;
    alice = await new User({
      email: `issue-alice-${suffix}@example.com`,
      password: 'Password123!',
      firstName: 'Alice',
      lastName: 'Test',
      isEmailVerified: true,
    }).save();
    bob = await new User({
      email: `issue-bob-${suffix}@example.com`,
      password: 'Password123!',
      firstName: 'Bob',
      lastName: 'Test',
      isEmailVerified: true,
    }).save();
    carol = await new User({
      email: `issue-carol-${suffix}@example.com`,
      password: 'Password123!',
      firstName: 'Carol',
      lastName: 'Test',
      isEmailVerified: true,
    }).save();

    const h = await new Household({
      name: 'Issue Test House',
      livingArrangement: 'roommates',
      totalMembers: 3,
      uiMode: 'roommates',
      createdBy: alice._id,
      inviteCode: `issue-invite-${suffix}`,
      members: [
        {
          userId: alice._id,
          nickname: 'Alice',
          ageGroup: 'adult',
          role: 'owner',
          participatesInFinances: true,
          participatesInTasks: true,
          isCreator: true,
        },
        {
          userId: bob._id,
          nickname: 'Bob',
          ageGroup: 'adult',
          role: 'member',
          participatesInFinances: true,
          participatesInTasks: true,
          isCreator: false,
        },
        {
          userId: carol._id,
          nickname: 'Carol',
          ageGroup: 'adult',
          role: 'member',
          participatesInFinances: true,
          participatesInTasks: true,
          isCreator: false,
        },
      ],
      settings: {
        financeMode: 'split',
        expenseSplitMethod: 'equal',
        currency: 'BGN',
        taskManagementEnabled: 'disabled',
        trackedExpenseTypes: [],
      },
    }).save();
    hid = h._id.toString();
  });

  describe('listIssues', () => {
    it('strips authorId from response items', async () => {
      await issueService.createIssue(hid, alice._id.toString(), {
        title: 'X',
        body: 'y',
        category: 'cleaning',
      });
      const res = await issueService.listIssues(hid, bob._id.toString(), {});
      expect(res.items[0]).not.toHaveProperty('authorId');
      expect(res.items[0]).toHaveProperty('upvoteCount');
      expect(res.items[0].isMine).toBe(false);
    });

    it('sets isMine=true on caller-authored issues', async () => {
      await issueService.createIssue(hid, alice._id.toString(), {
        title: 'X',
        body: 'y',
        category: 'cleaning',
      });
      const res = await issueService.listIssues(hid, alice._id.toString(), {});
      expect(res.items[0].isMine).toBe(true);
    });
  });

  describe('toggleUpvote', () => {
    it('idempotently adds then removes the upvote', async () => {
      const i = await issueService.createIssue(hid, alice._id.toString(), {
        title: 'X',
        body: 'y',
        category: 'cleaning',
      });
      const r1 = await issueService.toggleUpvote(hid, bob._id.toString(), i._id);
      expect(r1.hasUpvoted).toBe(true);
      expect(r1.upvoteCount).toBe(1);
      const r2 = await issueService.toggleUpvote(hid, bob._id.toString(), i._id);
      expect(r2.hasUpvoted).toBe(false);
      expect(r2.upvoteCount).toBe(0);
    });
  });

  describe('deleteIssue', () => {
    it('allows author to delete', async () => {
      const i = await issueService.createIssue(hid, alice._id.toString(), {
        title: 'X',
        body: 'y',
        category: 'cleaning',
      });
      await expect(
        issueService.deleteIssue(hid, alice._id.toString(), i._id)
      ).resolves.toBeUndefined();
    });

    it('allows owner/admin to delete others', async () => {
      const i = await issueService.createIssue(hid, bob._id.toString(), {
        title: 'X',
        body: 'y',
        category: 'cleaning',
      });
      await expect(
        issueService.deleteIssue(hid, alice._id.toString(), i._id)
      ).resolves.toBeUndefined();
    });

    it('rejects non-author non-admin', async () => {
      const i = await issueService.createIssue(hid, bob._id.toString(), {
        title: 'X',
        body: 'y',
        category: 'cleaning',
      });
      await expect(
        issueService.deleteIssue(hid, carol._id.toString(), i._id)
      ).rejects.toThrow(/forbidden|not allowed/i);
    });

    it('cascades comments', async () => {
      const i = await issueService.createIssue(hid, alice._id.toString(), {
        title: 'X',
        body: 'y',
        category: 'cleaning',
      });
      await issueService.addComment(hid, bob._id.toString(), i._id, 'reply');
      await issueService.deleteIssue(hid, alice._id.toString(), i._id);
      const remaining = await IssueComment.countDocuments({ issueId: i._id });
      expect(remaining).toBe(0);
    });

    it('rejects deleting an escalated issue (author)', async () => {
      const i = await issueService.createIssue(hid, alice._id.toString(), {
        title: 'X',
        body: 'y',
        category: 'cleaning',
      });
      await issueService.escalateToVote(hid, alice._id.toString(), i._id, {
        proposedRuleTitle: 'R',
        proposedRuleText: 'T',
      });
      await expect(
        issueService.deleteIssue(hid, alice._id.toString(), i._id)
      ).rejects.toThrow(/not open/i);
      // Issue and its vote linkage survive.
      expect(await Issue.findById(i._id)).not.toBeNull();
    });

    it('rejects deleting an escalated issue (admin)', async () => {
      const i = await issueService.createIssue(hid, bob._id.toString(), {
        title: 'X',
        body: 'y',
        category: 'cleaning',
      });
      await issueService.escalateToVote(hid, bob._id.toString(), i._id, {
        proposedRuleTitle: 'R',
        proposedRuleText: 'T',
      });
      await expect(
        issueService.deleteIssue(hid, alice._id.toString(), i._id)
      ).rejects.toThrow(/not open/i);
      expect(await Issue.findById(i._id)).not.toBeNull();
    });
  });

  describe('addComment', () => {
    it('allows commenting on an open issue', async () => {
      const i = await issueService.createIssue(hid, alice._id.toString(), {
        title: 'X',
        body: 'y',
        category: 'cleaning',
      });
      const c = await issueService.addComment(
        hid,
        bob._id.toString(),
        i._id,
        'reply'
      );
      expect(c.body).toBe('reply');
    });

    it('rejects commenting on an escalated issue', async () => {
      const i = await issueService.createIssue(hid, alice._id.toString(), {
        title: 'X',
        body: 'y',
        category: 'cleaning',
      });
      await issueService.escalateToVote(hid, alice._id.toString(), i._id, {
        proposedRuleTitle: 'R',
        proposedRuleText: 'T',
      });
      await expect(
        issueService.addComment(hid, bob._id.toString(), i._id, 'late reply')
      ).rejects.toThrow(/not open/i);
    });
  });

  describe('escalateToVote', () => {
    it('creates a Vote and sets status=escalated', async () => {
      const i = await issueService.createIssue(hid, alice._id.toString(), {
        title: 'X',
        body: 'y',
        category: 'cleaning',
      });
      const v = await issueService.escalateToVote(hid, bob._id.toString(), i._id, {
        proposedRuleTitle: 'Dishes 24h',
        proposedRuleText: 'Each person cleans within 24h.',
      });
      const updated = await Issue.findById(i._id);
      expect(updated?.status).toBe('escalated');
      expect(updated?.escalatedToVoteId?.toString()).toBe(v._id.toString());
    });

    it('rejects deadlineDays out of range', async () => {
      const i = await issueService.createIssue(hid, alice._id.toString(), {
        title: 'X',
        body: 'y',
        category: 'cleaning',
      });
      await expect(
        issueService.escalateToVote(hid, bob._id.toString(), i._id, {
          proposedRuleTitle: 'R',
          proposedRuleText: 'T',
          deadlineDays: 100,
        })
      ).rejects.toThrow(/deadline/i);
    });

    it('rejects when issue already escalated', async () => {
      const i = await issueService.createIssue(hid, alice._id.toString(), {
        title: 'X',
        body: 'y',
        category: 'cleaning',
      });
      await issueService.escalateToVote(hid, bob._id.toString(), i._id, {
        proposedRuleTitle: 'R',
        proposedRuleText: 'T',
      });
      await expect(
        issueService.escalateToVote(hid, carol._id.toString(), i._id, {
          proposedRuleTitle: 'R2',
          proposedRuleText: 'T2',
        })
      ).rejects.toThrow(/already escalated|not open/i);
    });
  });

  describe('getIssueForModeration', () => {
    it('admin/owner sees authorId + authorNickname', async () => {
      const i = await issueService.createIssue(hid, bob._id.toString(), {
        title: 'X',
        body: 'y',
        category: 'cleaning',
      });
      const mod = await issueService.getIssueForModeration(
        hid,
        alice._id.toString(),
        i._id
      );
      expect(mod.authorId).toBe(bob._id.toString());
      expect(mod.authorNickname).toBe('Bob');
    });

    it('regular member is forbidden', async () => {
      const i = await issueService.createIssue(hid, alice._id.toString(), {
        title: 'X',
        body: 'y',
        category: 'cleaning',
      });
      await expect(
        issueService.getIssueForModeration(hid, bob._id.toString(), i._id)
      ).rejects.toThrow(/forbidden|admin/i);
    });
  });
});
