import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { goalService } from '../../../src/services/goal.service';
import { Goal } from '../../../src/models/goal.model';
import { AppError } from '../../../src/utils/error';
import { FIXTURES } from '../../seed/fixtures';

// ── Helpers ──────────────────────────────────────────────────────────
// Errors are factory functions returning AppError instances — match by
// AppError + statusCode, never by class name.
const expectAppError = (statusCode: number) => (err: unknown) =>
  err instanceof AppError && err.statusCode === statusCode;

// ── addGoal ──────────────────────────────────────────────────────────

describe('goalService.addGoal', () => {
  it('lets any household member add a goal (happy path)', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    const result = await goalService.addGoal(
      couple._id.toString(),
      alice._id.toString(),
      {
        name: 'Add-goal happy path',
        targetAmount: 1000,
        category: 'savings',
      }
    );

    expect(result._id).toBeTypeOf('string');
    expect(result.householdId).toBe(couple._id.toString());
    expect(result.name).toBe('Add-goal happy path');
    expect(result.targetAmount).toBe(1000);
    expect(result.currentAmount).toBe(0);
    expect(result.status).toBe('active');
    expect(result.contributions).toEqual([]);
    expect(result.createdByUserId).toBe(alice._id.toString());
  });
});

// ── listGoals ────────────────────────────────────────────────────────

describe('goalService.listGoals', () => {
  it("returns paginated goals filtered by status='active'", async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    const result = await goalService.listGoals(
      couple._id.toString(),
      alice._id.toString(),
      { status: 'active', page: 1, limit: 20 }
    );

    expect(Array.isArray(result.items)).toBe(true);
    // Couple has 'vacation' and 'new-couch' — both active. Plus any goals
    // created by addGoal tests above. So at least 2.
    expect(result.items.length).toBeGreaterThanOrEqual(2);
    for (const goal of result.items) {
      expect(goal.householdId).toBe(couple._id.toString());
      expect(goal.status).toBe('active');
    }
    expect(typeof result.total).toBe('number');
  });
});

// ── getGoal ──────────────────────────────────────────────────────────

describe('goalService.getGoal', () => {
  it('returns a single goal by id', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    const goalId = FIXTURES.goal('vacation');

    const result = await goalService.getGoal(
      couple._id.toString(),
      alice._id.toString(),
      goalId.toString()
    );

    expect(result._id).toBe(goalId.toString());
    expect(result.name).toBe('Summer Vacation');
    expect(result.targetAmount).toBe(2500);
    expect(result.currentAmount).toBe(900); // 500 + 400
    expect(result.contributions.length).toBe(2);
  });

  it('throws NotFound (404) when the goal does not exist', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    await expect(
      goalService.getGoal(
        couple._id.toString(),
        alice._id.toString(),
        new Types.ObjectId().toString()
      )
    ).rejects.toSatisfy(expectAppError(404));
  });
});

// ── updateGoal ───────────────────────────────────────────────────────

describe('goalService.updateGoal', () => {
  it('lets the creator update target amount', async () => {
    // Alice created vacation goal.
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    const goalId = FIXTURES.goal('vacation');

    const result = await goalService.updateGoal(
      couple._id.toString(),
      alice._id.toString(),
      goalId.toString(),
      { targetAmount: 3000 }
    );

    expect(result.targetAmount).toBe(3000);
    expect(result._id).toBe(goalId.toString());
  });

  it('rejects a non-creator non-admin with Forbidden (403)', async () => {
    // Bob (member role) tries to update vacation (created by alice).
    const couple = FIXTURES.household('couple');
    const bob = FIXTURES.user('bob');
    const goalId = FIXTURES.goal('vacation');

    await expect(
      goalService.updateGoal(
        couple._id.toString(),
        bob._id.toString(),
        goalId.toString(),
        { name: 'unauthorized rename' }
      )
    ).rejects.toSatisfy(expectAppError(403));
  });
});

// ── deleteGoal ───────────────────────────────────────────────────────

describe('goalService.deleteGoal', () => {
  it('lets the creator delete their own goal', async () => {
    // Create a fresh goal for alice so test is self-contained.
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    const created = await goalService.addGoal(
      couple._id.toString(),
      alice._id.toString(),
      { name: 'To-be-deleted goal', targetAmount: 100 }
    );

    await expect(
      goalService.deleteGoal(
        couple._id.toString(),
        alice._id.toString(),
        created._id
      )
    ).resolves.toBeUndefined();

    const stillThere = await Goal.findById(created._id).lean();
    expect(stillThere).toBeNull();
  });
});

// ── addContribution ──────────────────────────────────────────────────

describe('goalService.addContribution', () => {
  it('lets any member contribute to an active goal', async () => {
    // Use a fresh goal so test doesn't interfere with seeded ones.
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    const bob = FIXTURES.user('bob');

    const created = await goalService.addGoal(
      couple._id.toString(),
      alice._id.toString(),
      { name: 'Contribution target', targetAmount: 500 }
    );

    const result = await goalService.addContribution(
      couple._id.toString(),
      bob._id.toString(),
      created._id,
      { amount: 50, note: 'Bob first contribution' }
    );

    expect(result.contributions.length).toBe(1);
    expect(result.contributions[0].amount).toBe(50);
    expect(result.contributions[0].note).toBe('Bob first contribution');
    expect(result.contributions[0].memberId).toBe(FIXTURES.member('bob-member').toString());
    expect(result.currentAmount).toBe(50);
    expect(result.status).toBe('active');
  });

  it("auto-completes the goal when the target is reached", async () => {
    // Create a fresh active goal with target 100 and contribute 100 in one go.
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    const created = await goalService.addGoal(
      couple._id.toString(),
      alice._id.toString(),
      { name: 'Auto-complete target', targetAmount: 100 }
    );

    const result = await goalService.addContribution(
      couple._id.toString(),
      alice._id.toString(),
      created._id,
      { amount: 150 } // overflow past target
    );

    expect(result.currentAmount).toBeGreaterThanOrEqual(result.targetAmount);
    expect(result.status).toBe('completed');
    expect(result.completedAt).toBeTypeOf('string');
  });
});

// ── removeContribution ───────────────────────────────────────────────

describe('goalService.removeContribution', () => {
  it('lets the contribution author remove their own contribution', async () => {
    // Create a fresh goal + add contribution by bob, then remove it.
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    const bob = FIXTURES.user('bob');

    const created = await goalService.addGoal(
      couple._id.toString(),
      alice._id.toString(),
      { name: 'Remove-contribution target', targetAmount: 500 }
    );

    const withContribution = await goalService.addContribution(
      couple._id.toString(),
      bob._id.toString(),
      created._id,
      { amount: 75 }
    );

    expect(withContribution.contributions.length).toBe(1);
    const contributionId = withContribution.contributions[0]._id;

    const removed = await goalService.removeContribution(
      couple._id.toString(),
      bob._id.toString(),
      created._id,
      contributionId
    );

    expect(removed.contributions.length).toBe(0);
    expect(removed.currentAmount).toBe(0);
  });
});
