import { Types } from 'mongoose';
import { RecurringShoppingItem } from '../models/recurring-shopping-item.model';
import {
  IRecurringShoppingItem,
  IRecurringShoppingItemPayload,
  IRecurringShoppingItemResponse,
  IFireRulesResult,
  RecurrenceCadence,
} from '../types/recurring-shopping-item.types';
import type { ExpenseType } from '../types/household.types';
import type { IShoppingListItemResponse } from '../types/shopping-list.types';
import { NotFoundError, ForbiddenError } from '../utils/error';
import { getHouseholdForMember } from '../utils/household.helpers';
import { ShoppingListItem } from '../models/shopping-list-item.model';
import { shoppingListService } from './shopping-list.service';
import { logger } from '../utils/logger';

/**
 * Case-insensitive "any trigger word appears as a substring of the item name".
 * Used by the dry-run preview endpoint (C6/D18) to show users which currently
 * active shopping items would match a candidate recurring rule before saving.
 *
 * NOTE: the cron path (`fireRulesForCadence`) does a stricter `name+category`
 * exact-key dedup; the preview is a forward-looking fuzzy hint, not a literal
 * dry-run of the cron's dedup check. The two are intentionally different —
 * preview helps the user pick good rule names; the cron prevents duplicates.
 */
export function matchesTriggerWords(
  itemName: string,
  triggerWords: string[]
): boolean {
  if (!itemName || triggerWords.length === 0) return false;
  const lower = itemName.toLowerCase();
  return triggerWords.some((word) => {
    const w = word.trim().toLowerCase();
    return w.length > 0 && lower.includes(w);
  });
}

class RecurringShoppingItemService {
  async createRule(
    householdId: string,
    userId: string,
    payload: IRecurringShoppingItemPayload
  ): Promise<IRecurringShoppingItemResponse> {
    const { household } = await getHouseholdForMember(householdId, userId);

    const rule = await RecurringShoppingItem.create({
      householdId: household._id,
      name: payload.name.trim(),
      category: payload.category,
      cadence: payload.cadence,
      active: payload.active ?? true,
      createdBy: userId,
    });

    return this.formatResponse(rule);
  }

  async listRules(
    householdId: string,
    userId: string
  ): Promise<{ rules: IRecurringShoppingItemResponse[] }> {
    const { household } = await getHouseholdForMember(householdId, userId);

    const rules = await RecurringShoppingItem.find({ householdId: household._id })
      .sort({ name: 1 })
      .lean();

    const formatted = rules.map((r) => this.formatLeanResponse(r));
    return { rules: formatted };
  }

  async updateRule(
    ruleId: string,
    householdId: string,
    userId: string,
    payload: Partial<IRecurringShoppingItemPayload>
  ): Promise<IRecurringShoppingItemResponse> {
    const { household, member } = await getHouseholdForMember(householdId, userId);

    const rule = await RecurringShoppingItem.findOne({
      _id: ruleId,
      householdId: household._id,
    });
    if (!rule) throw NotFoundError('Recurring shopping rule not found');

    const isAdmin = member.role === 'owner' || member.role === 'admin';
    if (rule.createdBy.toString() !== userId && !isAdmin) {
      throw ForbiddenError('You can only edit recurring shopping rules you created');
    }

    if (payload.name !== undefined) rule.name = payload.name.trim();
    if (payload.category !== undefined) rule.category = payload.category;
    if (payload.cadence !== undefined) rule.cadence = payload.cadence;
    if (payload.active !== undefined) rule.active = payload.active;

    await rule.save();
    return this.formatResponse(rule);
  }

  async deleteRule(
    ruleId: string,
    householdId: string,
    userId: string
  ): Promise<void> {
    const { household, member } = await getHouseholdForMember(householdId, userId);

    const rule = await RecurringShoppingItem.findOne({
      _id: ruleId,
      householdId: household._id,
    });
    if (!rule) throw NotFoundError('Recurring shopping rule not found');

    const isAdmin = member.role === 'owner' || member.role === 'admin';
    if (rule.createdBy.toString() !== userId && !isAdmin) {
      throw ForbiddenError('You can only delete recurring shopping rules you created');
    }

    await rule.deleteOne();
  }

  /**
   * Dry-run preview for the recurring-rule editor. Returns the subset of
   * currently active (un-archived) shopping items in this household whose
   * `name` matches any of the provided trigger words (case-insensitive
   * substring). Optional category filter narrows the candidate pool.
   *
   * Membership is enforced via getHouseholdForMember (same as other writes).
   */
  async previewMatches(
    householdId: string,
    userId: string,
    triggerWords: string[],
    category?: ExpenseType
  ): Promise<{ matchedItems: IShoppingListItemResponse[] }> {
    const { household } = await getHouseholdForMember(householdId, userId);

    const query: Record<string, unknown> = {
      householdId: household._id,
      archivedAt: null,
    };
    if (category) {
      query.category = category;
    }

    const items = await ShoppingListItem.find(query).lean();
    const matched = items.filter((item) =>
      matchesTriggerWords(item.name, triggerWords)
    );

    return {
      matchedItems: matched.map((item) => ({
        _id: item._id.toString(),
        householdId: item.householdId.toString(),
        name: item.name,
        quantity: item.quantity,
        notes: item.notes,
        category: item.category,
        addedByUserId: item.addedByUserId.toString(),
        isBought: item.isBought,
        boughtAt: item.boughtAt ? item.boughtAt.toISOString() : undefined,
        boughtByMemberId: item.boughtByMemberId
          ? item.boughtByMemberId.toString()
          : undefined,
        archivedAt: item.archivedAt ? item.archivedAt.toISOString() : undefined,
        archivedExpenseId: item.archivedExpenseId
          ? item.archivedExpenseId.toString()
          : undefined,
        archivedDominantCategory: item.archivedDominantCategory,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
    };
  }

  async fireRulesForCadence(cadence: RecurrenceCadence): Promise<IFireRulesResult> {
    const rules = await RecurringShoppingItem.find({ active: true, cadence }).lean();
    if (rules.length === 0) return { created: 0, skipped: 0 };

    const householdIds = [...new Set(rules.map((r) => r.householdId.toString()))];

    const activeItems = await ShoppingListItem.find({
      householdId: { $in: householdIds.map((id) => new Types.ObjectId(id)) },
      archivedAt: null,
    })
      .select({ householdId: 1, name: 1, category: 1 })
      .lean();

    const existingByHousehold = new Map<string, Set<string>>();
    for (const item of activeItems) {
      const hid = item.householdId.toString();
      const key = `${item.name.toLowerCase()}||${item.category}`;
      if (!existingByHousehold.has(hid)) existingByHousehold.set(hid, new Set());
      existingByHousehold.get(hid)!.add(key);
    }

    let created = 0;
    let skipped = 0;
    for (const rule of rules) {
      const hid = rule.householdId.toString();
      const key = `${rule.name.toLowerCase()}||${rule.category}`;
      if (existingByHousehold.get(hid)?.has(key)) {
        skipped++;
        continue;
      }
      // Don't let a single bad rule (e.g. household deleted) abort the whole sweep.
      try {
        await shoppingListService.addItem(hid, rule.createdBy.toString(), {
          name: rule.name,
          category: rule.category,
        });
        if (!existingByHousehold.has(hid)) existingByHousehold.set(hid, new Set());
        existingByHousehold.get(hid)!.add(key);
        created++;
      } catch (err) {
        logger.error(
          { err, ruleId: rule._id.toString(), cadence },
          '[RecurringShoppingItem] Failed to materialize rule'
        );
      }
    }

    return { created, skipped };
  }

  private formatResponse(rule: IRecurringShoppingItem): IRecurringShoppingItemResponse {
    return {
      _id: rule._id.toString(),
      householdId: rule.householdId.toString(),
      name: rule.name,
      category: rule.category,
      cadence: rule.cadence,
      active: rule.active,
      createdBy: rule.createdBy.toString(),
      createdAt: rule.createdAt.toISOString(),
      updatedAt: rule.updatedAt.toISOString(),
    };
  }

  private formatLeanResponse(rule: {
    _id: Types.ObjectId;
    householdId: Types.ObjectId;
    name: string;
    category: IRecurringShoppingItem['category'];
    cadence: RecurrenceCadence;
    active: boolean;
    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
  }): IRecurringShoppingItemResponse {
    return {
      _id: rule._id.toString(),
      householdId: rule.householdId.toString(),
      name: rule.name,
      category: rule.category,
      cadence: rule.cadence,
      active: rule.active,
      createdBy: rule.createdBy.toString(),
      createdAt: rule.createdAt.toISOString(),
      updatedAt: rule.updatedAt.toISOString(),
    };
  }
}

export const recurringShoppingItemService = new RecurringShoppingItemService();

// Re-export the result type so the scheduler can import it from one place.
export type { IFireRulesResult };
