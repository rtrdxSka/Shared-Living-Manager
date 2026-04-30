import { Schema, model } from 'mongoose';
import { IShoppingListItem } from '../types/shopping-list.types';

const EXPENSE_TYPE_VALUES = [
  'rent',
  'utilities',
  'internet',
  'groceries',
  'cleaning',
  'subscriptions',
  'other',
] as const;

const shoppingListItemSchema = new Schema<IShoppingListItem>(
  {
    householdId: { type: Schema.Types.ObjectId, ref: 'Household', required: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
    quantity: { type: String, trim: true, maxlength: 50, default: undefined },
    notes: { type: String, trim: true, maxlength: 500, default: undefined },
    category: {
      type: String,
      enum: EXPENSE_TYPE_VALUES,
      required: true,
      default: 'groceries',
    },
    addedByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isBought: { type: Boolean, default: false },
    boughtAt: { type: Date, default: undefined },
    boughtByMemberId: { type: Schema.Types.ObjectId, default: undefined },
    archivedAt: { type: Date, default: undefined },
    archivedExpenseId: { type: Schema.Types.ObjectId, ref: 'Expense', default: undefined },
    archivedDominantCategory: {
      type: String,
      enum: EXPENSE_TYPE_VALUES,
      default: undefined,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

shoppingListItemSchema.index({ householdId: 1, isBought: 1, createdAt: -1 });
shoppingListItemSchema.index({ _id: 1, householdId: 1 });
shoppingListItemSchema.index({ householdId: 1, archivedAt: -1 });

export const ShoppingListItem = model<IShoppingListItem>('ShoppingListItem', shoppingListItemSchema);
