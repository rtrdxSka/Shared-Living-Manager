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
  IListHistoryOptions,
} from '../types/shopping-list.types';
import { escapeRegex } from '../utils/regex';
import { ExpenseType } from '../types/household.types';
import { NotFoundError, BadRequestError } from '../utils/error';
import { getHouseholdForMember } from '../utils/household.helpers';

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
  ): Promise<{ items: IShoppingListItemResponse[] }> {
    const { household } = await getHouseholdForMember(householdId, userId);

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
    // 'all' (or undefined) → no isBought filter.

    const items = await ShoppingListItem.find(query)
      .sort({ isBought: 1, createdAt: -1 })
      .lean();

    const memberMap = new Map<string, string>();
    for (const m of household.members) {
      memberMap.set(m._id.toString(), m.nickname);
    }

    const formatted = items.map((item) => {
      const boughtByMemberId = item.boughtByMemberId?.toString();
      const boughtByNickname = boughtByMemberId
        ? memberMap.get(boughtByMemberId)
        : undefined;
      return this.formatLeanResponse(item, boughtByNickname);
    });

    return { items: formatted };
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
      archivedFilter.archivedAt = { $ne: null, $lt: new Date(options.cursor) };
    }

    if (options.search && options.search.trim().length > 0) {
      archivedFilter.name = { $regex: escapeRegex(options.search.trim()), $options: 'i' };
    }

    if (options.categories && options.categories.length > 0) {
      archivedFilter.category = { $in: options.categories };
    }

    const items = await ShoppingListItem.find(archivedFilter)
      .sort({ archivedAt: -1 })
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
    const hasMore = entries.length > limit;
    const nextCursor = hasMore ? pageEntries[pageEntries.length - 1].archivedAt : null;

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
