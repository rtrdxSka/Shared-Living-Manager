import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { expenseService } from '../services/expense.service';
import { IAddExpenseInput, IListExpensesInput, IUpdateExpenseInput, ExpenseStatus } from '../types/expense.types';

import { ExpenseType } from '../types/household.types';

function toStringArray(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value.map(String);
  return [String(value)];
}

class ExpenseController {
  // POST /api/households/:id/expenses
  async addExpense(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const householdId = req.params.id as string;
      const input: IAddExpenseInput = req.body as IAddExpenseInput;

      const expense = await expenseService.addExpense(householdId, req.user.userId, input);

      res.status(201).json({ status: 'success', data: { expense } });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/households/:id/expenses
  async listExpenses(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const householdId = req.params.id as string;
      const input: IListExpensesInput = {
        month: req.query.month as string | undefined,
        search: req.query.search as string | undefined,
        categories: toStringArray(req.query.categories) as ExpenseType[] | undefined,
        paidBy: toStringArray(req.query.paidBy),
        status: req.query.status as ExpenseStatus | undefined,
        cursor: req.query.cursor as string | undefined,
        limit: req.query.limit as unknown as number | undefined,
      };

      const result = await expenseService.listExpenses(householdId, req.user.userId, input);

      res.status(200).json({
        status: 'success',
        data: {
          items: result.items,
          nextCursor: result.nextCursor,
        },
      });
    } catch (error) {
      next(error);
    }
  }
  // DELETE /api/households/:id/expenses/:expenseId
  async deleteExpense(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const householdId = req.params.id as string;
      const expenseId = req.params.expenseId as string;

      await expenseService.deleteExpense(householdId, req.user.userId, expenseId);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/households/:id/expenses/:expenseId
  async updateExpense(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const householdId = req.params.id as string;
      const expenseId = req.params.expenseId as string;
      const input = req.body as IUpdateExpenseInput;

      const expense = await expenseService.updateExpense(householdId, req.user.userId, expenseId, input);

      res.status(200).json({ status: 'success', data: { expense } });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/households/:id/expenses/:expenseId/request-resolution
  async requestResolution(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ status: 'error', message: 'Unauthorized' }); return; }
      const expense = await expenseService.requestResolution(req.params.id as string, req.user.userId, req.params.expenseId as string);
      res.status(200).json({ status: 'success', data: { expense } });
    } catch (error) { next(error); }
  }

  // POST /api/households/:id/expenses/:expenseId/confirm-resolution
  async confirmResolution(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ status: 'error', message: 'Unauthorized' }); return; }
      const expense = await expenseService.confirmResolution(req.params.id as string, req.user.userId, req.params.expenseId as string);
      res.status(200).json({ status: 'success', data: { expense } });
    } catch (error) { next(error); }
  }

  // POST /api/households/:id/expenses/:expenseId/dispute-resolution
  async disputeResolution(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ status: 'error', message: 'Unauthorized' }); return; }
      const expense = await expenseService.disputeResolution(req.params.id as string, req.user.userId, req.params.expenseId as string);
      res.status(200).json({ status: 'success', data: { expense } });
    } catch (error) { next(error); }
  }

  // POST /api/households/:id/expenses/:expenseId/claim
  async claimExpense(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const householdId = req.params.id as string;
      const expenseId = req.params.expenseId as string;

      const expense = await expenseService.claimExpense(householdId, req.user.userId, expenseId);

      res.status(200).json({ status: 'success', data: { expense } });
    } catch (error) {
      next(error);
    }
  }
}

export const expenseController = new ExpenseController();
