import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import SetRotationDialog from '@/components/dashboard/shared/SetRotationDialog';
import { renderWithProviders } from '@/test/utils/renderWithProviders';
import { mockHousehold } from '@/test/mocks/data/households';

const taskMembers = mockHousehold.members;
const firstMemberId = taskMembers[0]._id;

describe('<SetRotationDialog />', () => {
  it('renders the starts-with select with members', () => {
    renderWithProviders(
      <SetRotationDialog
        open={true}
        onOpenChange={vi.fn()}
        taskMembers={taskMembers}
        onConfirm={vi.fn(async () => {})}
      />,
    );
    expect(screen.getByText(/starts with/i)).toBeInTheDocument();
    expect(screen.getByText('Configure Rotation')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('calls onConfirm with the selected member id when confirm button is clicked', async () => {
    const onConfirm = vi.fn(async () => {});
    const user = userEvent.setup();
    renderWithProviders(
      <SetRotationDialog
        open={true}
        onOpenChange={vi.fn()}
        taskMembers={taskMembers}
        onConfirm={onConfirm}
      />,
    );
    await user.click(screen.getByRole('button', { name: /confirm/i }));
    expect(onConfirm).toHaveBeenCalledWith(firstMemberId);
  });

  it('does not render when open=false', () => {
    renderWithProviders(
      <SetRotationDialog
        open={false}
        onOpenChange={vi.fn()}
        taskMembers={taskMembers}
        onConfirm={vi.fn(async () => {})}
      />,
    );
    expect(screen.queryByText(/starts with/i)).not.toBeInTheDocument();
  });
});
