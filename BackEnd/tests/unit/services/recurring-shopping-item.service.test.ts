import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { recurringShoppingItemService } from '../../../src/services/recurring-shopping-item.service';
import { RecurringShoppingItem } from '../../../src/models/recurring-shopping-item.model';
import { ShoppingListItem } from '../../../src/models/shopping-list-item.model';
import { Household } from '../../../src/models/household.model';
import { AppError } from '../../../src/utils/error';
import { FIXTURES } from '../../seed/fixtures';
import type { IRecurringShoppingItemPayload } from '../../../src/types/recurring-shopping-item.types';

// ── Helpers ──────────────────────────────────────────────────────────
const expectAppError = (statusCode: number) => (err: unknown) =>
  err instanceof AppError && err.statusCode === statusCode;

const basePayload = (
  overrides: Partial<IRecurringShoppingItemPayload> = {}
): IRecurringShoppingItemPayload => ({
  name: 'Milk',
  category: 'groceries',
  cadence: 'weekly',
  ...overrides,
});

// ── createRule ──────────────────────────────────────────────────────

describe('recurringShoppingItemService.createRule', () => {
  it('lets a household member create a rule (happy path)', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    const result = await recurringShoppingItemService.createRule(
      couple._id.toString(),
      alice._id.toString(),
      basePayload({ name: 'Milk weekly', category: 'groceries', cadence: 'weekly' })
    );

    expect(result._id).toBeTypeOf('string');
    expect(result.householdId).toBe(couple._id.toString());
    expect(result.createdBy).toBe(alice._id.toString());
    expect(result.name).toBe('Milk weekly');
    expect(result.category).toBe('groceries');
    expect(result.cadence).toBe('weekly');
    expect(result.active).toBe(true);
  });
});

// ── listRules ───────────────────────────────────────────────────────

describe('recurringShoppingItemService.listRules', () => {
  it('returns all rules for the household', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    const created = await recurringShoppingItemService.createRule(
      couple._id.toString(),
      alice._id.toString(),
      basePayload({ name: 'List-test soap', category: 'other', cadence: 'monthly' })
    );

    const { rules } = await recurringShoppingItemService.listRules(
      couple._id.toString(),
      alice._id.toString()
    );

    expect(Array.isArray(rules)).toBe(true);
    expect(rules.length).toBeGreaterThan(0);
    const found = rules.find((r) => r._id === created._id);
    expect(found).toBeDefined();
    expect(found!.householdId).toBe(couple._id.toString());
    expect(found!.name).toBe('List-test soap');
    expect(found!.cadence).toBe('monthly');
  });
});

// ── updateRule ──────────────────────────────────────────────────────

describe('recurringShoppingItemService.updateRule', () => {
  it('updates name and cadence', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    const created = await recurringShoppingItemService.createRule(
      couple._id.toString(),
      alice._id.toString(),
      basePayload({ name: 'Update target — original', cadence: 'weekly' })
    );

    const updated = await recurringShoppingItemService.updateRule(
      created._id,
      couple._id.toString(),
      alice._id.toString(),
      { name: 'Update target — renamed', cadence: 'monthly' }
    );

    expect(updated._id).toBe(created._id);
    expect(updated.name).toBe('Update target — renamed');
    expect(updated.cadence).toBe('monthly');
  });

  it('throws NotFound (404) when the rule does not exist', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    await expect(
      recurringShoppingItemService.updateRule(
        new Types.ObjectId().toString(),
        couple._id.toString(),
        alice._id.toString(),
        { name: 'noop' }
      )
    ).rejects.toSatisfy(expectAppError(404));
  });

  it('rejects update from a non-creator non-admin with Forbidden (403)', async () => {
    // Alice (couple owner) creates a rule; Bob (couple member, not admin)
    // tries to update it — should be denied.
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    const bob = FIXTURES.user('bob');

    const created = await recurringShoppingItemService.createRule(
      couple._id.toString(),
      alice._id.toString(),
      basePayload({ name: 'Alice-only update target', cadence: 'weekly' })
    );

    await expect(
      recurringShoppingItemService.updateRule(
        created._id,
        couple._id.toString(),
        bob._id.toString(),
        { name: 'unauthorized rename' }
      )
    ).rejects.toSatisfy(expectAppError(403));
  });

  it('lets an admin who did not create the rule update it', async () => {
    // Carol (flatshare owner) creates a rule; Eve (flatshare admin) updates it.
    const flatshare = FIXTURES.household('flatshare');
    const carol = FIXTURES.user('carol');
    const eve = FIXTURES.user('eve');

    const created = await recurringShoppingItemService.createRule(
      flatshare._id.toString(),
      carol._id.toString(),
      basePayload({ name: 'Admin-bypass update target', cadence: 'weekly' })
    );

    const updated = await recurringShoppingItemService.updateRule(
      created._id,
      flatshare._id.toString(),
      eve._id.toString(),
      { name: 'Admin-bypass update — renamed' }
    );

    expect(updated._id).toBe(created._id);
    expect(updated.name).toBe('Admin-bypass update — renamed');
  });
});

// ── deleteRule ──────────────────────────────────────────────────────

describe('recurringShoppingItemService.deleteRule', () => {
  it('deletes a rule — no longer in list', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    const created = await recurringShoppingItemService.createRule(
      couple._id.toString(),
      alice._id.toString(),
      basePayload({ name: 'To-be-deleted rule', cadence: 'daily' })
    );

    await expect(
      recurringShoppingItemService.deleteRule(
        created._id,
        couple._id.toString(),
        alice._id.toString()
      )
    ).resolves.toBeUndefined();

    const { rules } = await recurringShoppingItemService.listRules(
      couple._id.toString(),
      alice._id.toString()
    );
    expect(rules.find((r) => r._id === created._id)).toBeUndefined();

    // Underlying doc should actually be removed (hard-delete in service).
    const stillThere = await RecurringShoppingItem.findById(created._id).lean();
    expect(stillThere).toBeNull();
  });

  it('rejects delete from a non-creator non-admin with Forbidden (403)', async () => {
    // Alice (couple owner) creates a rule; Bob (couple member, not admin)
    // tries to delete it — should be denied.
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    const bob = FIXTURES.user('bob');

    const created = await recurringShoppingItemService.createRule(
      couple._id.toString(),
      alice._id.toString(),
      basePayload({ name: 'Alice-only delete target', cadence: 'weekly' })
    );

    await expect(
      recurringShoppingItemService.deleteRule(
        created._id,
        couple._id.toString(),
        bob._id.toString()
      )
    ).rejects.toSatisfy(expectAppError(403));

    // Underlying doc should still exist.
    const stillThere = await RecurringShoppingItem.findById(created._id).lean();
    expect(stillThere).not.toBeNull();
  });

  it('lets an admin who did not create the rule delete it', async () => {
    // Carol (flatshare owner) creates a rule; Eve (flatshare admin) deletes it.
    const flatshare = FIXTURES.household('flatshare');
    const carol = FIXTURES.user('carol');
    const eve = FIXTURES.user('eve');

    const created = await recurringShoppingItemService.createRule(
      flatshare._id.toString(),
      carol._id.toString(),
      basePayload({ name: 'Admin-bypass delete target', cadence: 'weekly' })
    );

    await expect(
      recurringShoppingItemService.deleteRule(
        created._id,
        flatshare._id.toString(),
        eve._id.toString()
      )
    ).resolves.toBeUndefined();

    const stillThere = await RecurringShoppingItem.findById(created._id).lean();
    expect(stillThere).toBeNull();
  });
});

// ── fireRulesForCadence ─────────────────────────────────────────────
// F5.18: scheduler hook — materializes active recurring rules into shopping
// list items, deduped by name+category. Errors per-rule are swallowed.
// Tests in this block share the seeded DB; the deleted-household case is
// scheduled LAST so it doesn't perturb the others.

describe('recurringShoppingItemService.fireRulesForCadence', () => {
  it('materializes items for active rules at the matching cadence', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    const uniqueName = 'Fire-materialize weekly';

    await recurringShoppingItemService.createRule(
      couple._id.toString(),
      alice._id.toString(),
      basePayload({ name: uniqueName, category: 'groceries', cadence: 'weekly' })
    );

    const result = await recurringShoppingItemService.fireRulesForCadence('weekly');
    expect(result.created).toBeGreaterThanOrEqual(1);

    // The new active item carrying this rule's name+category should now exist.
    const found = await ShoppingListItem.findOne({
      householdId: couple._id,
      name: uniqueName,
      category: 'groceries',
      archivedAt: null,
    }).lean();
    expect(found).not.toBeNull();
  });

  it('skips rules whose item already exists (dedup by name + category)', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    const uniqueName = 'Fire-dedup weekly';

    await recurringShoppingItemService.createRule(
      couple._id.toString(),
      alice._id.toString(),
      basePayload({ name: uniqueName, category: 'groceries', cadence: 'weekly' })
    );
    // Pre-create the matching item — fire must NOT add another.
    await ShoppingListItem.create({
      householdId: couple._id,
      name: uniqueName,
      category: 'groceries',
      addedByUserId: alice._id,
    });

    const before = await ShoppingListItem.countDocuments({
      householdId: couple._id,
      name: uniqueName,
      category: 'groceries',
    });
    await recurringShoppingItemService.fireRulesForCadence('weekly');
    const after = await ShoppingListItem.countDocuments({
      householdId: couple._id,
      name: uniqueName,
      category: 'groceries',
    });

    expect(after).toBe(before);
  });

  it('does not materialize when the rule cadence differs from the fired cadence', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    const uniqueName = 'Fire-wrong-cadence monthly';

    await recurringShoppingItemService.createRule(
      couple._id.toString(),
      alice._id.toString(),
      basePayload({ name: uniqueName, category: 'groceries', cadence: 'monthly' })
    );

    await recurringShoppingItemService.fireRulesForCadence('daily');

    // No active item with this monthly rule's name should exist after a daily fire.
    const found = await ShoppingListItem.findOne({
      householdId: couple._id,
      name: uniqueName,
      category: 'groceries',
      archivedAt: null,
    }).lean();
    expect(found).toBeNull();
  });

  it('survives a deleted-household rule gracefully (per-rule error swallowed)', async () => {
    // Use the flatshare household here; deleting it after this block is fine
    // because subsequent tests in this file have already run.
    const flatshare = FIXTURES.household('flatshare');
    const carol = FIXTURES.user('carol');
    const uniqueName = 'Fire-deleted-household weekly';

    await recurringShoppingItemService.createRule(
      flatshare._id.toString(),
      carol._id.toString(),
      basePayload({ name: uniqueName, category: 'groceries', cadence: 'weekly' })
    );

    // Remove the household so `addItem` inside fireRulesForCadence throws —
    // the service's try/catch (lines 129-143) must swallow the error and the
    // call must resolve normally.
    await Household.deleteOne({ _id: flatshare._id });

    await expect(
      recurringShoppingItemService.fireRulesForCadence('weekly')
    ).resolves.toEqual(expect.objectContaining({
      created: expect.any(Number),
      skipped: expect.any(Number),
    }));
  });
});
