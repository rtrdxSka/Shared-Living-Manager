import { Types } from 'mongoose';
import { Budget } from '../models/budget.model';
import { BudgetSnapshot } from '../models/budget-snapshot.model';
import { Expense } from '../models/expense.model';
import {
  IBudget,
  IBudgetCategories,
  BudgetInsightsResponse,
  BudgetInsightsByMemberEntry,
  BudgetInsightsScope,
  BudgetMonthlyTrendPoint,
  BudgetUpdateRequest,
} from '../types/budget.types';
import { ExpenseType, EXPENSE_TYPES } from '../types/household.types';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/error';
import { getHouseholdForMember } from '../utils/household.helpers';
import { computeMemberAttributionsForExpense } from '../utils/expenseShare';

const currentMonthString = (now = new Date()): string =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

const previousMonthString = (now = new Date()): string => {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const monthRange = (monthString: string): { gte: Date; lt: Date } => {
  const [y, m] = monthString.split('-').map(Number);
  return {
    gte: new Date(y, m - 1, 1),
    lt: new Date(y, m, 1),
  };
};

class BudgetService {
  async getCurrent(householdId: string, userId: string): Promise<IBudget> {
    await getHouseholdForMember(householdId, userId);
    let doc = await Budget.findOne({ householdId });
    if (!doc) {
      doc = await Budget.create({ householdId, categories: {} });
    }
    return doc;
  }

  async update(
    householdId: string,
    userId: string,
    input: BudgetUpdateRequest
  ): Promise<IBudget> {
    const { member } = await getHouseholdForMember(householdId, userId);
    if (member.role !== 'admin' && member.role !== 'owner') {
      throw ForbiddenError('Only admins can edit the household budget');
    }

    this.validateCategories(input.categories);

    const prev = previousMonthString();
    const existing = await Budget.findOne({ householdId });
    if (existing) {
      const snap = await BudgetSnapshot.findOne({ householdId, monthString: prev });
      if (!snap) {
        await BudgetSnapshot.create({
          householdId,
          monthString: prev,
          categories: existing.categories,
          frozenAt: new Date(),
        });
      }
    }

    const updated = await Budget.findOneAndUpdate(
      { householdId },
      { householdId, categories: input.categories },
      { upsert: true, new: true }
    );
    if (!updated) throw NotFoundError('Budget not found after update');
    return updated;
  }

  async getForMonth(
    householdId: string,
    userId: string,
    monthString: string
  ): Promise<{ categories: IBudgetCategories; source: 'live' | 'snapshot' }> {
    await getHouseholdForMember(householdId, userId);
    this.validateMonthString(monthString);

    if (monthString >= currentMonthString()) {
      const live = await this.ensureBudget(householdId);
      return { categories: live.categories, source: 'live' };
    }

    const existing = await BudgetSnapshot.findOne({ householdId, monthString });
    if (existing) {
      return { categories: existing.categories, source: 'snapshot' };
    }

    const live = await this.ensureBudget(householdId);
    const created = await BudgetSnapshot.create({
      householdId,
      monthString,
      categories: live.categories,
      frozenAt: new Date(),
    });
    return { categories: created.categories, source: 'snapshot' };
  }

  async getInsights(
    householdId: string,
    userId: string,
    monthString: string,
    scope: BudgetInsightsScope = 'personal'
  ): Promise<BudgetInsightsResponse> {
    const { household, member } = await getHouseholdForMember(householdId, userId);
    this.validateMonthString(monthString);

    const budgetForMonth = await this.getForMonth(householdId, userId, monthString);

    const range = monthRange(monthString);
    const monthExpenses = await Expense.find({
      householdId: new Types.ObjectId(householdId),
      date: { $gte: range.gte, $lt: range.lt },
    });

    // Per-member attribution. Use the split-aware utility to compute
    // share + paid amounts for each expense, then accumulate per member.
    // In joint mode, `share` is undefined on every attribution and we
    // surface that by leaving `totalShare`/`shareByCategory` undefined on
    // the response entries.
    const isJointMode = household.settings.financeMode === 'joint';

    // Joint-mode households have no per-user share, so personal scope is
    // meaningless there — force household scope regardless of request.
    const effectiveScope: BudgetInsightsScope = isJointMode ? 'household' : scope;
    const currentMemberId = member._id.toString();

    // Household-level totals (always computed; used both as the canonical
    // household view and as a fallback if effectiveScope === 'household').
    const householdSpendByCategory: IBudgetCategories = {};
    let householdTotalSpent = 0;
    for (const exp of monthExpenses) {
      householdSpendByCategory[exp.category] =
        (householdSpendByCategory[exp.category] ?? 0) + exp.amount;
      householdTotalSpent += exp.amount;
    }

    interface PerMemberAccumulator {
      totalShare?: number;
      totalPaid: number;
      shareByCategory?: Partial<Record<ExpenseType, number>>;
      paidByCategory: Partial<Record<ExpenseType, number>>;
    }

    const perMemberAccumulator = new Map<string, PerMemberAccumulator>();

    for (const exp of monthExpenses) {
      const attributions = computeMemberAttributionsForExpense(exp, household);
      for (const [memberId, attribution] of attributions) {
        let entry = perMemberAccumulator.get(memberId);
        if (!entry) {
          entry = isJointMode
            ? { totalPaid: 0, paidByCategory: {} }
            : { totalShare: 0, totalPaid: 0, shareByCategory: {}, paidByCategory: {} };
          perMemberAccumulator.set(memberId, entry);
        }

        if (attribution.share !== undefined) {
          entry.totalShare = (entry.totalShare ?? 0) + attribution.share;
          entry.shareByCategory = entry.shareByCategory ?? {};
          entry.shareByCategory[exp.category] =
            (entry.shareByCategory[exp.category] ?? 0) + attribution.share;
        }

        entry.totalPaid += attribution.paid;
        if (attribution.paid !== 0) {
          entry.paidByCategory[exp.category] =
            (entry.paidByCategory[exp.category] ?? 0) + attribution.paid;
        }
      }
    }

    const byMember: BudgetInsightsByMemberEntry[] = [];
    for (const m of household.members) {
      if (m.participatesInFinances === false) continue;
      const memberKey = m._id.toString();
      const acc = perMemberAccumulator.get(memberKey);

      const entry: BudgetInsightsByMemberEntry = isJointMode
        ? {
            memberId: memberKey,
            nickname: m.nickname,
            totalShare: undefined,
            shareByCategory: undefined,
            totalPaid: acc?.totalPaid ?? 0,
            paidByCategory: acc?.paidByCategory ?? {},
          }
        : {
            memberId: memberKey,
            nickname: m.nickname,
            totalShare: acc?.totalShare ?? 0,
            shareByCategory: acc?.shareByCategory ?? {},
            totalPaid: acc?.totalPaid ?? 0,
            paidByCategory: acc?.paidByCategory ?? {},
          };

      byMember.push(entry);
    }

    // Resolve the page-level scope-aware totals from the precomputed
    // per-member accumulator. Personal scope reads the current user's
    // share/shareByCategory; household scope uses the raw sum.
    let spendByCategory: IBudgetCategories;
    let totalSpent: number;
    if (effectiveScope === 'personal') {
      const myAcc = perMemberAccumulator.get(currentMemberId);
      spendByCategory = { ...(myAcc?.shareByCategory ?? {}) };
      totalSpent = myAcc?.totalShare ?? 0;
    } else {
      spendByCategory = householdSpendByCategory;
      totalSpent = householdTotalSpent;
    }

    const trend: BudgetMonthlyTrendPoint[] = [];
    const [y, m] = monthString.split('-').map(Number);
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(y, m - 1 - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    const trendStart = monthRange(months[0]).gte;
    const trendEnd = monthRange(months[5]).lt;

    if (effectiveScope === 'household') {
      const trendAgg = await Expense.aggregate<{ _id: string; total: number }>([
        { $match: { householdId: new Types.ObjectId(householdId), date: { $gte: trendStart, $lt: trendEnd } } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m', date: '$date' },
            },
            total: { $sum: '$amount' },
          },
        },
      ]);
      const trendMap = new Map<string, number>();
      for (const row of trendAgg) trendMap.set(row._id, row.total);
      for (const ms of months) {
        trend.push({ monthString: ms, totalSpent: trendMap.get(ms) ?? 0 });
      }
    } else {
      // Personal scope: sum each expense's per-user share into the matching
      // month bucket. Cheaper than another aggregation pipeline since the
      // expense set for 6 months is small.
      const trendExpenses = await Expense.find({
        householdId: new Types.ObjectId(householdId),
        date: { $gte: trendStart, $lt: trendEnd },
      });
      const trendMap = new Map<string, number>();
      for (const exp of trendExpenses) {
        const expMonth = `${exp.date.getFullYear()}-${String(exp.date.getMonth() + 1).padStart(2, '0')}`;
        const attributions = computeMemberAttributionsForExpense(exp, household);
        const myAttribution = attributions.get(currentMemberId);
        const myShare = myAttribution?.share ?? 0;
        trendMap.set(expMonth, (trendMap.get(expMonth) ?? 0) + myShare);
      }
      for (const ms of months) {
        trend.push({ monthString: ms, totalSpent: trendMap.get(ms) ?? 0 });
      }
    }

    const totalBudgeted = (Object.values(budgetForMonth.categories) as Array<number | undefined>)
      .filter((v): v is number => typeof v === 'number')
      .reduce((sum, v) => sum + v, 0);

    // Over-budget flag always reflects household spend vs. household budget —
    // budgets are stored per-household so comparing against the household
    // totals is the only consistent signal regardless of view scope.
    const overBudgetCategories: ExpenseType[] = [];
    for (const cat of EXPENSE_TYPES) {
      const budgeted = budgetForMonth.categories[cat];
      const spent = householdSpendByCategory[cat] ?? 0;
      if (typeof budgeted === 'number' && spent > budgeted) overBudgetCategories.push(cat);
    }

    const monthlyIncome = typeof member.monthlyIncome === 'number' ? member.monthlyIncome : null;
    const savingsRate =
      monthlyIncome && monthlyIncome > 0
        ? Math.max(0, Math.min(1, (monthlyIncome - totalSpent) / monthlyIncome))
        : null;

    return {
      month: monthString,
      budget: budgetForMonth.categories,
      budgetSource: budgetForMonth.source,
      spendByCategory,
      totalSpent,
      totalBudgeted,
      monthlyTrend: trend,
      savingsRate,
      monthlyIncome,
      overBudgetCategories,
      byMember,
      requestedScope: scope,
      effectiveScope,
    };
  }

  // ── Internals ───────────────────────────────────────────────────────

  private async ensureBudget(householdId: string): Promise<IBudget> {
    let doc = await Budget.findOne({ householdId });
    if (!doc) doc = await Budget.create({ householdId, categories: {} });
    return doc;
  }

  private validateCategories(input: IBudgetCategories): void {
    for (const key of Object.keys(input)) {
      if (!EXPENSE_TYPES.includes(key as ExpenseType)) {
        throw BadRequestError(`Unknown category "${key}"`);
      }
      const value = input[key as ExpenseType];
      if (value === undefined) continue;
      if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
        throw BadRequestError(`Category "${key}" must be a non-negative number`);
      }
    }
  }

  private validateMonthString(monthString: string): void {
    if (!/^\d{4}-\d{2}$/.test(monthString)) {
      throw BadRequestError('month must be in YYYY-MM format');
    }
  }
}

export const budgetService = new BudgetService();
