import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import ConfirmDeleteDialog from '@/components/dashboard/shared/ConfirmDeleteDialog';
import { renderWithProviders } from '@/test/utils/renderWithProviders';

describe('<ConfirmDeleteDialog />', () => {
  it('renders title and description', () => {
    renderWithProviders(
      <ConfirmDeleteDialog
        open={true}
        onOpenChange={vi.fn()}
        title="Delete this item?"
        description="This cannot be undone."
        onConfirm={vi.fn(async () => {})}
      />,
    );
    expect(screen.getByText('Delete this item?')).toBeInTheDocument();
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
  });

  it('calls onConfirm when delete clicked', async () => {
    const onConfirm = vi.fn(async () => {});
    const user = userEvent.setup();
    renderWithProviders(
      <ConfirmDeleteDialog
        open={true}
        onOpenChange={vi.fn()}
        title="X"
        onConfirm={onConfirm}
      />,
    );
    await user.click(screen.getByRole('button', { name: /delete/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onOpenChange(false) when cancel clicked', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <ConfirmDeleteDialog
        open={true}
        onOpenChange={onOpenChange}
        title="X"
        onConfirm={vi.fn(async () => {})}
      />,
    );
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
