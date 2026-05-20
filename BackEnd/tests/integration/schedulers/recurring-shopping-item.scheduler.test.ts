import { describe, it, expect } from 'vitest';
import { recurringShoppingItemService } from '../../../src/services/recurring-shopping-item.service';
import { shoppingListService } from '../../../src/services/shopping-list.service';
import { ShoppingListItem } from '../../../src/models/shopping-list-item.model';
import { FIXTURES } from '../../seed/fixtures';

describe('recurringShoppingItemService.fireRulesForCadence (recurring-shopping-item scheduler worker)', () => {
  it('creates a ShoppingListItem for an active rule matching the cadence', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const ts = Date.now();
    const name = `Auto Milk ${ts}`;

    await recurringShoppingItemService.createRule(
      couple._id.toString(),
      alice._id.toString(),
      { name, category: 'groceries', cadence: 'weekly' }
    );

    const result = await recurringShoppingItemService.fireRulesForCadence('weekly');
    expect(result.created).toBeGreaterThanOrEqual(1);

    const spawned = await ShoppingListItem.find({
      householdId: couple._id,
      name,
    }).lean();
    expect(spawned.length).toBeGreaterThanOrEqual(1);
  });

  it('skips creation when an unbought duplicate already exists (dedup by lowercased name + category)', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const ts = Date.now();
    const name = `Auto Bread ${ts}`;

    await recurringShoppingItemService.createRule(
      couple._id.toString(),
      alice._id.toString(),
      { name, category: 'groceries', cadence: 'weekly' }
    );
    await shoppingListService.addItem(
      couple._id.toString(),
      alice._id.toString(),
      { name, category: 'groceries' }
    );

    const before = await ShoppingListItem.countDocuments({
      householdId: couple._id,
      name,
    });

    const result = await recurringShoppingItemService.fireRulesForCadence('weekly');
    expect(result.skipped).toBeGreaterThanOrEqual(1);

    const after = await ShoppingListItem.countDocuments({
      householdId: couple._id,
      name,
    });
    expect(after).toBe(before);
  });

  it('only fires rules matching the cadence', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const ts = Date.now();
    const dailyName = `Auto Daily ${ts}`;
    const monthlyName = `Auto Monthly ${ts}`;

    await recurringShoppingItemService.createRule(
      couple._id.toString(),
      alice._id.toString(),
      { name: dailyName, category: 'groceries', cadence: 'daily' }
    );
    await recurringShoppingItemService.createRule(
      couple._id.toString(),
      alice._id.toString(),
      { name: monthlyName, category: 'groceries', cadence: 'monthly' }
    );

    await recurringShoppingItemService.fireRulesForCadence('daily');

    expect(
      await ShoppingListItem.countDocuments({ householdId: couple._id, name: dailyName })
    ).toBeGreaterThanOrEqual(1);
    expect(
      await ShoppingListItem.countDocuments({ householdId: couple._id, name: monthlyName })
    ).toBe(0);
  });

  it('ignores inactive rules', async () => {
    const alice = FIXTURES.user('alice');
    const couple = FIXTURES.household('couple');
    const ts = Date.now();
    const name = `Auto Inactive ${ts}`;

    const rule = await recurringShoppingItemService.createRule(
      couple._id.toString(),
      alice._id.toString(),
      { name, category: 'groceries', cadence: 'weekly' }
    );
    // Note: updateRule takes ruleId as the FIRST argument.
    await recurringShoppingItemService.updateRule(
      rule._id,
      couple._id.toString(),
      alice._id.toString(),
      { active: false }
    );

    await recurringShoppingItemService.fireRulesForCadence('weekly');

    const count = await ShoppingListItem.countDocuments({
      householdId: couple._id,
      name,
    });
    expect(count).toBe(0);
  });
});
