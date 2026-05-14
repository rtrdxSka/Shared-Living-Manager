/**
 * ShoppingListPage.flows.test.tsx — Sub-batch K (6 integration tests)
 *
 * Architecture: renders with the REAL DashboardProvider (not vi.mock).
 * ShoppingListPage uses `useBlocker` (react-router data-router API), so we
 * MUST use `createMemoryRouter` + `RouterProvider` directly (MemoryRouter does
 * not support `useBlocker`). We do NOT use `renderWithProviders` (which wraps
 * in MemoryRouter) to avoid the nested-router conflict. Instead we follow the
 * pattern established in the Batch 7 ShoppingListPage.test.tsx.
 *
 * Confirmed endpoints (from shoppingList.api.ts + recurringShoppingItem.api.ts):
 *   Toggle bought:    PATCH  /api/households/:id/shopping-list/:itemId/bought
 *   Delete item:      DELETE /api/households/:id/shopping-list/:itemId
 *   Archive bought:   POST   /api/households/:id/shopping-list/archive-bought
 *   History:          GET    /api/households/:id/shopping-list/history
 *   Recurring rules:  GET    /api/households/:id/shopping-list/recurring
 *   Delete rule:      DELETE /api/households/:id/shopping-list/recurring/:ruleId
 *
 * Tab labels (from ShoppingListPage.tsx TabsTrigger values):
 *   "Active", "History", "Recurring"
 *
 * DoneShoppingDialog button: "Open expense form"
 * ConfirmDeleteDialog confirm button: "Delete" (default confirmLabel)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { DashboardProvider } from '@/contexts/DashboardContext';
import ShoppingListPage from '@/pages/dashboard/ShoppingListPage';
import { server } from '@/test/mocks/server';
import { createTestQueryClient } from '@/test/utils/test-query-client';
import { mockHousehold } from '@/test/mocks/data/households';
import { mockUsers } from '@/test/mocks/data/users';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const baseItem = {
  _id: 'item-milk-001',
  householdId: mockHousehold._id,
  name: 'Milk',
  category: 'groceries',
  addedByUserId: mockUsers.alice._id,
  isBought: false,
  createdAt: '2026-05-10T00:00:00.000Z',
  updatedAt: '2026-05-10T00:00:00.000Z',
};

/** An item that is already bought — used to test "Done shopping" CTA presence. */
const boughtItem = {
  ...baseItem,
  _id: 'item-bread-001',
  name: 'Bread',
  isBought: true,
  boughtAt: '2026-05-10T10:00:00.000Z',
};

const recurringRule = {
  _id: 'rule-eggs-001',
  householdId: mockHousehold._id,
  name: 'Eggs',
  category: 'groceries',
  cadence: 'weekly' as const,
  active: true,
  createdBy: mockUsers.alice._id,
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
};

const historyEntry = {
  type: 'manual' as const,
  archivedAt: '2026-05-08T00:00:00.000Z',
  items: [
    {
      ...baseItem,
      _id: 'item-old-001',
      name: 'Old Bananas',
      archivedAt: '2026-05-08T00:00:00.000Z',
    },
  ],
};

// ── Render helper ─────────────────────────────────────────────────────────────

/**
 * Renders ShoppingListPage inside a data router (required for useBlocker),
 * wrapped in a fresh QueryClient + AuthProvider + REAL DashboardProvider.
 */
function renderShoppingListPage() {
  const qc = createTestQueryClient();
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <DashboardProvider household={mockHousehold} currentUserId={mockUsers.alice._id}>
            <ShoppingListPage />
          </DashboardProvider>
        ),
      },
    ],
    { initialEntries: ['/'] },
  );

  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

// ── Default GET handlers (overridden per-test as needed) ──────────────────────

beforeEach(() => {
  server.use(
    // Active list: returns one unbought item by default.
    // useBoughtShoppingItems queries with ?boughtState=bought — returns empty by default.
    http.get('/api/households/:id/shopping-list', ({ request }) => {
      const boughtState = new URL(request.url).searchParams.get('boughtState');
      if (boughtState === 'bought') {
        return HttpResponse.json({
          success: true,
          data: { items: [], nextCursor: null },
        });
      }
      return HttpResponse.json({
        success: true,
        data: { items: [baseItem], nextCursor: null },
      });
    }),

    // Recurring rules: empty by default.
    http.get('/api/households/:id/shopping-list/recurring', () =>
      HttpResponse.json({ success: true, data: { items: [] } }),
    ),

    // History: empty by default.
    http.get('/api/households/:id/shopping-list/history', () =>
      HttpResponse.json({
        success: true,
        data: { entries: [], nextCursor: null },
      }),
    ),

    // DashboardProvider fires these on mount:
    http.get('/api/households/:id/tasks', () =>
      HttpResponse.json({ status: 'success', data: { items: [], nextCursor: null } }),
    ),
    http.get('/api/households/:id/goals', () =>
      HttpResponse.json({ status: 'success', data: { items: [], total: 0, page: 1, limit: 20 } }),
    ),
    http.get('/api/households/:id/joint-account', () =>
      HttpResponse.json({ status: 'success', data: { summary: null } }),
    ),
  );
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('<ShoppingListPage /> flows', () => {
  /**
   * K.1 — Toggle bought (checkbox) fires PATCH /shopping-list/:itemId/bought.
   * The checkbox is labelled "Mark <name> as bought".
   */
  it('K.1 — Toggle bought checkbox fires PATCH /bought', async () => {
    let patchCalled = false;
    server.use(
      http.patch('/api/households/:hid/shopping-list/:itemId/bought', () => {
        patchCalled = true;
        return HttpResponse.json({
          success: true,
          data: { item: { ...baseItem, isBought: true } },
        });
      }),
    );

    const user = userEvent.setup();
    renderShoppingListPage();

    // Wait for item to appear
    await screen.findByText('Milk');

    const checkbox = screen.getByRole('checkbox', { name: /mark milk as bought/i });
    await user.click(checkbox);

    await waitFor(() => expect(patchCalled).toBe(true));
  });

  /**
   * K.2 — "Done shopping (N)" CTA appears when bought count ≥ 1.
   * We seed the bought-state query to return one bought item.
   */
  it('K.2 — "Done shopping" CTA appears when bought item count ≥ 1', async () => {
    server.use(
      // Override: boughtState=bought returns one item → hasBought = true
      http.get('/api/households/:id/shopping-list', ({ request }) => {
        const boughtState = new URL(request.url).searchParams.get('boughtState');
        if (boughtState === 'bought') {
          return HttpResponse.json({
            success: true,
            data: { items: [boughtItem], nextCursor: null },
          });
        }
        return HttpResponse.json({
          success: true,
          data: { items: [baseItem], nextCursor: null },
        });
      }),
    );

    renderShoppingListPage();

    // CTA renders inside the Active tab: "Done shopping (1)"
    const cta = await screen.findByRole('button', { name: /done shopping/i });
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveTextContent('1');
  });

  /**
   * K.3 — DoneShoppingDialog "Open expense form" button is clickable, and after
   * submitting the resulting AddExpenseForm, POST /shopping-list/archive-bought fires.
   *
   * Flow: bought item in API → CTA visible → click → dialog → "Open expense form"
   *   → expense sheet opens → fill amount → submit expense → archive-bought called.
   */
  it('K.3 — DoneShoppingDialog confirm flow posts to /archive-bought', async () => {
    let archiveBoughtCalled = false;
    const createdExpenseId = 'exp-new-001';

    server.use(
      // Seed one bought item
      http.get('/api/households/:id/shopping-list', ({ request }) => {
        const boughtState = new URL(request.url).searchParams.get('boughtState');
        if (boughtState === 'bought') {
          return HttpResponse.json({
            success: true,
            data: { items: [boughtItem], nextCursor: null },
          });
        }
        return HttpResponse.json({
          success: true,
          data: { items: [baseItem], nextCursor: null },
        });
      }),

      // Stub expense creation — required for onCreated to fire
      http.post('/api/households/:hid/expenses', async () =>
        HttpResponse.json({
          status: 'success',
          data: {
            expense: {
              _id: createdExpenseId,
              householdId: mockHousehold._id,
              description: 'Test',
              amount: 10,
              category: 'groceries',
              date: '2026-05-10',
              isResolved: false,
              pendingConfirmation: false,
              isFullRepayment: false,
              createdByUserId: mockUsers.alice._id,
              createdAt: '2026-05-10T00:00:00.000Z',
              updatedAt: '2026-05-10T00:00:00.000Z',
            },
          },
        }),
      ),

      // archive-bought fires after expense is created
      http.post('/api/households/:hid/shopping-list/archive-bought', () => {
        archiveBoughtCalled = true;
        return HttpResponse.json({
          success: true,
          data: { archivedCount: 1 },
        });
      }),

      // DashboardProvider invalidation GET after mutations:
      http.get('/api/households/:id/expenses', () =>
        HttpResponse.json({ status: 'success', data: { items: [], nextCursor: null } }),
      ),
      http.get('/api/households/:id/recurring-expenses', () =>
        HttpResponse.json({ status: 'success', data: { items: [] } }),
      ),
      http.get('/api/households/:id/members/income', () =>
        HttpResponse.json({ status: 'success', data: { items: [] } }),
      ),
    );

    const user = userEvent.setup();
    renderShoppingListPage();

    // Wait for CTA
    const ctaButton = await screen.findByRole('button', { name: /done shopping/i });
    await user.click(ctaButton);

    // DoneShoppingDialog should appear
    const openFormBtn = await screen.findByRole('button', { name: /open expense form/i });
    await user.click(openFormBtn);

    // AddExpenseForm sheet opens — fill amount (description is pre-filled from bought items)
    const amountInput = await screen.findByPlaceholderText(/0\.00/i);
    await user.click(amountInput);
    await user.type(amountInput, '15');

    // Submit the form
    const submitBtn = screen.getByRole('button', { name: /add expense/i });
    await user.click(submitBtn);

    await waitFor(() => expect(archiveBoughtCalled).toBe(true));
  });

  /**
   * K.4 — History tab shows previously-archived items.
   * Clicking the "History" tab triggers useArchivedHistory which GETs /shopping-list/history.
   */
  it('K.4 — History tab shows previously-bought/archived items', async () => {
    server.use(
      http.get('/api/households/:id/shopping-list/history', () =>
        HttpResponse.json({
          success: true,
          data: {
            entries: [historyEntry],
            nextCursor: null,
          },
        }),
      ),
    );

    const user = userEvent.setup();
    renderShoppingListPage();

    // Wait for Active tab to load
    await screen.findByText('Milk');

    // Click History tab
    const historyTab = screen.getByRole('tab', { name: /history/i });
    await user.click(historyTab);

    // Archived item should appear in history
    expect(await screen.findByText('Old Bananas')).toBeInTheDocument();
  });

  /**
   * K.5 — Recurring tab shows recurring shopping rules from GET /shopping-list/recurring.
   */
  it('K.5 — Recurring tab shows recurring shopping rules', async () => {
    server.use(
      http.get('/api/households/:id/shopping-list/recurring', () =>
        HttpResponse.json({
          success: true,
          data: { items: [recurringRule] },
        }),
      ),
    );

    const user = userEvent.setup();
    renderShoppingListPage();

    // Wait for Active tab to load
    await screen.findByText('Milk');

    // Click Recurring tab
    const recurringTab = screen.getByRole('tab', { name: /recurring/i });
    await user.click(recurringTab);

    // Recurring rule "Eggs" should appear
    expect(await screen.findByText('Eggs')).toBeInTheDocument();
  });

  /**
   * K.6 — Delete item fires DELETE /shopping-list/:itemId.
   * The ShoppingListView shows a delete button per item; clicking opens ConfirmDeleteDialog,
   * which has a "Delete" confirm button.
   */
  it('K.6 — Delete item fires DELETE /shopping-list/:itemId', async () => {
    let deleteCalled = false;
    server.use(
      http.delete('/api/households/:hid/shopping-list/:itemId', () => {
        deleteCalled = true;
        return HttpResponse.json({ success: true, message: 'Deleted' });
      }),
    );

    const user = userEvent.setup();
    renderShoppingListPage();

    // Wait for item
    await screen.findByText('Milk');

    // Click the "Delete Milk" icon button
    const deleteButton = screen.getByRole('button', { name: /delete milk/i });
    await user.click(deleteButton);

    // ConfirmDeleteDialog appears — confirm with "Delete" button
    const confirmButton = await screen.findByRole('button', { name: /^delete$/i });
    await user.click(confirmButton);

    await waitFor(() => expect(deleteCalled).toBe(true));
  });
});
