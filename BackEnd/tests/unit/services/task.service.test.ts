import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { taskService } from '../../../src/services/task.service';
import { Task } from '../../../src/models/task.model';
import { Household } from '../../../src/models/household.model';
import { AppError } from '../../../src/utils/error';
import { FIXTURES } from '../../seed/fixtures';
import { makeUser } from '../../helpers/factories';

// ── Helpers ──────────────────────────────────────────────────────────
// Errors are factory functions returning AppError instances — match by
// AppError + statusCode, never by class name.
const expectAppError = (statusCode: number) => (err: unknown) =>
  err instanceof AppError && err.statusCode === statusCode;

// ── addTask ──────────────────────────────────────────────────────────

describe('taskService.addTask', () => {
  it('lets a task-participating member add a task (happy path)', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    const result = await taskService.addTask(
      couple._id.toString(),
      alice._id.toString(),
      { title: 'Add-task happy path' }
    );

    expect(result._id).toBeTypeOf('string');
    expect(result.householdId).toBe(couple._id.toString());
    expect(result.title).toBe('Add-task happy path');
    expect(result.createdByUserId).toBe(alice._id.toString());
    expect(result.isCompleted).toBe(false);
  });

  it('rejects a non-task-participating member with Forbidden (403)', async () => {
    // Frank in flatshare has participatesInTasks: false.
    const flatshare = FIXTURES.household('flatshare');
    const frank = FIXTURES.user('frank');

    await expect(
      taskService.addTask(
        flatshare._id.toString(),
        frank._id.toString(),
        { title: 'Frank attempt' }
      )
    ).rejects.toSatisfy(expectAppError(403));
  });
});

// ── listTasks ────────────────────────────────────────────────────────

describe('taskService.listTasks', () => {
  it('returns paginated tasks for a household member', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    const result = await taskService.listTasks(
      couple._id.toString(),
      alice._id.toString(),
      { limit: 50 }
    );

    expect(Array.isArray(result.items)).toBe(true);
    expect(result.items.length).toBeGreaterThan(0);
    // All returned tasks must belong to this household.
    for (const task of result.items) {
      expect(task.householdId).toBe(couple._id.toString());
    }
    // nextCursor is null when there are no more pages.
    expect(result.nextCursor === null || typeof result.nextCursor === 'string').toBe(true);
  });
});

// ── toggleComplete ───────────────────────────────────────────────────

describe('taskService.toggleComplete', () => {
  it('marks a task complete and toggles back to incomplete', async () => {
    // Use vacuum (incomplete, created by alice in couple).
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    const taskId = FIXTURES.task('vacuum');

    // First toggle → completed.
    const completed = await taskService.toggleComplete(
      couple._id.toString(),
      alice._id.toString(),
      taskId.toString()
    );
    expect(completed.isCompleted).toBe(true);
    expect(completed.completedAt).toBeTypeOf('string');
    expect(completed.completedByMemberId).toBe(FIXTURES.member('alice-member').toString());

    // Second toggle → incomplete (alice is the completer, so within 24h she can undo).
    const reopened = await taskService.toggleComplete(
      couple._id.toString(),
      alice._id.toString(),
      taskId.toString()
    );
    expect(reopened.isCompleted).toBe(false);
    expect(reopened.completedAt).toBeUndefined();
    expect(reopened.completedByMemberId).toBeUndefined();
  });

  // Only the completer can undo a completion within 24h. Even an admin who
  // did not complete the task is rejected.
  it('blocks a non-completer from undoing within 24h, even if they are admin', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice'); // owner of couple
    const bob = FIXTURES.user('bob');

    const created = await taskService.addTask(
      couple._id.toString(),
      alice._id.toString(),
      { title: 'Undo-authz target' }
    );

    // Bob completes the task.
    const completed = await taskService.toggleComplete(
      couple._id.toString(),
      bob._id.toString(),
      created._id
    );
    expect(completed.isCompleted).toBe(true);

    // Alice is the owner but did not complete it — she cannot undo.
    await expect(
      taskService.toggleComplete(
        couple._id.toString(),
        alice._id.toString(),
        created._id
      )
    ).rejects.toSatisfy(expectAppError(403));
  });
});

// ── deleteTask ───────────────────────────────────────────────────────

describe('taskService.deleteTask', () => {
  it('lets the creator delete their own task', async () => {
    // Create a fresh task for alice in couple so the test is self-contained.
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    const created = await taskService.addTask(
      couple._id.toString(),
      alice._id.toString(),
      { title: 'To-be-deleted task' }
    );

    await expect(
      taskService.deleteTask(
        couple._id.toString(),
        alice._id.toString(),
        created._id
      )
    ).resolves.toBeUndefined();

    const stillThere = await Task.findById(created._id).lean();
    expect(stillThere).toBeNull();
  });

  it('rejects a non-creator non-admin with Forbidden (403)', async () => {
    // Bob is a 'member' (not admin) in couple. Vacuum was created by alice.
    const couple = FIXTURES.household('couple');
    const bob = FIXTURES.user('bob');
    const taskId = FIXTURES.task('vacuum');

    await expect(
      taskService.deleteTask(
        couple._id.toString(),
        bob._id.toString(),
        taskId.toString()
      )
    ).rejects.toSatisfy(expectAppError(403));
  });

  it('throws NotFound (404) when the task does not exist', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    await expect(
      taskService.deleteTask(
        couple._id.toString(),
        alice._id.toString(),
        new Types.ObjectId().toString()
      )
    ).rejects.toSatisfy(expectAppError(404));
  });

  // F4.5: task.service.ts deleteTask (lines 223-228) allows admin/owner to
  // delete tasks created by others. Cover the admin-deletes-other path.
  it('lets an admin delete a task they did not create', async () => {
    // Eve is an admin in flatshare. Carol (owner) creates a task; eve deletes it.
    const flatshare = FIXTURES.household('flatshare');
    const carol = FIXTURES.user('carol');
    const eve = FIXTURES.user('eve');

    const created = await taskService.addTask(
      flatshare._id.toString(),
      carol._id.toString(),
      { title: 'Carol-created, eve-deleted' }
    );

    await expect(
      taskService.deleteTask(
        flatshare._id.toString(),
        eve._id.toString(),
        created._id
      )
    ).resolves.toBeUndefined();

    const stillThere = await Task.findById(created._id).lean();
    expect(stillThere).toBeNull();
  });
});

// ── assignTask ───────────────────────────────────────────────────────

describe('taskService.assignTask', () => {
  it('lets the task creator reassign their task in fixed mode', async () => {
    // Flatshare is fixed mode. Carol creates a task and reassigns it to eve.
    const flatshare = FIXTURES.household('flatshare');
    const carol = FIXTURES.user('carol');
    const eveMemberId = FIXTURES.member('eve-member');

    const created = await taskService.addTask(
      flatshare._id.toString(),
      carol._id.toString(),
      { title: 'Creator-reassign target' }
    );

    const reassigned = await taskService.assignTask(
      flatshare._id.toString(),
      carol._id.toString(),
      created._id,
      { assignedToMemberId: eveMemberId.toString() }
    );

    expect(reassigned.assignedToMemberId).toBe(eveMemberId.toString());
  });

  it('rejects an admin reassigning a task they did not create in fixed mode', async () => {
    // Carol creates a task; eve is admin but not the creator, so eve cannot
    // assign it to carol-member (someone other than herself).
    const flatshare = FIXTURES.household('flatshare');
    const carol = FIXTURES.user('carol');
    const eve = FIXTURES.user('eve');
    const carolMemberId = FIXTURES.member('carol-member');

    const created = await taskService.addTask(
      flatshare._id.toString(),
      carol._id.toString(),
      { title: 'Admin-cannot-reassign target' }
    );

    await expect(
      taskService.assignTask(
        flatshare._id.toString(),
        eve._id.toString(),
        created._id,
        { assignedToMemberId: carolMemberId.toString() }
      )
    ).rejects.toSatisfy(expectAppError(403));
  });

  it('lets a regular member self-assign an unassigned task', async () => {
    // Bob (member role) in couple self-assigns a fresh, unassigned task.
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    const bob = FIXTURES.user('bob');
    const bobMemberId = FIXTURES.member('bob-member');

    const created = await taskService.addTask(
      couple._id.toString(),
      alice._id.toString(),
      { title: 'Self-assign target' }
    );

    const assigned = await taskService.assignTask(
      couple._id.toString(),
      bob._id.toString(),
      created._id,
      { assignedToMemberId: bobMemberId.toString() }
    );

    expect(assigned.assignedToMemberId).toBe(bobMemberId.toString());
  });

  it('rejects a non-creator non-self assignment with Forbidden (403)', async () => {
    // Bob (not creator, not self) tries to assign a task to alice.
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    const bob = FIXTURES.user('bob');
    const aliceMemberId = FIXTURES.member('alice-member');

    const created = await taskService.addTask(
      couple._id.toString(),
      alice._id.toString(),
      { title: 'Bob-assigns-alice target' }
    );

    await expect(
      taskService.assignTask(
        couple._id.toString(),
        bob._id.toString(),
        created._id,
        { assignedToMemberId: aliceMemberId.toString() }
      )
    ).rejects.toSatisfy(expectAppError(403));
  });
});

// ── setRotation ──────────────────────────────────────────────────────
// NOTE: setRotation mutates household.settings.taskRotationConfig, which
// would change addTask auto-assignment behaviour for subsequent tests in
// this file. To keep the seeded couple household pristine, build a fresh
// 2-task-member household via `makeUser` + Household model directly.

describe('taskService.setRotation', () => {
  const buildFreshTaskHousehold = async (label: string) => {
    const owner = await makeUser({ email: `task-rot-owner-${label}@example.com` });
    const partner = await makeUser({ email: `task-rot-partner-${label}@example.com` });
    const ownerMemberId = new Types.ObjectId();
    const partnerMemberId = new Types.ObjectId();
    const household = await new Household({
      name: `Rotation Test ${label}`,
      livingArrangement: 'couple',
      totalMembers: 2,
      uiMode: 'couple',
      createdBy: owner._id,
      inviteCode: `rot-${label}-${Date.now()}`,
      members: [
        {
          _id: ownerMemberId,
          userId: owner._id,
          nickname: 'Owner',
          ageGroup: 'adult',
          role: 'owner',
          isCreator: true,
          participatesInFinances: true,
          participatesInTasks: true,
        },
        {
          _id: partnerMemberId,
          userId: partner._id,
          nickname: 'Partner',
          ageGroup: 'adult',
          role: 'member',
          isCreator: false,
          participatesInFinances: true,
          participatesInTasks: true,
        },
      ],
      settings: {
        currency: 'BGN',
        taskManagementEnabled: 'full',
        taskDistributionMethod: 'rotation',
        trackedExpenseTypes: [],
      },
    }).save();
    return { household, owner, partner, ownerMemberId, partnerMemberId };
  };

  it('lets an admin set the rotation and returns the current rotation status', async () => {
    const { household, owner, ownerMemberId } = await buildFreshTaskHousehold('admin-ok');

    const status = await taskService.setRotation(
      household._id.toString(),
      owner._id.toString(),
      { startMemberId: ownerMemberId.toString() }
    );

    expect(status.currentMemberId).toBe(ownerMemberId.toString());
    expect(status.periodDays).toBe(7);
    expect(status.currentNickname).toBe('Owner');
    expect(status.currentPeriodStartDate).toBeTypeOf('string');
    expect(status.nextPeriodStartDate).toBeTypeOf('string');
  });

  it('rejects a non-admin with Forbidden (403)', async () => {
    const { household, partner, ownerMemberId } = await buildFreshTaskHousehold('non-admin');

    await expect(
      taskService.setRotation(
        household._id.toString(),
        partner._id.toString(),
        { startMemberId: ownerMemberId.toString() }
      )
    ).rejects.toSatisfy(expectAppError(403));
  });

  // F4.7: task.service.ts setRotation (lines 325-327) throws 400 when the
  // provided startMemberId does not match a task-participating member.
  // Frank is a flatshare member with participatesInTasks: false, so passing
  // his memberId should be rejected.
  it('throws 400 when startMemberId is not a task-participating member', async () => {
    const flatshare = FIXTURES.household('flatshare');
    const eve = FIXTURES.user('eve'); // admin of flatshare
    const frankMemberId = FIXTURES.member('frank-member'); // participatesInTasks: false

    await expect(
      taskService.setRotation(
        flatshare._id.toString(),
        eve._id.toString(),
        { startMemberId: frankMemberId.toString() }
      )
    ).rejects.toSatisfy(expectAppError(400));
  });
});
