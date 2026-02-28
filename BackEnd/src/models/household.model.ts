import mongoose, { Schema } from 'mongoose';
import crypto from 'crypto';
import {
  IHousehold,
  LIVING_ARRANGEMENTS,
  RELATIONSHIPS,
  AGE_GROUPS,
  FINANCE_MODES,
  EXPENSE_SPLIT_METHODS,
  EXPENSE_TYPES,
  TASK_MANAGEMENT_LEVELS,
  TASK_DISTRIBUTION_METHODS,
  UI_MODES,
  CURRENCIES,
  HOUSEHOLD_ROLES,
} from '../types/household.types';

// ── Member subdocument schema ─────────────────────────────────────────

const memberSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: undefined,
    },
    nickname: {
      type: String,
      required: [true, 'Nickname is required'],
      trim: true,
      maxlength: [30, 'Nickname cannot exceed 30 characters'],
    },
    relationship: {
      type: String,
      enum: {
        values: RELATIONSHIPS,
        message: 'Invalid relationship type',
      },
      default: undefined,
    },
    ageGroup: {
      type: String,
      required: [true, 'Age group is required'],
      enum: {
        values: AGE_GROUPS,
        message: 'Invalid age group',
      },
    },
    role: {
      type: String,
      required: [true, 'Role is required'],
      enum: {
        values: HOUSEHOLD_ROLES,
        message: 'Invalid role',
      },
      default: 'member',
    },
    participatesInFinances: {
      type: Boolean,
      required: [true, 'Financial participation must be specified'],
    },
    participatesInTasks: {
      type: Boolean,
      required: [true, 'Task participation must be specified'],
    },
    familyGroup: {
      type: String,
      trim: true,
      maxlength: [50, 'Family group name cannot exceed 50 characters'],
      default: undefined,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: [254, 'Email cannot exceed 254 characters'],
      default: undefined,
    },
    isCreator: {
      type: Boolean,
      required: true,
      default: false,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    monthlyIncome: {
      type: Number,
      min: [0, 'Income cannot be negative'],
      default: undefined,
    },
  },
  { _id: true }
);

// ── Settings subdocument schema ───────────────────────────────────────

const settingsSchema = new Schema(
  {
    financeMode: {
      type: String,
      enum: {
        values: FINANCE_MODES,
        message: 'Invalid finance mode',
      },
      default: undefined,
    },
    expenseSplitMethod: {
      type: String,
      enum: {
        values: EXPENSE_SPLIT_METHODS,
        message: 'Invalid expense split method',
      },
      default: undefined,
    },
    trackedExpenseTypes: [
      {
        type: String,
        enum: {
          values: EXPENSE_TYPES,
          message: 'Invalid expense type',
        },
      },
    ],
    currency: {
      type: String,
      required: [true, 'Currency is required'],
      enum: {
        values: CURRENCIES,
        message: 'Invalid currency',
      },
    },
    taskManagementEnabled: {
      type: String,
      required: [true, 'Task management level is required'],
      enum: {
        values: TASK_MANAGEMENT_LEVELS,
        message: 'Invalid task management level',
      },
    },
    taskDistributionMethod: {
      type: String,
      enum: {
        values: TASK_DISTRIBUTION_METHODS,
        message: 'Invalid task distribution method',
      },
      default: undefined,
    },
  },
  { _id: false }
);

// ── Main household schema ─────────────────────────────────────────────

const householdSchema = new Schema<IHousehold>(
  {
    name: {
      type: String,
      required: [true, 'Household name is required'],
      trim: true,
      minlength: [2, 'Household name must be at least 2 characters'],
      maxlength: [50, 'Household name cannot exceed 50 characters'],
    },
    livingArrangement: {
      type: String,
      required: [true, 'Living arrangement is required'],
      enum: {
        values: LIVING_ARRANGEMENTS,
        message: 'Invalid living arrangement',
      },
    },
    livingArrangementOther: {
      type: String,
      trim: true,
      maxlength: [100, 'Description cannot exceed 100 characters'],
      default: undefined,
    },
    totalMembers: {
      type: Number,
      required: [true, 'Total members is required'],
      min: [1, 'Must have at least 1 member'],
      max: [20, 'Cannot exceed 20 members'],
    },
    uiMode: {
      type: String,
      required: [true, 'UI mode is required'],
      enum: {
        values: UI_MODES,
        message: 'Invalid UI mode',
      },
    },
    members: [memberSchema],
    settings: {
      type: settingsSchema,
      required: [true, 'Settings are required'],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator is required'],
    },
    inviteCode: {
      type: String,
      unique: true,
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

// ── Indexes ───────────────────────────────────────────────────────────

householdSchema.index({ createdBy: 1 });
householdSchema.index({ inviteCode: 1 }, { unique: true });
householdSchema.index({ 'members.userId': 1 });

// ── Pre-save: generate invite code ────────────────────────────────────

householdSchema.pre('save', function () {
  if (!this.inviteCode) {
    this.inviteCode = crypto.randomUUID();
  }
});

export const Household = mongoose.model<IHousehold>('Household', householdSchema);
