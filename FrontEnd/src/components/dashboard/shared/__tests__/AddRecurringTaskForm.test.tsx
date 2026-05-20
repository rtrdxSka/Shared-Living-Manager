import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import AddRecurringTaskForm from '@/components/dashboard/shared/AddRecurringTaskForm';
import { renderWithProviders } from '@/test/utils/renderWithProviders';
import { mockHousehold } from '@/test/mocks/data/households';
import { server } from '@/test/mocks/server';

describe('<AddRecurringTaskForm />', () => {
  it('renders title and repeats label', () => {
    renderWithProviders(
      <AddRecurringTaskForm open={true} onOpenChange={vi.fn()} householdId={mockHousehold._id} />,
    );
    expect(screen.getByText('TITLE')).toBeInTheDocument();
    expect(screen.getByText('REPEATS')).toBeInTheDocument();
  });

  it('submits and closes', async () => {
    server.use(
      http.post(`/api/households/${mockHousehold._id}/recurring-tasks`, () =>
        HttpResponse.json({ status: 'success', data: { recurringTask: { _id: 'rt1' } } }),
      ),
    );
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <AddRecurringTaskForm open={true} onOpenChange={onOpenChange} householdId={mockHousehold._id} />,
    );
    const inputs = screen.getAllByRole('textbox');
    await user.type(inputs[0], 'Take out trash');
    await user.click(screen.getByRole('button', { name: /create recurring task/i }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false), { timeout: 2000 });
  });
});
