import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { expenseService } from '../services/expense.service';
import { IAddExpenseInput, IListExpensesInput, IUpdateExpenseInput } from '../types/expense.types';

import { ExpenseType } from '../types/household.types';

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
        category: req.query.category as ExpenseType | undefined,
        page: req.query.page as unknown as number | undefined,
        limit: req.query.limit as unknown as number | undefined,
      };

      const result = await expenseService.listExpenses(householdId, req.user.userId, input);

      res.status(200).json({
        status: 'success',
        data: {
          expenses: result.items,
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
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

      res.status(200).json({ status: 'success', data: null });
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

  // POST /api/households/:id/expenses/:expenseId/resolve
  async resolveExpense(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ status: 'error', message: 'Unauthorized' }); return; }
      const expense = await expenseService.resolveExpense(req.params.id as string, req.user.userId, req.params.expenseId as string);
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
