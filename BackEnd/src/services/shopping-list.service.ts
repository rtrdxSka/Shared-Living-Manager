import { Types } from 'mongoose';
import { ShoppingListItem } from '../models/shopping-list-item.model';
import {
  IShoppingListItem,
  IAddShoppingItemInput,
  IShoppingListItemResponse,
} from '../types/shopping-list.types';
import { NotFoundError } from '../utils/error';
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
      addedByUserId: userId,
    });

    return this.formatResponse(item);
  }

  async listItems(
    householdId: string,
    userId: string
  ): Promise<{ items: IShoppingListItemResponse[] }> {
    const { household } = await getHouseholdForMember(householdId, userId);

    const items = await ShoppingListItem.find({ householdId: household._id })
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

  async clearBought(
    householdId: string,
    userId: string
  ): Promise<{ deletedCount: number }> {
    const { household } = await getHouseholdForMember(householdId, userId);

    const result = await ShoppingListItem.deleteMany({
      householdId: household._id,
      isBought: true,
    });

    return { deletedCount: result.deletedCount ?? 0 };
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
      addedByUserId: item.addedByUserId.toString(),
      isBought: item.isBought,
      ...(item.boughtAt && { boughtAt: item.boughtAt.toISOString() }),
      ...(item.boughtByMemberId && { boughtByMemberId: item.boughtByMemberId.toString() }),
      ...(boughtByNickname && { boughtByNickname }),
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
      addedByUserId: Types.ObjectId;
      isBought: boolean;
      boughtAt?: Date;
      boughtByMemberId?: Types.ObjectId;
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
      addedByUserId: item.addedByUserId.toString(),
      isBought: item.isBought,
      ...(item.boughtAt && { boughtAt: item.boughtAt.toISOString() }),
      ...(item.boughtByMemberId && { boughtByMemberId: item.boughtByMemberId.toString() }),
      ...(boughtByNickname && { boughtByNickname }),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
}

export const shoppingListService = new ShoppingListService();
