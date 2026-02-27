import { body, param, ValidationChain } from 'express-validator';
import {
  LIVING_ARRANGEMENTS,
  RELATIONSHIPS,
  AGE_GROUPS,
  EXPENSE_SPLIT_METHODS,
  EXPENSE_TYPES,
  TASK_MANAGEMENT_LEVELS,
  TASK_DISTRIBUTION_METHODS,
  CURRENCIES,
  LivingArrangement,
  TaskManagementLevel,
  AgeGroup,
} from '../types/household.types';

export const createHouseholdValidation: ValidationChain[] = [
  // ── Step 1: Living Arrangement ────────────────────────────────────────

  body('householdName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Household name must be between 2 and 50 characters'),

  body('totalMembers')
    .isInt({ min: 1, max: 20 })
    .withMessage('Total members must be between 1 and 20'),

  body('livingArrangement')
    .isIn([...LIVING_ARRANGEMENTS])
    .withMessage('Invalid living arrangement'),

  body('livingArrangementOther')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Description cannot exceed 100 characters'),

  // ── Step 2: Creator Profile ───────────────────────────────────────────

  body('creatorProfile.nickname')
    .trim()
    .isLength({ min: 1, max: 30 })
    .withMessage('Nickname must be between 1 and 30 characters'),

  body('creatorProfile.ageGroup')
    .isIn([...AGE_GROUPS])
    .withMessage('Invalid age group'),

  body('creatorProfile.participatesInFinances')
    .isBoolean()
    .withMessage('Financial participation must be a boolean'),

  body('creatorProfile.participatesInTasks')
    .isBoolean()
    .withMessage('Task participation must be a boolean'),

  body('creatorProfile.familyGroup')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Family group cannot exceed 50 characters'),

  // ── Step 2: Member Structure ──────────────────────────────────────────

  body('memberStructure')
    .isArray()
    .withMessage('Member structure must be an array'),

  body('memberStructure.*.nickname')
    .trim()
    .isLength({ min: 1, max: 30 })
    .withMessage('Member nickname must be between 1 and 30 characters'),

  body('memberStructure.*.relationship')
    .isIn([...RELATIONSHIPS])
    .withMessage('Invalid relationship type'),

  body('memberStructure.*.ageGroup')
    .isIn([...AGE_GROUPS])
    .withMessage('Invalid age group'),

  body('memberStructure.*.participatesInFinances')
    .isBoolean()
    .withMessage('Financial participation must be a boolean'),

  body('memberStructure.*.participatesInTasks')
    .isBoolean()
    .withMessage('Task participation must be a boolean'),

  body('memberStructure.*.familyGroup')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Family group cannot exceed 50 characters'),

  body('memberStructure.*.email')
    .trim()
    .toLowerCase()
    .isEmail()
    .withMessage('A valid email address is required')
    .isLength({ max: 254 })
    .withMessage('Email cannot exceed 254 characters'),

  // ── Step 3: Financial Preferences ─────────────────────────────────────

  body('expenseSplitMethod')
    .optional()
    .isIn([...EXPENSE_SPLIT_METHODS])
    .withMessage('Invalid expense split method'),

  body('trackedExpenseTypes')
    .isArray({ min: 1 })
    .withMessage('At least one expense type must be tracked'),

  body('trackedExpenseTypes.*')
    .isIn([...EXPENSE_TYPES])
    .withMessage('Invalid expense type'),

  body('currency')
    .isIn([...CURRENCIES])
    .withMessage('Invalid currency'),

  // ── Step 4: Task Preferences ──────────────────────────────────────────

  body('taskManagementEnabled')
    .isIn([...TASK_MANAGEMENT_LEVELS])
    .withMessage('Invalid task management level'),

  body('taskDistributionMethod')
    .optional()
    .isIn([...TASK_DISTRIBUTION_METHODS])
    .withMessage('Invalid task distribution method'),

  // ── Cross-field validations ───────────────────────────────────────────

  body('totalMembers').custom((value: number, { req }) => {
    const arrangement = req.body.livingArrangement as LivingArrangement;
    const members = req.body.memberStructure as unknown[];

    switch (arrangement) {
      case 'alone':
        if (value !== 1) throw new Error('Living alone requires exactly 1 member');
        if (members && members.length !== 0)
          throw new Error('Living alone cannot have additional members');
        break;
      case 'couple':
        if (value !== 2) throw new Error('Couple arrangement requires exactly 2 members');
        break;
      case 'family':
      case 'roommates':
        if (value < 2) throw new Error('This arrangement requires at least 2 members');
        break;
      case 'multi_family':
        if (value < 3) throw new Error('Multi-family arrangement requires at least 3 members');
        break;
    }

    return true;
  }),

  body('memberStructure').custom((value: unknown[], { req }) => {
    const arrangement = req.body.livingArrangement as LivingArrangement;
    const totalMembers = req.body.totalMembers as number;

    if (arrangement === 'alone') {
      if (value.length !== 0)
        throw new Error('Living alone cannot have additional members');
    } else {
      if (value.length !== totalMembers - 1)
        throw new Error('Member count must match total members minus the creator');
    }

    return true;
  }),

  body('livingArrangementOther').custom((value: string | undefined, { req }) => {
    const arrangement = req.body.livingArrangement as LivingArrangement;
    if (arrangement === 'other' && (!value || value.trim().length === 0)) {
      throw new Error('Description is required for "other" arrangement');
    }
    return true;
  }),

  body('memberStructure').custom((members: Array<{ ageGroup: AgeGroup; participatesInFinances: boolean }>) => {
    for (const member of members) {
      if (
        (member.ageGroup === 'child' || member.ageGroup === 'teenager') &&
        member.participatesInFinances
      ) {
        throw new Error('Children and teenagers cannot participate in finances');
      }
    }
    return true;
  }),

  body('creatorProfile').custom((creator: { ageGroup: AgeGroup; participatesInFinances: boolean }) => {
    if (
      (creator.ageGroup === 'child' || creator.ageGroup === 'teenager') &&
      creator.participatesInFinances
    ) {
      throw new Error('Children and teenagers cannot participate in finances');
    }
    return true;
  }),

  body('creatorProfile.familyGroup').custom((value: string | undefined, { req }) => {
    const arrangement = req.body.livingArrangement as LivingArrangement;
    if (arrangement === 'multi_family' && (!value || value.trim().length === 0)) {
      throw new Error('Family group is required for multi-family arrangement');
    }
    return true;
  }),

  body('memberStructure').custom((members: Array<{ familyGroup?: string }>, { req }) => {
    const arrangement = req.body.livingArrangement as LivingArrangement;
    if (arrangement === 'multi_family') {
      for (const member of members) {
        if (!member.familyGroup || member.familyGroup.trim().length === 0) {
          throw new Error('Family group is required for all members in multi-family arrangement');
        }
      }
    }
    return true;
  }),

  body('expenseSplitMethod').custom((value: string | undefined, { req }) => {
    const arrangement = req.body.livingArrangement as LivingArrangement;
    if (arrangement !== 'alone' && !value) {
      throw new Error('Expense split method is required for shared households');
    }
    return true;
  }),

  body('taskDistributionMethod').custom((value: string | undefined, { req }) => {
    const arrangement = req.body.livingArrangement as LivingArrangement;
    const taskLevel = req.body.taskManagementEnabled as TaskManagementLevel;
    if (arrangement !== 'alone' && taskLevel !== 'disabled' && !value) {
      throw new Error('Task distribution method is required when task management is enabled');
    }
    return true;
  }),

  body('memberStructure').custom((members: Array<{ nickname: string }>, { req }) => {
    const creatorNickname = (req.body.creatorProfile as { nickname: string })?.nickname;
    const allNicknames = [
      creatorNickname,
      ...members.map((m) => m.nickname),
    ]
      .filter(Boolean)
      .map((n) => n.trim().toLowerCase());

    const seen = new Set<string>();
    for (const nick of allNicknames) {
      if (seen.has(nick)) {
        throw new Error('All nicknames must be unique within the household');
      }
      seen.add(nick);
    }

    return true;
  }),

  body('memberStructure').custom((members: Array<{ email: string }>, { req }) => {
    const creatorEmail = (req as { user?: { email: string } }).user?.email?.trim().toLowerCase();
    const emails = members
      .map((m) => m.email)
      .filter(Boolean)
      .map((e) => e.trim().toLowerCase());

    const seen = new Set<string>();
    if (creatorEmail) {
      seen.add(creatorEmail);
    }

    for (const email of emails) {
      if (seen.has(email)) {
        throw new Error('Each member must have a unique email address');
      }
      seen.add(email);
    }

    return true;
  }),
];

// ── Get Household by ID Validation ────────────────────────────────────

export const getHouseholdByIdValidation: ValidationChain[] = [
  param('id')
    .isMongoId()
    .withMessage('Invalid household ID'),
];

// ── Join Household Validation ─────────────────────────────────────────

export const joinHouseholdValidation: ValidationChain[] = [
  body('inviteCode')
    .trim()
    .notEmpty()
    .withMessage('Invite code is required')
    .isUUID()
    .withMessage('Invalid invite code format'),
];
