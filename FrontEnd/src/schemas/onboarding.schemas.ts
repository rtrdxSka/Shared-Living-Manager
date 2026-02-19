import { z } from 'zod';
import {
  LIVING_ARRANGEMENTS,
  RELATIONSHIPS,
  AGE_GROUPS,
  EXPENSE_SPLIT_METHODS,
  EXPENSE_TYPES,
  CURRENCIES,
  TASK_MANAGEMENT_LEVELS,
  TASK_DISTRIBUTION_METHODS,
  getAvailableSplitMethods,
  getAvailableDistributionMethods,
  shouldSkipMemberStep,
  shouldShowSplitMethod,
  shouldShowDistributionMethod,
} from '@/types/onboarding.types';

// ── Step 1: Living Arrangement ────────────────────────────────────────

export const stepLivingArrangementSchema = z
  .object({
    householdName: z
      .string()
      .trim()
      .min(2, { message: 'Household name must be at least 2 characters' })
      .max(50, { message: 'Household name cannot exceed 50 characters' }),

    totalMembers: z
      .number({ message: 'Number of members is required' })
      .int({ message: 'Must be a whole number' })
      .min(1, { message: 'Must have at least 1 member' })
      .max(20, { message: 'Cannot exceed 20 members' }),

    livingArrangement: z.enum(LIVING_ARRANGEMENTS, {
      message: 'Please select a living arrangement',
    }),

    livingArrangementOther: z.string().max(100),
  })
  .superRefine((data, ctx) => {
    // 'Other' requires a description
    if (
      data.livingArrangement === 'other' &&
      data.livingArrangementOther.trim().length === 0
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Please describe your living arrangement',
        path: ['livingArrangementOther'],
      });
    }

    // totalMembers must be consistent with livingArrangement
    const { livingArrangement, totalMembers } = data;

    switch (livingArrangement) {
      case 'alone':
        if (totalMembers !== 1) {
          ctx.addIssue({
            code: 'custom',
            message: 'Living alone means exactly 1 member',
            path: ['totalMembers'],
          });
        }
        break;

      case 'couple':
        if (totalMembers !== 2) {
          ctx.addIssue({
            code: 'custom',
            message: 'A couple household must have exactly 2 members',
            path: ['totalMembers'],
          });
        }
        break;

      case 'family':
      case 'roommates':
        if (totalMembers < 2) {
          ctx.addIssue({
            code: 'custom',
            message: 'Must have at least 2 members for this arrangement',
            path: ['totalMembers'],
          });
        }
        break;

      case 'multi_family':
        if (totalMembers < 3) {
          ctx.addIssue({
            code: 'custom',
            message:
              'Multiple families require at least 3 members',
            path: ['totalMembers'],
          });
        }
        break;
    }
  });

export type StepLivingArrangementData = z.infer<
  typeof stepLivingArrangementSchema
>;

// ── Member structure entry ────────────────────────────────────────────

export const memberStructureEntrySchema = z.object({
  nickname: z
    .string()
    .trim()
    .min(1, { message: 'Nickname is required' })
    .max(30, { message: 'Nickname cannot exceed 30 characters' }),

  relationship: z.enum(RELATIONSHIPS, {
    message: 'Please select a relationship',
  }),

  ageGroup: z.enum(AGE_GROUPS, {
    message: 'Please select an age group',
  }),

  participatesInFinances: z.boolean(),
  participatesInTasks: z.boolean(),
  familyGroup: z.string().max(50).optional(),
});

// ── Step 2: Household Structure ───────────────────────────────────────
//
// Validated with context from Step 1 (livingArrangement, totalMembers).
// This schema validates the member array in isolation.
// Cross-step validation (correct count, familyGroup requirement) is
// handled by createStepHouseholdStructureSchema().

export const baseStepHouseholdStructureSchema = z.object({
  memberStructure: z.array(memberStructureEntrySchema),
});

/**
 * Creates a contextual schema for Step 2 based on Step 1 data.
 * - Enforces correct member count (totalMembers - 1)
 * - Requires familyGroup when arrangement is 'multi_family'
 * - Auto-sets participatesInFinances to false for children
 */
export function createStepHouseholdStructureSchema(
  livingArrangement: string,
  totalMembers: number
) {
  // If step is skipped, allow empty array
  if (shouldSkipMemberStep(livingArrangement as never)) {
    return z.object({
      memberStructure: z.array(memberStructureEntrySchema).length(0),
    });
  }

  const expectedCount = totalMembers - 1;

  return z
    .object({
      memberStructure: z
        .array(memberStructureEntrySchema)
        .length(expectedCount, {
          message: `You need to define exactly ${expectedCount} member${expectedCount !== 1 ? 's' : ''}`,
        }),
    })
    .superRefine((data, ctx) => {
      data.memberStructure.forEach((member, index) => {
        // Require familyGroup for multi_family
        if (
          livingArrangement === 'multi_family' &&
          (!member.familyGroup || member.familyGroup.trim().length === 0)
        ) {
          ctx.addIssue({
            code: "custom",
            message: 'Family group is required for multi-family households',
            path: ['memberStructure', index, 'familyGroup'],
          });
        }

        // Children cannot participate in finances
        if (
          member.ageGroup === 'child' &&
          member.participatesInFinances === true
        ) {
          ctx.addIssue({
            code: "custom",
            message: 'Children cannot participate in finances',
            path: ['memberStructure', index, 'participatesInFinances'],
          });
        }
      });
    });
}

export type StepHouseholdStructureData = z.infer<
  typeof baseStepHouseholdStructureSchema
>;

// ── Step 3: Financial Preferences ─────────────────────────────────────

export const baseStepFinancialPreferencesSchema = z.object({
  expenseSplitMethod: z
    .enum(EXPENSE_SPLIT_METHODS)
    .or(z.literal(''))
    .default(''),

  trackedExpenseTypes: z
    .array(z.enum(EXPENSE_TYPES))
    .min(1, { message: 'Select at least one expense type' }),

  currency: z.enum(CURRENCIES, {
    message: 'Please select a currency',
  }),
});

/**
 * Creates a contextual schema for Step 3 based on Step 1 data.
 * - Skips split method validation for 'alone'
 * - Restricts available split methods per arrangement
 */
export function createStepFinancialPreferencesSchema(
  livingArrangement: string
) {
  if (!shouldShowSplitMethod(livingArrangement as never)) {
    // Solo mode: split method not needed
    return z.object({
      expenseSplitMethod: z.literal('').or(z.enum(EXPENSE_SPLIT_METHODS)),
      trackedExpenseTypes: z
        .array(z.enum(EXPENSE_TYPES))
        .min(1, { message: 'Select at least one expense type' }),
      currency: z.enum(CURRENCIES, {
        message: 'Please select a currency',
      }),
    });
  }

  const availableMethods = getAvailableSplitMethods(
    livingArrangement as never
  );

  return z.object({
    expenseSplitMethod: z
      .enum(EXPENSE_SPLIT_METHODS, {
        message: 'Please select a split method',
      })
      .refine((val) => availableMethods.includes(val), {
        message: 'This split method is not available for your arrangement',
      }),

    trackedExpenseTypes: z
      .array(z.enum(EXPENSE_TYPES))
      .min(1, { message: 'Select at least one expense type' }),

    currency: z.enum(CURRENCIES, {
      message: 'Please select a currency',
    }),
  });
}

export type StepFinancialPreferencesData = z.infer<
  typeof baseStepFinancialPreferencesSchema
>;

// ── Step 4: Task Preferences ──────────────────────────────────────────

export const baseStepTaskPreferencesSchema = z.object({
  taskManagementEnabled: z.enum(TASK_MANAGEMENT_LEVELS, {
    message: 'Please select a task management level',
  }),

  taskDistributionMethod: z
    .enum(TASK_DISTRIBUTION_METHODS)
    .or(z.literal(''))
    .default(''),
});

/**
 * Creates a contextual schema for Step 4 based on Step 1 data.
 * - Requires distribution method when tasks are enabled and not alone
 * - Restricts available distribution methods per arrangement
 */
export function createStepTaskPreferencesSchema(livingArrangement: string) {
  return z
    .object({
      taskManagementEnabled: z.enum(TASK_MANAGEMENT_LEVELS, {
        message: 'Please select a task management level',
      }),

      taskDistributionMethod: z
        .enum(TASK_DISTRIBUTION_METHODS)
        .or(z.literal(''))
        .default(''),
    })
    .superRefine((data, ctx) => {
      const needsDistribution = shouldShowDistributionMethod(
        livingArrangement as never,
        data.taskManagementEnabled
      );

      if (needsDistribution) {
        if (!data.taskDistributionMethod) {
          ctx.addIssue({
            code: "custom",
            message: 'Please select a task distribution method',
            path: ['taskDistributionMethod'],
          });
          return;
        }

        const available = getAvailableDistributionMethods(
          livingArrangement as never
        );
        if (!available.includes(data.taskDistributionMethod as never)) {
          ctx.addIssue({
            code: "custom",
            message:
              'This distribution method is not available for your arrangement',
            path: ['taskDistributionMethod'],
          });
        }
      }
    });
}

export type StepTaskPreferencesData = z.infer<
  typeof baseStepTaskPreferencesSchema
>;

// ── Full survey schema (for final submission) ─────────────────────────

export const onboardingSurveySchema = z
  .object({
    // Step 1
    householdName: z
      .string()
      .trim()
      .min(2, { message: 'Household name must be at least 2 characters' })
      .max(50, { message: 'Household name cannot exceed 50 characters' }),
    totalMembers: z
      .number()
      .int()
      .min(1, { message: 'Must have at least 1 member' })
      .max(20, { message: 'Cannot exceed 20 members' }),
    livingArrangement: z.enum(LIVING_ARRANGEMENTS),
    livingArrangementOther: z.string().max(100).optional(),

    // Step 2
    memberStructure: z.array(memberStructureEntrySchema),

    // Step 3
    expenseSplitMethod: z.enum(EXPENSE_SPLIT_METHODS).optional(),
    trackedExpenseTypes: z.array(z.enum(EXPENSE_TYPES)).min(1),
    currency: z.enum(CURRENCIES),

    // Step 4
    taskManagementEnabled: z.enum(TASK_MANAGEMENT_LEVELS),
    taskDistributionMethod: z.enum(TASK_DISTRIBUTION_METHODS).optional(),
  })
  .superRefine((data, ctx) => {
    // Validate 'other' description
    if (
      data.livingArrangement === 'other' &&
      (!data.livingArrangementOther ||
        data.livingArrangementOther.trim().length === 0)
    ) {
      ctx.addIssue({
        code: "custom",
        message: 'Please describe your living arrangement',
        path: ['livingArrangementOther'],
      });
    }

    // Validate member count constraints per arrangement
    const { livingArrangement, totalMembers } = data;

    switch (livingArrangement) {
      case 'alone':
        if (totalMembers !== 1) {
          ctx.addIssue({
            code: 'custom',
            message: 'Living alone means exactly 1 member',
            path: ['totalMembers'],
          });
        }
        break;
      case 'couple':
        if (totalMembers !== 2) {
          ctx.addIssue({
            code: 'custom',
            message: 'A couple household must have exactly 2 members',
            path: ['totalMembers'],
          });
        }
        break;
      case 'family':
      case 'roommates':
        if (totalMembers < 2) {
          ctx.addIssue({
            code: 'custom',
            message: 'Must have at least 2 members for this arrangement',
            path: ['totalMembers'],
          });
        }
        break;
      case 'multi_family':
        if (totalMembers < 3) {
          ctx.addIssue({
            code: 'custom',
            message: 'Multiple families require at least 3 members',
            path: ['totalMembers'],
          });
        }
        break;
    }

    // Validate member structure count
    const isAlone = livingArrangement === 'alone';
    const expectedMembers = isAlone ? 0 : totalMembers - 1;
    if (data.memberStructure.length !== expectedMembers) {
      ctx.addIssue({
        code: "custom",
        message: `Expected ${expectedMembers} members, got ${data.memberStructure.length}`,
        path: ['memberStructure'],
      });
    }

    // Validate split method requirement
    if (
      shouldShowSplitMethod(livingArrangement) &&
      !data.expenseSplitMethod
    ) {
      ctx.addIssue({
        code: "custom",
        message: 'Please select a split method',
        path: ['expenseSplitMethod'],
      });
    }

    // Validate distribution method requirement
    if (
      shouldShowDistributionMethod(
        livingArrangement,
        data.taskManagementEnabled
      ) &&
      !data.taskDistributionMethod
    ) {
      ctx.addIssue({
        code: "custom",
        message: 'Please select a task distribution method',
        path: ['taskDistributionMethod'],
      });
    }

    // Validate familyGroup for multi_family
    if (livingArrangement === 'multi_family') {
      data.memberStructure.forEach((member, index) => {
        if (!member.familyGroup || member.familyGroup.trim().length === 0) {
          ctx.addIssue({
            code: "custom",
            message: 'Family group is required for multi-family households',
            path: ['memberStructure', index, 'familyGroup'],
          });
        }
      });
    }
  });

export type OnboardingSurveyFormData = z.infer<typeof onboardingSurveySchema>;