import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import DoneShoppingDialog from '@/components/dashboard/shared/DoneShoppingDialog';
import { renderWithProviders } from '@/test/utils/renderWithProviders';

const boughtItems = [
  { _id: 'i1', name: 'Milk', quantity: '2L', category: 'groceries' },
  { _id: 'i2', name: 'Bread', quantity: '', category: 'groceries' },
] as never;

describe('<DoneShoppingDialog />', () => {
  it('lists the bought items', () => {
    renderWithProviders(
      <DoneShoppingDialog
        open={true}
        onOpenChange={vi.fn()}
        boughtItems={boughtItems}
        dominantCategory={'groceries' as never}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText(/milk/i)).toBeInTheDocument();
    expect(screen.getByText(/bread/i)).toBeInTheDocument();
  });

  it('calls onConfirm and closes when user confirms', async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <DoneShoppingDialog
        open={true}
        onOpenChange={onOpenChange}
        boughtItems={boughtItems}
        dominantCategory={'groceries' as never}
        onConfirm={onConfirm}
      />,
    );
    await user.click(screen.getByRole('button', { name: /open expense form/i }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledOnce());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
