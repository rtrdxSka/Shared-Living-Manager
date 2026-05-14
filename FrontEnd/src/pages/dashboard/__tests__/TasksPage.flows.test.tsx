/**
 * TasksPage.flows.test.tsx — Sub-batch J (7 integration tests)
 *
 * Architecture: renders with the REAL DashboardProvider (not vi.mock), so the
 * real useToggleTaskComplete / useAssignTask / useSetRotation / useDeleteTask
 * mutation hooks fire and MSW intercepts axios calls.
 * This makes the cache regression test (J.7) meaningful — it will fail if the
 * onSettled invalidation is removed from useToggleTaskComplete.
 *
 * DOM notes (from reading TasksPage.tsx):
 * - Action buttons appear ONLY in the expanded detail panel.
 *   Tests must click the row title to expand it first.
 * - Button text:
 *   "Mark as done"         (pending task — not yet complete)
 *   "Mark as incomplete"   (completed task, within 24h)
 *   "Delete task"          (canDelete — isAdmin OR creator)
 *   "Yes, delete"          (inline confirm button)
 *   "Claim this task"      (voluntary distribution, unassigned)
 *   "Confirm"              (SetRotationDialog confirm button)
 * - Checkbox: role="checkbox" span (not an <input>) for inline complete toggle
 * - AssignSelect: a <Select> component for fixed distribution (not a button)
 * - SetRotationDialog: opened via "Set rotation" or "Edit cycle" button in
 *   the RotationBanner (distribution === 'rotation')
 *
 * Fixture design:
 *   aliceTask        — created by Alice (creator = alice), pending, no assignee
 *                      (canDelete = true for Alice; canReassign = true for Alice)
 *   bobTask          — created by Bob, pending, unassigned
 *                      (Alice cannot delete; canDelete = false for non-admin Alice)
 *   voluntaryTask    — pending, unassigned, used in voluntary-mode render
 *   completedTask    — isCompleted = true (appears in DONE THIS WEEK section)
 *
 * DashboardProvider fires on mount:
 *   GET /api/households/:id/tasks    (useTasks — hoisted in DashboardContext)
 *   GET /api/households/:id/goals    (useGoals — hoisted in DashboardContext)
 * TasksPage additionally fires (taskLevel === 'full'):
 *   GET /api/households/:id/recurring-tasks  (useRecurringTasks)
 *
 * Confirmed HTTP methods (from task.api.ts):
 *   PATCH  /api/households/:id/tasks/:tid/assign    (assignTask)
 *   PATCH  /api/households/:id/tasks/:tid/complete  (toggleComplete)
 *   PATCH  /api/households/:id/tasks/rotation       (setRotation)
 *   DELETE /api/households/:id/tasks/:tid           (deleteTask)
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import TasksPage from '@/pages/dashboard/TasksPage';
import { DashboardProvider } from '@/contexts/DashboardContext';
import { renderWithProviders } from '@/test/utils/renderWithProviders';
import { server } from '@/test/mocks/server';
import {
  mockHousehold,
  mockHouseholdTaskFixed,
  mockHouseholdTaskVoluntary,
  mockHouseholdTaskRotation,
} from '@/test/mocks/data/households';
import { mockUsers } from '@/test/mocks/data/users';

// Radix UI <Select> uses pointer capture and scrollIntoView APIs not available
// in jsdom. Polyfill both so the dropdown can open and options can be clicked.
beforeAll(() => {
  if (!HTMLElement.prototype.hasPointerCapture) {
    HTMLElement.prototype.hasPointerCapture = () => false;
  }
  if (!HTMLElement.prototype.setPointerCapture) {
    HTMLElement.prototype.setPointerCapture = () => undefined;
  }
  if (!HTMLElement.prototype.releasePointerCapture) {
    HTMLElement.prototype.releasePointerCapture = () => undefined;
  }
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = () => undefined;
  }
});

// ── Member ID constants (from households fixture) ─────────────────────────────

const aliceMemberId = 'mem-alice-001';
const bobMemberId = 'mem-bob-001';

// ── Task fixtures ─────────────────────────────────────────────────────────────

/** Alice created this task — she can delete and reassign it. */
const aliceTask = {
  _id: 'task-alice-001',
  householdId: mockHousehold._id,
  title: 'Clean the bathroom',
  createdByUserId: mockUsers.alice._id,
  isCompleted: false,
  createdAt: '2026-05-10T00:00:00.000Z',
  updatedAt: '2026-05-10T00:00:00.000Z',
};

/** Bob created this task — Alice (non-admin) cannot delete it. */
const bobTask = {
  _id: 'task-bob-001',
  householdId: mockHousehold._id,
  title: 'Take out the bins',
  createdByUserId: mockUsers.bob._id,
  isCompleted: false,
  createdAt: '2026-05-10T00:00:00.000Z',
  updatedAt: '2026-05-10T00:00:00.000Z',
};

// ── Rotation status fixture ───────────────────────────────────────────────────

const rotationStatus = {
  currentMemberId: aliceMemberId,
  currentNickname: 'Alice',
  nextMemberId: bobMemberId,
  nextNickname: 'Bob',
  periodDays: 7,
  nextPeriodStartDate: '2026-05-19T00:00:00.000Z',
};

// ── Render helpers ────────────────────────────────────────────────────────────

const renderTasksPage = (household = mockHousehold) =>
  renderWithProviders(
    <DashboardProvider household={household} currentUserId={mockUsers.alice._id}>
      <TasksPage />
    </DashboardProvider>,
  );

// ── Default GET handlers (overridden per-test as needed) ──────────────────────

beforeEach(() => {
  server.use(
    http.get('/api/households/:id/tasks', () =>
      HttpResponse.json({
        status: 'success',
        data: {
          items: [aliceTask, bobTask],
          nextCursor: null,
        },
      }),
    ),
    http.get('/api/households/:id/goals', () =>
      HttpResponse.json({
        status: 'success',
        data: { items: [], total: 0, page: 1, limit: 20 },
      }),
    ),
    // TasksPage calls useRecurringTasks when taskLevel === 'full'
    http.get('/api/households/:id/recurring-tasks', () =>
      HttpResponse.json({ status: 'success', data: { items: [] } }),
    ),
  );
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('<TasksPage /> flows', () => {
  /**
   * J.1 — Fixed mode: selecting a different member in the AssignSelect fires
   * PATCH /assign with the new memberId.
   * canReassign = task.createdByUserId === currentUserId → must use aliceTask.
   */
  it('J.1 — Fixed mode: reassign task fires PATCH /assign with new memberId', async () => {
    let assignBody: unknown = null;
    server.use(
      http.patch('/api/households/:hid/tasks/:tid/assign', async ({ request }) => {
        assignBody = await request.json();
        return HttpResponse.json({
          status: 'success',
          data: {
            task: {
              ...aliceTask,
              assignedToMemberId: bobMemberId,
              assignedToNickname: 'Bob',
            },
          },
        });
      }),
    );
    const user = userEvent.setup();
    renderTasksPage(mockHouseholdTaskFixed);
    // Expand Alice's task row
    await user.click(await screen.findByText('Clean the bathroom'));
    // AssignSelect should be present (canReassign = true, distribution = fixed)
    // The select trigger is visible with placeholder "Unassigned"
    const selectTrigger = await screen.findByRole('combobox');
    await user.click(selectTrigger);
    // Choose Bob from the dropdown
    const bobOption = await screen.findByRole('option', { name: 'Bob' });
    await user.click(bobOption);
    await waitFor(() =>
      expect(assignBody).toEqual(
        expect.objectContaining({ assignedToMemberId: bobMemberId }),
      ),
    );
  });

  /**
   * J.2 — SetRotationDialog confirm fires PATCH /rotation with startMemberId.
   * The dialog is opened via the RotationBanner's "Set rotation" / "Edit cycle" button.
   * The household has distribution='rotation' (mockHouseholdTaskRotation).
   * Alice is admin/owner so she sees the "Edit cycle" button in the banner.
   */
  it('J.2 — SetRotationDialog confirm fires PATCH /rotation with startMemberId', async () => {
    let rotationBody: unknown = null;
    server.use(
      http.get('/api/households/:id/tasks', () =>
        HttpResponse.json({
          status: 'success',
          data: {
            items: [aliceTask],
            nextCursor: null,
            rotation: rotationStatus,
          },
        }),
      ),
      http.patch('/api/households/:id/tasks/rotation', async ({ request }) => {
        rotationBody = await request.json();
        return HttpResponse.json({
          status: 'success',
          data: { rotation: rotationStatus },
        });
      }),
    );
    const user = userEvent.setup();
    renderTasksPage(mockHouseholdTaskRotation);
    // Wait for rotation banner to appear
    const editCycleButton = await screen.findByRole('button', { name: /edit cycle/i });
    await user.click(editCycleButton);
    // SetRotationDialog appears with "Confirm" button
    const confirmButton = await screen.findByRole('button', { name: /confirm/i });
    await user.click(confirmButton);
    await waitFor(() =>
      expect(rotationBody).toEqual(
        expect.objectContaining({ startMemberId: expect.any(String) }),
      ),
    );
  });

  /**
   * J.3 — Voluntary mode: clicking "Claim this task" fires PATCH /assign
   * with Alice's memberId (myMemberId).
   */
  it('J.3 — Voluntary mode: Claim button fires PATCH /assign with my memberId', async () => {
    let assignBody: unknown = null;
    server.use(
      http.patch('/api/households/:hid/tasks/:tid/assign', async ({ request }) => {
        assignBody = await request.json();
        return HttpResponse.json({
          status: 'success',
          data: {
            task: {
              ...aliceTask,
              assignedToMemberId: aliceMemberId,
              assignedToNickname: 'Alice',
            },
          },
        });
      }),
    );
    const user = userEvent.setup();
    renderTasksPage(mockHouseholdTaskVoluntary);
    // Expand Alice's task row
    await user.click(await screen.findByText('Clean the bathroom'));
    // "Claim this task" appears for unassigned tasks in voluntary mode
    const claimButton = await screen.findByRole('button', { name: /claim this task/i });
    await user.click(claimButton);
    await waitFor(() =>
      expect(assignBody).toEqual(
        expect.objectContaining({ assignedToMemberId: aliceMemberId }),
      ),
    );
  });

  /**
   * J.4 — Toggle complete: clicking the "Mark as done" button in the expanded
   * panel fires PATCH /complete.
   */
  it('J.4 — Toggle complete: Mark as done button fires PATCH /complete', async () => {
    let completeCalled = false;
    server.use(
      http.patch('/api/households/:hid/tasks/:tid/complete', () => {
        completeCalled = true;
        return HttpResponse.json({
          status: 'success',
          data: {
            task: { ...aliceTask, isCompleted: true, completedByNickname: 'Alice' },
          },
        });
      }),
    );
    const user = userEvent.setup();
    renderTasksPage();
    // Expand Alice's task row (title is unique)
    await user.click(await screen.findByText('Clean the bathroom'));
    const markDoneButton = await screen.findByRole('button', { name: /mark as done/i });
    await user.click(markDoneButton);
    await waitFor(() => expect(completeCalled).toBe(true));
  });

  /**
   * J.5 — Delete (creator): Alice created the task, so she sees "Delete task".
   * Clicking it shows inline confirm; clicking "Yes, delete" fires DELETE.
   */
  it('J.5 — Delete (creator): ConfirmDeleteDialog → DELETE fires', async () => {
    let deleteCalled = false;
    server.use(
      http.delete('/api/households/:hid/tasks/:tid', () => {
        deleteCalled = true;
        return HttpResponse.json({ status: 'success', message: 'Deleted' });
      }),
    );
    const user = userEvent.setup();
    renderTasksPage();
    // Expand Alice's task row
    await user.click(await screen.findByText('Clean the bathroom'));
    // Delete task button (canDelete = true — Alice is creator)
    const deleteButton = await screen.findByRole('button', { name: /delete task/i });
    await user.click(deleteButton);
    // Inline confirm dialog
    const confirmDelete = await screen.findByRole('button', { name: /yes, delete/i });
    await user.click(confirmDelete);
    await waitFor(() => expect(deleteCalled).toBe(true));
  });

  /**
   * J.6 — Delete button hidden for non-creator non-admin viewers.
   * Bob created bobTask; Alice (non-admin) is not the creator, so no "Delete task" button.
   * Note: mockHousehold has Alice as 'owner' role, so we need to use bob's view.
   * We render with Bob as currentUserId for a task that Alice created — Bob cannot delete.
   */
  it('J.6 — Delete button hidden for non-creator non-admin viewers', async () => {
    server.use(
      http.get('/api/households/:id/tasks', () =>
        HttpResponse.json({
          status: 'success',
          data: { items: [aliceTask], nextCursor: null },
        }),
      ),
    );
    // Render as Bob (member role, not creator of aliceTask)
    const user = userEvent.setup();
    renderWithProviders(
      <DashboardProvider household={mockHousehold} currentUserId={mockUsers.bob._id}>
        <TasksPage />
      </DashboardProvider>,
    );
    // Expand Alice's task row (Bob is viewing it)
    await user.click(await screen.findByText('Clean the bathroom'));
    // Wait for expanded panel to be fully visible (Mark as done should be there)
    await screen.findByRole('button', { name: /mark as done/i });
    // Delete task button should NOT be present (Bob is not creator, not admin)
    expect(screen.queryByRole('button', { name: /delete task/i })).not.toBeInTheDocument();
  });

  /**
   * J.7 — Cache invalidation on complete failure.
   * useToggleTaskComplete has onSettled that always invalidates queries,
   * even on error. Count GET /tasks calls before and after a failing PATCH.
   * If onSettled is removed, no second GET fires and this test fails.
   */
  it('J.7 — Cache invalidation fires GET /tasks after PATCH /complete failure', async () => {
    let getCallCount = 0;
    server.use(
      http.get('/api/households/:id/tasks', () => {
        getCallCount += 1;
        return HttpResponse.json({
          status: 'success',
          data: { items: [aliceTask], nextCursor: null },
        });
      }),
      http.patch('/api/households/:hid/tasks/:tid/complete', () =>
        HttpResponse.json(
          { status: 'error', message: 'Task already completed by another member' },
          { status: 409 },
        ),
      ),
      // Override goals and recurring-tasks for this specific test
      http.get('/api/households/:id/goals', () =>
        HttpResponse.json({ status: 'success', data: { items: [], total: 0, page: 1, limit: 20 } }),
      ),
      http.get('/api/households/:id/recurring-tasks', () =>
        HttpResponse.json({ status: 'success', data: { items: [] } }),
      ),
    );
    const user = userEvent.setup();
    renderTasksPage();
    // Wait for initial load
    await screen.findByText('Clean the bathroom');
    // Record the number of GETs so far (initial fetch)
    const initialGets = getCallCount;
    // Expand the task row
    await user.click(screen.getByText('Clean the bathroom'));
    // Click Mark as done → fires failing PATCH /complete
    const markDoneButton = await screen.findByRole('button', { name: /mark as done/i });
    await user.click(markDoneButton);
    // onSettled fires after mutation settles (success OR error) → invalidates tasks query
    // → another GET /tasks fires
    await waitFor(() => expect(getCallCount).toBeGreaterThan(initialGets));
  });
});
