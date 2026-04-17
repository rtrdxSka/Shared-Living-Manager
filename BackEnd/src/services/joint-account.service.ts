import { Types } from 'mongoose';
import { Household } from '../models/household.model';
import { JointAccountTransaction } from '../models/joint-account-transaction.model';
import { Expense } from '../models/expense.model';
import {
  IAddTransactionInput,
  IUpdateJointAccountConfigInput,
  IJointAccountTransactionResponse,
  IJointAccountSummaryResponse,
  IJointAccountMemberBreakdown,
} from '../types/joint-account.types';
import { IHouseholdMember, IHouseholdResponse } from '../types/household.types';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/error';
import { householdService } from './household.service';
import { IPaginationInput } from '../types/pagination.types';
import { parsePaginationParams } from '../utils/pagination';

class JointAccountService {
  // ── Get Summary ──────────────────────────────────────────────────────

  async getSummary(
    householdId: string,
    userId: string,
    month?: string,
    paginationInput: IPaginationInput = {}
  ): Promise<IJointAccountSummaryResponse> {
    const household = await Household.findById(householdId);
    if (!household) throw NotFoundError('Household not found');

    const requesterMember = household.members.find(
      (m) => m.userId?.toString() === userId
    );
    if (!requesterMember) throw ForbiddenError('You are not a member of this household');

    const { start, end } = this.buildMonthRange(month);
    const householdObjId = household._id as Types.ObjectId;

    // 1. Aggregate all-time transaction totals (deposits & withdrawals)
    const allTimeTxTotals = await JointAccountTransaction.aggregate<{
      _id: string;
      total: number;
    }>([
      { $match: { householdId: householdObjId } },
      { $group: { _id: '$type', total: { $sum: '$amount' } } },
    ]);

    const allTimeDeposits =
      allTimeTxTotals.find((t) => t._id === 'deposit')?.total ?? 0;
    const allTimeWithdrawals =
      allTimeTxTotals.find((t) => t._id === 'withdrawal')?.total ?? 0;

    // 2. Aggregate all-time expenses total
    const allTimeExpenseAgg = await Expense.aggregate<{
      _id: null;
      total: number;
    }>([
      { $match: { householdId: householdObjId } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const allTimeExpenses = allTimeExpenseAgg[0]?.total ?? 0;

    // 3. Balance = deposits - withdrawals - expenses
    const balance = allTimeDeposits - allTimeWithdrawals - allTimeExpenses;

    // 4. Monthly transaction totals (grouped by type)
    const monthlyTxTotals = await JointAccountTransaction.aggregate<{
      _id: string;
      total: number;
    }>([
      { $match: { householdId: householdObjId, createdAt: { $gte: start, $lt: end } } },
      { $group: { _id: '$type', total: { $sum: '$amount' } } },
    ]);

    const monthlyDeposits =
      monthlyTxTotals.find((t) => t._id === 'deposit')?.total ?? 0;
    const monthlyWithdrawals =
      monthlyTxTotals.find((t) => t._id === 'withdrawal')?.total ?? 0;

    // 5. Monthly expenses total
    const monthlyExpenseAgg = await Expense.aggregate<{
      _id: null;
      total: number;
    }>([
      { $match: { householdId: householdObjId, date: { $gte: start, $lt: end } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const monthlyExpenses = monthlyExpenseAgg[0]?.total ?? 0;
    const monthlyNet = monthlyDeposits - monthlyWithdrawals - monthlyExpenses;

    // 6. Per-member monthly breakdown (deposits & withdrawals only)
    const memberMonthlyAgg = await JointAccountTransaction.aggregate<{
      _id: { memberId: Types.ObjectId; type: string };
      total: number;
    }>([
      { $match: { householdId: householdObjId, createdAt: { $gte: start, $lt: end } } },
      { $group: { _id: { memberId: '$memberId', type: '$type' }, total: { $sum: '$amount' } } },
    ]);

    // Build member nickname map (by member._id)
    const memberMap = new Map<string, IHouseholdMember>();
    for (const m of household.members) {
      memberMap.set(m._id.toString(), m);
    }

    // Build per-member breakdown for financial members
    const financialMembers = household.members.filter((m) => m.participatesInFinances && m.userId);
    const config = household.settings.jointAccountConfig;
    const memberTargets = this.computeMemberTargets(financialMembers, config?.monthlyTarget, config?.targetMode);

    const memberBreakdown: IJointAccountMemberBreakdown[] = financialMembers.map((m) => {
      const mId = m._id.toString();
      const deposits = memberMonthlyAgg
        .filter((a) => a._id.memberId.toString() === mId && a._id.type === 'deposit')
        .reduce((sum, a) => sum + a.total, 0);
      const withdrawals = memberMonthlyAgg
        .filter((a) => a._id.memberId.toString() === mId && a._id.type === 'withdrawal')
        .reduce((sum, a) => sum + a.total, 0);

      return {
        memberId: mId,
        nickname: m.nickname,
        deposits,
        withdrawals,
        ...(memberTargets.has(mId) && { targetAmount: memberTargets.get(mId) }),
      };
    });

    // 7. Fetch transactions for the month (paginated)
    const txFilter = { householdId: householdObjId, createdAt: { $gte: start, $lt: end } };
    const { page: txPage, limit: txLimit, skip: txSkip } = parsePaginationParams(paginationInput);
    const [transactions, transactionTotal] = await Promise.all([
      JointAccountTransaction.find(txFilter).sort({ createdAt: -1 }).skip(txSkip).limit(txLimit),
      JointAccountTransaction.countDocuments(txFilter),
    ]);

    const formattedTransactions: IJointAccountTransactionResponse[] = transactions.map(
      (tx) => this.formatTransactionResponse(tx, memberMap)
    );

    return {
      balance: Math.round(balance * 100) / 100,
      monthlyDeposits: Math.round(monthlyDeposits * 100) / 100,
      monthlyWithdrawals: Math.round(monthlyWithdrawals * 100) / 100,
      monthlyExpenses: Math.round(monthlyExpenses * 100) / 100,
      monthlyNet: Math.round(monthlyNet * 100) / 100,
      ...(config?.monthlyTarget !== undefined && { monthlyTarget: config.monthlyTarget }),
      ...(config?.targetMode && { targetMode: config.targetMode }),
      memberBreakdown,
      transactions: formattedTransactions,
      transactionTotal,
      transactionPage: txPage,
      transactionTotalPages: Math.ceil(transactionTotal / txLimit) || 1,
    };
  }

  // ── Add Transaction ────────────────────────────────────────────────

  async addTransaction(
    householdId: string,
    userId: string,
    input: IAddTransactionInput
  ): Promise<IJointAccountTransactionResponse> {
    const household = await Household.findById(householdId);
    if (!household) throw NotFoundError('Household not found');

    const requesterMember = household.members.find(
      (m) => m.userId?.toString() === userId
    );
    if (!requesterMember) throw ForbiddenError('You are not a member of this household');
    if (!requesterMember.participatesInFinances) {
      throw ForbiddenError('You do not participate in household finances');
    }

    // Prevent withdrawals that exceed the current balance
    if (input.type === 'withdrawal') {
      const balance = await this.computeBalance(household._id as Types.ObjectId);
      if (input.amount > balance) {
        throw BadRequestError(`Insufficient balance. Current balance: ${balance.toFixed(2)}`);
      }
    }

    const transaction = await JointAccountTransaction.create({
      householdId: household._id,
      memberId: requesterMember._id,
      userId,
      type: input.type,
      amount: input.amount,
      ...(input.note?.trim() && { note: input.note.trim() }),
    });

    const memberMap = new Map<string, IHouseholdMember>();
    for (const m of household.members) {
      memberMap.set(m._id.toString(), m);
    }

    return this.formatTransactionResponse(transaction, memberMap);
  }

  // ── Delete Transaction ─────────────────────────────────────────────

  async deleteTransaction(
    householdId: string,
    userId: string,
    transactionId: string
  ): Promise<void> {
    const household = await Household.findById(householdId);
    if (!household) throw NotFoundError('Household not found');

    const requesterMember = household.members.find(
      (m) => m.userId?.toString() === userId
    );
    if (!requesterMember) throw ForbiddenError('You are not a member of this household');
    if (!requesterMember.participatesInFinances) {
      throw ForbiddenError('You do not participate in household finances');
    }

    const transaction = await JointAccountTransaction.findOne({
      _id: transactionId,
      householdId: household._id,
    });
    if (!transaction) throw NotFoundError('Transaction not found');

    const isAdminOrOwner =
      requesterMember.role === 'owner' || requesterMember.role === 'admin';
    const isCreator = transaction.userId.toString() === userId;
    if (!isCreator && !isAdminOrOwner) {
      throw ForbiddenError('You can only delete transactions you created');
    }

    await transaction.deleteOne();
  }

  // ── Update Config ──────────────────────────────────────────────────

  async updateConfig(
    householdId: string,
    userId: string,
    input: IUpdateJointAccountConfigInput
  ): Promise<IHouseholdResponse> {
    const household = await Household.findById(householdId);
    if (!household) throw NotFoundError('Household not found');

    const requesterMember = household.members.find(
      (m) => m.userId?.toString() === userId
    );
    if (!requesterMember) throw ForbiddenError('You are not a member of this household');
    if (requesterMember.role !== 'owner' && requesterMember.role !== 'admin') {
      throw ForbiddenError('Only admins can update joint account configuration');
    }

    // If monthlyTarget is explicitly null, clear the entire config
    if (input.monthlyTarget === null) {
      household.settings.jointAccountConfig = undefined;
    } else {
      // Initialize config if not present
      if (!household.settings.jointAccountConfig) {
        household.settings.jointAccountConfig = {};
      }

      if (input.monthlyTarget !== undefined) {
        household.settings.jointAccountConfig.monthlyTarget = input.monthlyTarget;
      }
      if (input.targetMode !== undefined) {
        household.settings.jointAccountConfig.targetMode = input.targetMode;
      }
    }

    await household.save();

    return householdService.formatHouseholdResponse(household);
  }

  // ── Private Helpers ────────────────────────────────────────────────

  private buildMonthRange(month?: string): { start: Date; end: Date } {
    let year: number, monthIndex: number;
    if (month) {
      const [y, m] = month.split('-').map(Number);
      year = y;
      monthIndex = m - 1;
    } else {
      const now = new Date();
      year = now.getUTCFullYear();
      monthIndex = now.getUTCMonth();
    }
    return {
      start: new Date(Date.UTC(year, monthIndex, 1)),
      end: new Date(Date.UTC(year, monthIndex + 1, 1)),
    };
  }

  private async computeBalance(householdId: Types.ObjectId): Promise<number> {
    const txTotals = await JointAccountTransaction.aggregate<{ _id: string; total: number }>([
      { $match: { householdId } },
      { $group: { _id: '$type', total: { $sum: '$amount' } } },
    ]);
    const deposits = txTotals.find((t) => t._id === 'deposit')?.total ?? 0;
    const withdrawals = txTotals.find((t) => t._id === 'withdrawal')?.total ?? 0;

    const expenseAgg = await Expense.aggregate<{ _id: null; total: number }>([
      { $match: { householdId } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const expenses = expenseAgg[0]?.total ?? 0;

    return Math.round((deposits - withdrawals - expenses) * 100) / 100;
  }

  private computeMemberTargets(
    financialMembers: IHouseholdMember[],
    monthlyTarget?: number,
    targetMode?: string
  ): Map<string, number> {
    const targets = new Map<string, number>();
    if (!monthlyTarget || financialMembers.length === 0) return targets;

    if (targetMode === 'proportional') {
      const totalIncome = financialMembers.reduce(
        (sum, m) => sum + (m.monthlyIncome ?? 0),
        0
      );

      // Fall back to equal split if no income data
      if (totalIncome === 0) {
        const perPerson = monthlyTarget / financialMembers.length;
        for (const m of financialMembers) {
          targets.set(m._id.toString(), Math.round(perPerson * 100) / 100);
        }
      } else {
        for (const m of financialMembers) {
          const ratio = (m.monthlyIncome ?? 0) / totalIncome;
          targets.set(m._id.toString(), Math.round(ratio * monthlyTarget * 100) / 100);
        }
      }
    } else {
      // Default: equal split
      const perPerson = monthlyTarget / financialMembers.length;
      for (const m of financialMembers) {
        targets.set(m._id.toString(), Math.round(perPerson * 100) / 100);
      }
    }

    return targets;
  }

  private formatTransactionResponse(
    tx: { _id: Types.ObjectId; householdId: Types.ObjectId; memberId: Types.ObjectId; userId: Types.ObjectId; type: string; amount: number; note?: string; createdAt: Date },
    memberMap: Map<string, IHouseholdMember>
  ): IJointAccountTransactionResponse {
    const member = memberMap.get(tx.memberId.toString());
    return {
      _id: tx._id.toString(),
      householdId: tx.householdId.toString(),
      memberId: tx.memberId.toString(),
      memberNickname: member?.nickname ?? 'Unknown',
      userId: tx.userId.toString(),
      type: tx.type as IJointAccountTransactionResponse['type'],
      amount: tx.amount,
      ...(tx.note && { note: tx.note }),
      createdAt: tx.createdAt.toISOString(),
    };
  }
}

export const jointAccountService = new JointAccountService();
