import { Types } from 'mongoose';
import { RecurringShoppingItem } from '../models/recurring-shopping-item.model';
import {
  IRecurringShoppingItem,
  IRecurringShoppingItemPayload,
  IRecurringShoppingItemResponse,
  IFireRulesResult,
  RecurrenceCadence,
} from '../types/recurring-shopping-item.types';
import { NotFoundError } from '../utils/error';
import { getHouseholdForMember } from '../utils/household.helpers';
import { ShoppingListItem } from '../models/shopping-list-item.model';
import { shoppingListService } from './shopping-list.service';
import { logger } from '../utils/logger';

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
    const { household } = await getHouseholdForMember(householdId, userId);

    const rule = await RecurringShoppingItem.findOne({
      _id: ruleId,
      householdId: household._id,
    });
    if (!rule) throw NotFoundError('Recurring shopping rule not found');

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
    const { household } = await getHouseholdForMember(householdId, userId);

    const rule = await RecurringShoppingItem.findOne({
      _id: ruleId,
      householdId: household._id,
    });
    if (!rule) throw NotFoundError('Recurring shopping rule not found');

    await rule.deleteOne();
  }

  async fireRulesForCadence(cadence: RecurrenceCadence): Promise<IFireRulesResult> {
    const rules = await RecurringShoppingItem.find({ active: true, cadence }).lean();

    let created = 0;
    let skipped = 0;

    for (const rule of rules) {
      // Case-insensitive name + same category + active (not archived) match in the same household.
      const existing = await ShoppingListItem.findOne({
        householdId: rule.householdId,
        archivedAt: { $exists: false },
        name: rule.name,
        category: rule.category,
      })
        .collation({ locale: 'en', strength: 2 })
        .lean();

      if (existing) {
        skipped++;
        continue;
      }

      try {
        await shoppingListService.addItem(
          rule.householdId.toString(),
          rule.createdBy.toString(),
          { name: rule.name, category: rule.category }
        );
        created++;
      } catch (err) {
        // Don't let a single bad rule (e.g. household deleted) abort the whole sweep.
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
