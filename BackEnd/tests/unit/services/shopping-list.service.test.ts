import { describe, it, expect } from 'vitest';
import { shoppingListService } from '../../../src/services/shopping-list.service';
import { ShoppingListItem } from '../../../src/models/shopping-list-item.model';
import { AppError } from '../../../src/utils/error';
import { FIXTURES } from '../../seed/fixtures';

// ── Helpers ──────────────────────────────────────────────────────────
// Errors are factory functions returning AppError instances — match by
// AppError + statusCode, never by class name.
const expectAppError = (statusCode: number) => (err: unknown) =>
  err instanceof AppError && err.statusCode === statusCode;

// ── addItem ──────────────────────────────────────────────────────────

describe('shoppingListService.addItem', () => {
  it('lets any household member add an item (happy path)', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    const result = await shoppingListService.addItem(
      couple._id.toString(),
      alice._id.toString(),
      {
        name: 'Add-item happy path',
        quantity: '2',
        category: 'groceries',
      }
    );

    expect(result._id).toBeTypeOf('string');
    expect(result.householdId).toBe(couple._id.toString());
    expect(result.name).toBe('Add-item happy path');
    expect(result.quantity).toBe('2');
    expect(result.category).toBe('groceries');
    expect(result.addedByUserId).toBe(alice._id.toString());
    expect(result.isBought).toBe(false);
    expect(result.archivedAt).toBeUndefined();
  });
});

// ── listItems ────────────────────────────────────────────────────────

describe('shoppingListService.listItems', () => {
  it('returns paginated active items with unbought sorted before bought', async () => {
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    const result = await shoppingListService.listItems(
      couple._id.toString(),
      alice._id.toString(),
      { limit: 50 }
    );

    expect(Array.isArray(result.items)).toBe(true);
    expect(result.items.length).toBeGreaterThan(0);
    // All returned items must belong to this household and be non-archived.
    for (const item of result.items) {
      expect(item.householdId).toBe(couple._id.toString());
      expect(item.archivedAt).toBeUndefined();
    }
    // Service sort: { isBought: 1, ... } → unbought (false) before bought (true).
    const boughtFlags = result.items.map((i) => i.isBought);
    const firstBoughtIdx = boughtFlags.indexOf(true);
    if (firstBoughtIdx >= 0) {
      // No unbought items should come after the first bought one.
      for (let i = firstBoughtIdx; i < boughtFlags.length; i++) {
        expect(boughtFlags[i]).toBe(true);
      }
    }
    // nextCursor is null when there are no more pages.
    expect(result.nextCursor === null || typeof result.nextCursor === 'string').toBe(true);
  });
});

// ── toggleBought ─────────────────────────────────────────────────────

describe('shoppingListService.toggleBought', () => {
  it('marks an item as bought and records boughtAt + boughtByMemberId', async () => {
    // Use seeded 'milk' (couple, isBought: false).
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    const itemId = FIXTURES.shopping('milk');

    const result = await shoppingListService.toggleBought(
      couple._id.toString(),
      alice._id.toString(),
      itemId.toString()
    );

    expect(result._id).toBe(itemId.toString());
    expect(result.isBought).toBe(true);
    expect(result.boughtAt).toBeTypeOf('string');
    expect(result.boughtByMemberId).toBe(FIXTURES.member('alice-member').toString());
    expect(result.boughtByNickname).toBe('Alice');
  });
});

// ── updateItem ───────────────────────────────────────────────────────

describe('shoppingListService.updateItem', () => {
  it('updates the name and category of an active item', async () => {
    // Use seeded 'apples' (couple, not bought, not archived).
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');
    const itemId = FIXTURES.shopping('apples');

    const result = await shoppingListService.updateItem(
      couple._id.toString(),
      alice._id.toString(),
      itemId.toString(),
      { name: 'Granny Smith Apples', category: 'other' }
    );

    expect(result._id).toBe(itemId.toString());
    expect(result.name).toBe('Granny Smith Apples');
    expect(result.category).toBe('other');
  });
});

// ── archiveItem ──────────────────────────────────────────────────────

describe('shoppingListService.archiveItem', () => {
  it('archives an active item and rejects double-archive with BadRequest (400)', async () => {
    // Use seeded 'shampoo' (couple, not archived).
    const couple = FIXTURES.household('couple');
    const bob = FIXTURES.user('bob');
    const itemId = FIXTURES.shopping('shampoo');

    const archived = await shoppingListService.archiveItem(
      couple._id.toString(),
      bob._id.toString(),
      itemId.toString()
    );

    expect(archived._id).toBe(itemId.toString());
    expect(archived.archivedAt).toBeTypeOf('string');

    // Second archive should throw BadRequest.
    await expect(
      shoppingListService.archiveItem(
        couple._id.toString(),
        bob._id.toString(),
        itemId.toString()
      )
    ).rejects.toSatisfy(expectAppError(400));
  });
});

// ── restoreItem ──────────────────────────────────────────────────────

describe('shoppingListService.restoreItem', () => {
  it('restores an archived item (clears archivedAt + isBought)', async () => {
    // Add a fresh item, archive it, then restore.
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    const created = await shoppingListService.addItem(
      couple._id.toString(),
      alice._id.toString(),
      { name: 'To-be-restored', category: 'groceries' }
    );

    await shoppingListService.archiveItem(
      couple._id.toString(),
      alice._id.toString(),
      created._id
    );

    const restored = await shoppingListService.restoreItem(
      couple._id.toString(),
      alice._id.toString(),
      created._id
    );

    expect(restored._id).toBe(created._id);
    expect(restored.archivedAt).toBeUndefined();
    expect(restored.isBought).toBe(false);
    expect(restored.boughtAt).toBeUndefined();
    expect(restored.boughtByMemberId).toBeUndefined();
  });
});

// ── deleteItem ───────────────────────────────────────────────────────

describe('shoppingListService.deleteItem', () => {
  it('deletes an item from the database', async () => {
    // Add a fresh item so test is self-contained.
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    const created = await shoppingListService.addItem(
      couple._id.toString(),
      alice._id.toString(),
      { name: 'To-be-deleted', category: 'groceries' }
    );

    await expect(
      shoppingListService.deleteItem(
        couple._id.toString(),
        alice._id.toString(),
        created._id
      )
    ).resolves.toBeUndefined();

    const stillThere = await ShoppingListItem.findById(created._id).lean();
    expect(stillThere).toBeNull();
  });
});

// ── listArchivedHistory ──────────────────────────────────────────────

describe('shoppingListService.listArchivedHistory', () => {
  it('returns paginated archived items as history entries', async () => {
    // Archive a fresh item so we have something to retrieve.
    const couple = FIXTURES.household('couple');
    const alice = FIXTURES.user('alice');

    const created = await shoppingListService.addItem(
      couple._id.toString(),
      alice._id.toString(),
      { name: 'Archived for history test', category: 'groceries' }
    );
    await shoppingListService.archiveItem(
      couple._id.toString(),
      alice._id.toString(),
      created._id
    );

    const result = await shoppingListService.listArchivedHistory(
      couple._id.toString(),
      alice._id.toString(),
      { limit: 10 }
    );

    expect(Array.isArray(result.entries)).toBe(true);
    expect(result.entries.length).toBeGreaterThan(0);
    // Each entry has archivedAt + items array.
    for (const entry of result.entries) {
      expect(entry.archivedAt).toBeTypeOf('string');
      expect(Array.isArray(entry.items)).toBe(true);
      expect(entry.items.length).toBeGreaterThan(0);
      // Manual archive (no expense) → entry.type === 'manual'.
      expect(['manual', 'trip']).toContain(entry.type);
    }
    expect(result.nextCursor === null || typeof result.nextCursor === 'string').toBe(true);
  });
});
