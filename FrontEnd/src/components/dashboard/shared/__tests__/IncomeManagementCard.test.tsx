import { describe, it, expect } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import IncomeManagementCard from '@/components/dashboard/shared/IncomeManagementCard';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils/renderWithProviders';
import { mockHousehold } from '@/test/mocks/data/households';

const INCOME_URL = `/api/households/${mockHousehold._id}/members/me/income`;

const baseProps = {
  household: mockHousehold,
  currentUserId: 'user-alice-001',
  currency: 'EUR' as const,
};

describe('<IncomeManagementCard />', () => {
  it("renders the current user's monthly income", () => {
    renderWithProviders(<IncomeManagementCard {...baseProps} />);
    // Alice's monthlyIncome is 3000 — MoneyAmount renders it as "3,000" or "3000"
    expect(screen.getByText(/3[,.]?000/)).toBeInTheDocument();
  });

  it('submits an edit and updates the displayed value', async () => {
    let received: unknown = null;
    server.use(
      http.patch(INCOME_URL, async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({
          status: 'success',
          data: {
            household: {
              ...mockHousehold,
              members: mockHousehold.members.map((m) =>
                m.userId === 'user-alice-001' ? { ...m, monthlyIncome: 3500 } : m,
              ),
            },
          },
        });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<IncomeManagementCard {...baseProps} />);

    // Alice has income set so starts in view mode — click Edit
    await user.click(screen.getByRole('button', { name: /edit/i }));

    const input =
      screen.queryByRole('spinbutton') ??
      screen.queryByLabelText(/income|amount/i) ??
      screen.getAllByRole('textbox')[0];
    await user.clear(input!);
    await user.type(input!, '3500');

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(received).toBeTruthy());
    expect(received).toEqual(expect.objectContaining({ monthlyIncome: 3500 }));
  });

  it('shows an inline error when the API returns 400', async () => {
    server.use(
      http.patch(INCOME_URL, () =>
        HttpResponse.json(
          { status: 'error', message: 'Income must be a positive number' },
          { status: 400 },
        ),
      ),
    );

    const user = userEvent.setup();
    renderWithProviders(<IncomeManagementCard {...baseProps} />);

    await user.click(screen.getByRole('button', { name: /edit/i }));

    const input =
      screen.queryByRole('spinbutton') ??
      screen.queryByLabelText(/income|amount/i) ??
      screen.getAllByRole('textbox')[0];
    await user.clear(input!);
    await user.type(input!, '9999');

    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByText(/positive number/i)).toBeInTheDocument();
  });
});
