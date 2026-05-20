import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import AddTaskForm from '@/components/dashboard/shared/AddTaskForm';
import { renderWithProviders } from '@/test/utils/renderWithProviders';
import { mockHousehold } from '@/test/mocks/data/households';
import { server } from '@/test/mocks/server';

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  householdId: mockHousehold._id,
};

describe('<AddTaskForm />', () => {
  it('renders title field and submit button', () => {
    renderWithProviders(<AddTaskForm {...baseProps} />);
    // Plain <label> with uppercase text
    expect(screen.getByText('TITLE')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add task/i })).toBeInTheDocument();
  });

  it('shows the assignee select only when distributionMethod=fixed and members provided', () => {
    const { rerender } = renderWithProviders(<AddTaskForm {...baseProps} />);
    // No assignee shown without distributionMethod=fixed
    expect(screen.queryByText(/ASSIGN TO/i)).not.toBeInTheDocument();

    rerender(
      <AddTaskForm
        {...baseProps}
        distributionMethod="fixed"
        taskMembers={mockHousehold.members.map((m) => ({
          _id: m._id as string,
          nickname: m.nickname,
        }))}
      />,
    );
    expect(screen.getByText(/ASSIGN TO/i)).toBeInTheDocument();
  });

  it('submits a task and calls onOpenChange(false)', async () => {
    server.use(
      http.post(`/api/households/${mockHousehold._id}/tasks`, () =>
        HttpResponse.json({
          status: 'success',
          data: { task: { _id: 't1', title: 'Mop the floor' } },
        }),
      ),
    );

    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(<AddTaskForm {...baseProps} onOpenChange={onOpenChange} />);

    // Title is the first textbox (placeholder: "e.g. Clean bathroom")
    const titleInput = screen.getByPlaceholderText('e.g. Clean bathroom');
    await user.type(titleInput, 'Mop the floor');

    const submitBtn = screen.getByRole('button', { name: /add task/i });
    expect(submitBtn).not.toBeDisabled();

    await user.click(submitBtn);

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
