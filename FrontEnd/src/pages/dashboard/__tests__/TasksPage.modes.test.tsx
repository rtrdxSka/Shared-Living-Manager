/**
 * TasksPage.modes.test.tsx — Sub-batch J mode-matrix (5 tests)
 *
 * Renders TasksPage with the REAL DashboardProvider for each combination of
 * (taskManagementEnabled × taskDistributionMethod) and asserts a distinctive
 * UI signal per mode.
 *
 * Signal strategy (all inspectable without userEvent interaction):
 *   full + fixed      → DistributionCard shows "Fixed assignment"
 *   full + rotation   → RotationBanner renders a "Set rotation" button (admin, no config)
 *   full + voluntary  → DistributionCard shows "Voluntary claiming"
 *   basic             → "Recurring tasks" button is ABSENT (only full level shows it)
 *   disabled          → tasks still render (no guard in TasksPage); assert title visible
 *
 * Note: the tasks endpoint returns { data: { items, nextCursor } } — the
 * paginated shape used by useTasks (InfiniteQuery). The `data.tasks` shape
 * in the task template was incorrect; this file uses the real API shape.
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import TasksPage from '@/pages/dashboard/TasksPage';
import { DashboardProvider } from '@/contexts/DashboardContext';
import { renderWithProviders } from '@/test/utils/renderWithProviders';
import { server } from '@/test/mocks/server';
import {
  mockHouseholdTaskFixed,
  mockHouseholdTaskRotation,
  mockHouseholdTaskVoluntary,
  mockHouseholdTaskBasic,
  mockHouseholdTaskDisabled,
  mockHouseholdRoommatesSplit,
} from '@/test/mocks/data/households';
import { mockUsers } from '@/test/mocks/data/users';

// Radix UI <Select> pointer-capture + scrollIntoView APIs absent in jsdom
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

// ── Task fixtures ─────────────────────────────────────────────────────────────

/** Alice created this task — used across all mode tests. */
const taskAlice = {
  _id: 'task-001',
  householdId: 'hh-couple-001',
  title: 'Wash dishes',
  isCompleted: false,
  createdByUserId: mockUsers.alice._id,
  assignedToMemberId: 'mem-alice-001',
  assignedToNickname: 'Alice',
  createdAt: '2026-05-10T00:00:00.000Z',
  updatedAt: '2026-05-10T00:00:00.000Z',
};

/** Unassigned task — used to verify Claim button in voluntary mode. */
const taskUnassigned = {
  ...taskAlice,
  _id: 'task-002',
  title: 'Vacuum living room',
  assignedToMemberId: null,
  assignedToNickname: null,
};

// ── Render helper ─────────────────────────────────────────────────────────────

const renderTasks = (
  household: typeof mockHouseholdTaskFixed,
  currentUserId: string = mockUsers.alice._id,
) =>
  renderWithProviders(
    <DashboardProvider household={household} currentUserId={currentUserId}>
      <TasksPage />
    </DashboardProvider>,
  );

// ── MSW handlers (reset per-test) ─────────────────────────────────────────────

beforeEach(() => {
  server.use(
    // Tasks paginated list — shape expected by useTasks (InfiniteQuery)
    http.get('/api/households/:id/tasks', () =>
      HttpResponse.json({
        status: 'success',
        data: {
          items: [taskAlice, taskUnassigned],
          nextCursor: null,
        },
      }),
    ),
    // Goals hoisted by DashboardContext
    http.get('/api/households/:id/goals', () =>
      HttpResponse.json({
        status: 'success',
        data: { items: [], total: 0, page: 1, limit: 20 },
      }),
    ),
    // Recurring tasks — only fetched when taskLevel === 'full'
    http.get('/api/households/:id/recurring-tasks', () =>
      HttpResponse.json({ status: 'success', data: { items: [] } }),
    ),
  );
});

// ── Mode-matrix tests ─────────────────────────────────────────────────────────

describe('<TasksPage /> mode matrix', () => {
  /**
   * J-m.1 — full + fixed
   * Signal: DistributionCard renders "Fixed assignment" (always visible, no
   * row expansion needed). The Rotation banner is absent (distribution ≠ 'rotation').
   */
  it('J-m.1 — full + fixed: DistributionCard shows "Fixed assignment"', async () => {
    renderTasks(mockHouseholdTaskFixed);
    // Wait for tasks to load so the full page renders
    await screen.findByText(/wash dishes/i);
    // DistributionCard is always rendered in the right rail
    expect(screen.getByText(/fixed assignment/i)).toBeInTheDocument();
    // Rotation banner should NOT appear (distribution is 'fixed', not 'rotation')
    expect(
      screen.queryByRole('button', { name: /set rotation|edit cycle/i }),
    ).not.toBeInTheDocument();
  });

  /**
   * J-m.2 — full + rotation
   * Signal: RotationBanner renders because distribution === 'rotation'.
   * Alice is admin/owner; with no rotationConfig, shows "Set rotation" button.
   * With rotationConfig present (mockHouseholdTaskRotation has config), the banner
   * still renders "Edit cycle" once rotationStatus is returned by the API.
   * Without rotationStatus in the response, the no-config branch shows "Set rotation".
   */
  it('J-m.2 — full + rotation: RotationBanner "Set rotation" CTA visible', async () => {
    renderTasks(mockHouseholdTaskRotation);
    await screen.findByText(/wash dishes/i);
    // RotationBanner for admin without rotationStatus shows "Set rotation" button.
    // If rotationStatus present in API response, shows "Edit cycle" instead.
    // Either way, one of these buttons must be present.
    const rotationCta =
      screen.queryByRole('button', { name: /set rotation/i }) ??
      screen.queryByRole('button', { name: /edit cycle/i });
    expect(rotationCta).toBeInTheDocument();
  });

  /**
   * J-m.3 — full + voluntary
   * Signal: DistributionCard shows "Voluntary claiming".
   * The "Claim this task" button itself requires expanding the unassigned task row,
   * but the DistributionCard label is always visible and uniquely identifies this mode.
   */
  it('J-m.3 — full + voluntary: DistributionCard shows "Voluntary claiming"', async () => {
    renderTasks(mockHouseholdTaskVoluntary);
    await screen.findByText(/vacuum living room/i);
    expect(screen.getByText(/voluntary claiming/i)).toBeInTheDocument();
    // Rotation banner must be absent (distribution ≠ 'rotation')
    expect(
      screen.queryByRole('button', { name: /set rotation|edit cycle/i }),
    ).not.toBeInTheDocument();
  });

  /**
   * J-m.4 — basic
   * Signal: "Recurring tasks" button is ABSENT.
   * In TasksPage, the Recurring tasks button is behind `taskLevel === 'full'`.
   * basic mode has taskLevel === 'basic', so the button must not render.
   */
  it('J-m.4 — basic: "Recurring tasks" button absent (taskLevel !== full)', async () => {
    renderTasks(mockHouseholdTaskBasic);
    await screen.findByText(/wash dishes/i);
    // The "Recurring tasks" button only appears when taskLevel === 'full'
    expect(
      screen.queryByRole('button', { name: /recurring tasks/i }),
    ).not.toBeInTheDocument();
  });

  /**
   * J-m.5 — disabled
   * Signal: TasksPage renders no guard for the 'disabled' taskLevel — tasks are
   * still visible. We assert the task title IS present (no hidden/blocked state),
   * AND the "Recurring tasks" button is absent (taskLevel ≠ 'full').
   * This documents the current behaviour: 'disabled' shows the tasks list with
   * the same UI as 'basic' (no distribution-specific UI, no recurring button).
   */
  it('J-m.5 — disabled: tasks still render, no Recurring tasks button', async () => {
    renderTasks(mockHouseholdTaskDisabled);
    // Tasks load and render (TasksPage has no early-return for 'disabled')
    await screen.findByText(/wash dishes/i);
    // "Recurring tasks" button is absent (only full level shows it)
    expect(
      screen.queryByRole('button', { name: /recurring tasks/i }),
    ).not.toBeInTheDocument();
  });

  /**
   * J-m.6 — roommates (uiMode='roommates') + full + fixed
   * Regression test for the bug where the assignment section was gated by
   * `uiMode === 'couple'`, hiding the AssignSelect on the roommates dashboard.
   * Expanding the task should reveal the AssignSelect combobox.
   */
  it('J-m.6 — roommates + full + fixed: AssignSelect renders in expanded task', async () => {
    const roommatesFixed = {
      ...mockHouseholdRoommatesSplit,
      settings: {
        ...mockHouseholdRoommatesSplit.settings,
        taskManagementEnabled: 'full',
        taskDistributionMethod: 'fixed',
      },
    } as typeof mockHouseholdTaskFixed;

    const user = userEvent.setup();
    renderTasks(roommatesFixed);
    // Expand the task created by Alice (canReassign = true since alice is currentUser)
    await user.click(await screen.findByText(/wash dishes/i));
    // AssignSelect renders as a combobox — this fails before the uiMode gate fix
    expect(await screen.findByRole('combobox')).toBeInTheDocument();
  });

  /**
   * J-m.7 — roommates + full + fixed, viewed by a member (non-creator,
   * non-admin) who happens to be the assignee. Auth gating regression test:
   * the AssignSelect must NOT render, and the Delete-task button must NOT
   * render. Mark-as-incomplete (on a completed-by-someone-else task) must
   * be disabled.
   */
  it('J-m.7 — roommates + fixed: non-creator member sees no AssignSelect, no Delete, disabled Mark-incomplete on others\' completed task', async () => {
    const roommatesFixed = {
      ...mockHouseholdRoommatesSplit,
      settings: {
        ...mockHouseholdRoommatesSplit.settings,
        taskManagementEnabled: 'full',
        taskDistributionMethod: 'fixed',
      },
    } as typeof mockHouseholdTaskFixed;

    // Task is created by Alice (owner), assigned to Carol, already completed
    // by Alice 1 hour ago — within the 24h undo window but Carol is NOT the
    // completer, so she should not be able to undo it.
    const completedByAliceTask = {
      _id: 'task-completed-001',
      householdId: 'hh-roommates-001',
      title: 'Take out trash',
      isCompleted: true,
      createdByUserId: mockUsers.alice._id,
      assignedToMemberId: 'mem-carol-001',
      assignedToNickname: 'Carol',
      completedByMemberId: 'mem-alice-001',
      completedByNickname: 'Alice',
      completedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      createdAt: '2026-05-10T00:00:00.000Z',
      updatedAt: '2026-05-10T00:00:00.000Z',
    };

    server.use(
      http.get('/api/households/:id/tasks', () =>
        HttpResponse.json({
          status: 'success',
          data: { items: [completedByAliceTask], nextCursor: null },
        }),
      ),
    );

    const user = userEvent.setup();
    // Render as Carol (a member, non-creator, non-admin).
    renderTasks(roommatesFixed, 'user-carol-001');

    // Expand the task.
    await user.click(await screen.findByText(/take out trash/i));

    // No AssignSelect (Carol is neither creator nor admin and the spec
    // explicitly disallows admin reassign).
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    // No Delete button (Carol is neither creator nor admin).
    expect(screen.queryByRole('button', { name: /delete task/i })).not.toBeInTheDocument();
    // Mark-as-incomplete button DOES render (task is within 24h) but must be
    // disabled — Carol is not the completer.
    const undoBtn = screen.getByRole('button', { name: /mark as incomplete/i });
    expect(undoBtn).toBeDisabled();
  });
});
