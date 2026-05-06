import { Types } from 'mongoose';
import { ShoppingListItem } from '../models/shopping-list-item.model';
import {
  IShoppingListItem,
  IAddShoppingItemInput,
  IUpdateShoppingItemInput,
  IShoppingListItemResponse,
  HistoryEntry,
  IListHistoryResult,
  IListItemsOptions,
  IListItemsResult,
  IListHistoryOptions,
} from '../types/shopping-list.types';
import { escapeRegex } from '../utils/regex';
import { ExpenseType } from '../types/household.types';
import { NotFoundError, BadRequestError } from '../utils/error';
import { getHouseholdForMember } from '../utils/household.helpers';
import { expenseService } from './expense.service';

function encodeActiveCursor(c: { isBought: boolean; createdAt: Date; itemId: Types.ObjectId }): string {
  return `${c.isBought ? 1 : 0}|${c.createdAt.toISOString()}|${c.itemId.toString()}`;
}

function parseActiveCursor(raw: string): { isBought: boolean; createdAt: Date; itemId: Types.ObjectId } {
  const parts = raw.split('|');
  if (parts.length !== 3) throw BadRequestError('Invalid cursor');
  const [boughtStr, createdAtStr, itemIdStr] = parts;
  if (boughtStr !== '0' && boughtStr !== '1') throw BadRequestError('Invalid cursor');
  const createdAt = new Date(createdAtStr);
  if (Number.isNaN(createdAt.getTime())) throw BadRequestError('Invalid cursor');
  if (!Types.ObjectId.isValid(itemIdStr)) throw BadRequestError('Invalid cursor');
  return { isBought: boughtStr === '1', createdAt, itemId: new Types.ObjectId(itemIdStr) };
}

function encodeHistoryCursor(c: { archivedAt: Date; itemId: Types.ObjectId }): string {
  return `${c.archivedAt.toISOString()}|${c.itemId.toString()}`;
}

function parseHistoryCursor(raw: string): { archivedAt: Date; itemId: Types.ObjectId } {
  const parts = raw.split('|');
  if (parts.length !== 2) throw BadRequestError('Invalid cursor');
  const [archivedAtStr, itemIdStr] = parts;
  const archivedAt = new Date(archivedAtStr);
  if (Number.isNaN(archivedAt.getTime())) throw BadRequestError('Invalid cursor');
  if (!Types.ObjectId.isValid(itemIdStr)) throw BadRequestError('Invalid cursor');
  return { archivedAt, itemId: new Types.ObjectId(itemIdStr) };
}

class ShoppingListService {
  async addItem(
    householdId: string,
    userId: string,
    input: IAddShoppingItemInput
  ): Promise<IShoppingListItemResponse> {
    const { household } = await getHouseholdForMember(householdId, userId);

    const item = await ShoppingListItem.create({
      householdId: household._id,
      name: input.name.trim(),
      ...(input.quantity?.trim() && { quantity: input.quantity.trim() }),
      ...(input.notes?.trim() && { notes: input.notes.trim() }),
      category: input.category,
      addedByUserId: userId,
    });

    return this.formatResponse(item);
  }

  async listItems(
    householdId: string,
    userId: string,
    options: IListItemsOptions = {}
  ): Promise<IListItemsResult> {
    const { household } = await getHouseholdForMember(householdId, userId);

    const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);

    const archivedFilter = options.archived
      ? { archivedAt: { $ne: null } }
      : { archivedAt: null };

    const query: Record<string, unknown> = {
      householdId: household._id,
      ...archivedFilter,
    };

    if (options.search && options.search.trim().length > 0) {
      query.name = { $regex: escapeRegex(options.search.trim()), $options: 'i' };
    }

    if (options.categories && options.categories.length > 0) {
      query.category = { $in: options.categories };
    }

    if (options.boughtState === 'bought') {
      query.isBought = true;
    } else if (options.boughtState === 'unbought') {
      query.isBought = false;
    }

    if (options.cursor) {
      const c = parseActiveCursor(options.cursor);
      query.$or = [
        { isBought: { $gt: c.isBought } },
        { isBought: c.isBought, createdAt: { $lt: c.createdAt } },
        { isBought: c.isBought, createdAt: c.createdAt, _id: { $lt: c.itemId } },
      ];
    }

    const items = await ShoppingListItem.find(query)
      .sort({ isBought: 1, createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = items.length > limit;
    const pageItems = items.slice(0, limit);

    const memberMap = new Map<string, string>();
    for (const m of household.members) {
      memberMap.set(m._id.toString(), m.nickname);
    }

    const formatted = pageItems.map((item) => {
      const boughtByMemberId = item.boughtByMemberId?.toString();
      const boughtByNickname = boughtByMemberId
        ? memberMap.get(boughtByMemberId)
        : undefined;
      return this.formatLeanResponse(item, boughtByNickname);
    });

    let nextCursor: string | null = null;
    if (hasMore && pageItems.length > 0) {
      const last = pageItems[pageItems.length - 1];
      nextCursor = encodeActiveCursor({
        isBought: last.isBought,
        createdAt: last.createdAt,
        itemId: last._id,
      });
    }

    return { items: formatted, nextCursor };
  }

  async toggleBought(
    householdId: string,
    userId: string,
    itemId: string
  ): Promise<IShoppingListItemResponse> {
    const { household, member: requesterMember } = await getHouseholdForMember(householdId, userId);

    const item = await ShoppingListItem.findOne({ _id: itemId, householdId: household._id });
    if (!item) throw NotFoundError('Shopping list item not found');
    if (item.archivedAt) throw BadRequestError('Cannot toggle bought on an archived item');

    item.isBought = !item.isBought;
    if (item.isBought) {
      item.boughtAt = new Date();
      item.boughtByMemberId = requesterMember._id as unknown as Types.ObjectId;
    } else {
      item.boughtAt = undefined;
      item.boughtByMemberId = undefined;
    }
    await item.save();

    const boughtByNickname = item.isBought ? requesterMember.nickname : undefined;
    return this.formatResponse(item, boughtByNickname);
  }

  async updateItem(
    householdId: string,
    userId: string,
    itemId: string,
    input: IUpdateShoppingItemInput
  ): Promise<IShoppingListItemResponse> {
    const { household } = await getHouseholdForMember(householdId, userId);

    const item = await ShoppingListItem.findOne({ _id: itemId, householdId: household._id });
    if (!item) throw NotFoundError('Shopping list item not found');
    if (item.archivedAt) throw BadRequestError('Cannot update an archived item');

    if (input.name !== undefined) item.name = input.name.trim();
    if (input.quantity !== undefined) {
      const trimmed = input.quantity.trim();
      item.quantity = trimmed.length > 0 ? trimmed : undefined;
    }
    if (input.notes !== undefined) {
      const trimmed = input.notes.trim();
      item.notes = trimmed.length > 0 ? trimmed : undefined;
    }
    if (input.category !== undefined) item.category = input.category;

    await item.save();
    return this.formatResponse(item);
  }

  async deleteItem(
    householdId: string,
    userId: string,
    itemId: string
  ): Promise<void> {
    const { household } = await getHouseholdForMember(householdId, userId);

    const item = await ShoppingListItem.findOne({ _id: itemId, householdId: household._id });
    if (!item) throw NotFoundError('Shopping list item not found');

    await item.deleteOne();
  }

  async archiveItem(
    householdId: string,
    userId: string,
    itemId: string
  ): Promise<IShoppingListItemResponse> {
    const { household } = await getHouseholdForMember(householdId, userId);

    const item = await ShoppingListItem.findOne({ _id: itemId, householdId: household._id });
    if (!item) throw NotFoundError('Shopping list item not found');
    if (item.archivedAt) throw BadRequestError('Item is already archived');

    item.archivedAt = new Date();
    await item.save();

    return this.formatResponse(item);
  }

  async restoreItem(
    householdId: string,
    userId: string,
    itemId: string
  ): Promise<IShoppingListItemResponse> {
    const { household } = await getHouseholdForMember(householdId, userId);

    const item = await ShoppingListItem.findOne({ _id: itemId, householdId: household._id });
    if (!item) throw NotFoundError('Shopping list item not found');
    if (!item.archivedAt) throw BadRequestError('Item is not archived');
    if (item.archivedExpenseId) {
      throw BadRequestError('Cannot restore an item that was archived as part of an expense');
    }

    item.archivedAt = undefined;
    item.isBought = false;
    item.boughtAt = undefined;
    item.boughtByMemberId = undefined;
    await item.save();

    return this.formatResponse(item);
  }

  async archiveBought(
    householdId: string,
    userId: string,
    expenseId: string,
    dominantCategory: ExpenseType
  ): Promise<{ archivedCount: number }> {
    const { household } = await getHouseholdForMember(householdId, userId);
    await expenseService.assertExpenseInHousehold(household._id.toString(), expenseId);

    const now = new Date();
    const result = await ShoppingListItem.updateMany(
      {
        householdId: household._id,
        isBought: true,
        archivedAt: null,
      },
      {
        $set: {
          archivedAt: now,
          archivedExpenseId: new Types.ObjectId(expenseId),
          archivedDominantCategory: dominantCategory,
        },
      }
    );

    return { archivedCount: result.modifiedCount ?? 0 };
  }

  async listArchivedHistory(
    householdId: string,
    userId: string,
    options: IListHistoryOptions = {}
  ): Promise<IListHistoryResult> {
    const { household } = await getHouseholdForMember(householdId, userId);
    const limit = options.limit ?? 10;

    const archivedFilter: Record<string, unknown> = {
      householdId: household._id,
      archivedAt: { $ne: null },
    };
    if (options.cursor) {
      const c = parseHistoryCursor(options.cursor);
      archivedFilter.$or = [
        { archivedAt: { $lt: c.archivedAt } },
        { archivedAt: c.archivedAt, _id: { $lt: c.itemId } },
      ];
      // $or branches both constrain archivedAt; the outer $ne: null becomes redundant.
      delete archivedFilter.archivedAt;
    }

    if (options.search && options.search.trim().length > 0) {
      archivedFilter.name = { $regex: escapeRegex(options.search.trim()), $options: 'i' };
    }

    if (options.categories && options.categories.length > 0) {
      archivedFilter.category = { $in: options.categories };
    }

    const items = await ShoppingListItem.find(archivedFilter)
      .sort({ archivedAt: -1, _id: -1 })
      .limit(500)
      .lean();

    const memberMap = new Map<string, string>();
    for (const m of household.members) {
      memberMap.set(m._id.toString(), m.nickname);
    }

    const entries: HistoryEntry[] = [];
    const tripGroups = new Map<string, HistoryEntry & { type: 'trip' }>();

    for (const item of items) {
      const boughtByMemberId = item.boughtByMemberId?.toString();
      const boughtByNickname = boughtByMemberId ? memberMap.get(boughtByMemberId) : undefined;
      const formatted = this.formatLeanResponse(item, boughtByNickname);

      if (item.archivedExpenseId) {
        const key = item.archivedExpenseId.toString();
        if (tripGroups.has(key)) {
          tripGroups.get(key)!.items.push(formatted);
        } else {
          const tripEntry: HistoryEntry & { type: 'trip' } = {
            type: 'trip',
            archivedAt: item.archivedAt!.toISOString(),
            items: [formatted],
            expenseId: key,
            dominantCategory: (item.archivedDominantCategory ?? item.category) as ExpenseType,
          };
          tripGroups.set(key, tripEntry);
          entries.push(tripEntry);
        }
      } else {
        entries.push({
          type: 'manual',
          archivedAt: item.archivedAt!.toISOString(),
          items: [formatted],
        });
      }

      if (entries.length > limit) break;
    }

    const pageEntries = entries.slice(0, limit);
    // Conservative hasMore: if we hit the 500 fetch ceiling, signal more even if entry
    // count fits — may produce one empty next page in rare boundary cases.
    const hasMore = entries.length > limit || items.length === 500;

    let nextCursor: string | null = null;
    if (hasMore && pageEntries.length > 0) {
      const lastEntry = pageEntries[pageEntries.length - 1];
      const lastFormattedItem = lastEntry.items[lastEntry.items.length - 1];
      nextCursor = encodeHistoryCursor({
        archivedAt: new Date(lastEntry.archivedAt),
        itemId: new Types.ObjectId(lastFormattedItem._id),
      });
    }

    return { entries: pageEntries, nextCursor };
  }

  private formatResponse(
    item: IShoppingListItem,
    boughtByNickname?: string
  ): IShoppingListItemResponse {
    return {
      _id: item._id.toString(),
      householdId: item.householdId.toString(),
      name: item.name,
      ...(item.quantity && { quantity: item.quantity }),
      ...(item.notes && { notes: item.notes }),
      category: item.category,
      addedByUserId: item.addedByUserId.toString(),
      isBought: item.isBought,
      ...(item.boughtAt && { boughtAt: item.boughtAt.toISOString() }),
      ...(item.boughtByMemberId && { boughtByMemberId: item.boughtByMemberId.toString() }),
      ...(boughtByNickname && { boughtByNickname }),
      ...(item.archivedAt && { archivedAt: item.archivedAt.toISOString() }),
      ...(item.archivedExpenseId && { archivedExpenseId: item.archivedExpenseId.toString() }),
      ...(item.archivedDominantCategory && { archivedDominantCategory: item.archivedDominantCategory }),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  // Used when documents come from .lean() (plain objects, not hydrated Mongoose docs).
  private formatLeanResponse(
    item: {
      _id: Types.ObjectId;
      householdId: Types.ObjectId;
      name: string;
      quantity?: string;
      notes?: string;
      category: ExpenseType;
      addedByUserId: Types.ObjectId;
      isBought: boolean;
      boughtAt?: Date;
      boughtByMemberId?: Types.ObjectId;
      archivedAt?: Date;
      archivedExpenseId?: Types.ObjectId;
      archivedDominantCategory?: ExpenseType;
      createdAt: Date;
      updatedAt: Date;
    },
    boughtByNickname?: string
  ): IShoppingListItemResponse {
    return {
      _id: item._id.toString(),
      householdId: item.householdId.toString(),
      name: item.name,
      ...(item.quantity && { quantity: item.quantity }),
      ...(item.notes && { notes: item.notes }),
      category: item.category,
      addedByUserId: item.addedByUserId.toString(),
      isBought: item.isBought,
      ...(item.boughtAt && { boughtAt: item.boughtAt.toISOString() }),
      ...(item.boughtByMemberId && { boughtByMemberId: item.boughtByMemberId.toString() }),
      ...(boughtByNickname && { boughtByNickname }),
      ...(item.archivedAt && { archivedAt: item.archivedAt.toISOString() }),
      ...(item.archivedExpenseId && { archivedExpenseId: item.archivedExpenseId.toString() }),
      ...(item.archivedDominantCategory && { archivedDominantCategory: item.archivedDominantCategory }),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
}

export const shoppingListService = new ShoppingListService();
