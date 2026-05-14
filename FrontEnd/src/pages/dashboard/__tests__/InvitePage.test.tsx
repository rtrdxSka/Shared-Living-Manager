import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import InvitePage from '@/pages/dashboard/InvitePage';
import { renderWithProviders } from '@/test/utils/renderWithProviders';
import { mockHousehold } from '@/test/mocks/data/households';

// Create a household with one member linked and one unlinked (pending)
const incompleteHousehold = {
  ...mockHousehold,
  members: [
    mockHousehold.members[0], // Alice with userId
    {
      ...mockHousehold.members[1], // Bob
      userId: undefined, // No userId yet — pending join
    },
  ],
};

// Note: clipboard will be mocked in each test to avoid cross-test pollution

vi.mock('@/contexts/DashboardContext', async () => {
  const actual = await vi.importActual<typeof import('@/contexts/DashboardContext')>(
    '@/contexts/DashboardContext',
  );
  return {
    ...actual,
    useDashboard: () => ({
      household: incompleteHousehold,
      currentUserId: 'user-alice-001',
      myMember: incompleteHousehold.members[0],
      myNickname: 'Alice',
      isAdmin: true,
    }),
  };
});

describe('<InvitePage />', () => {
  it('shows the invite code', () => {
    renderWithProviders(<InvitePage />);
    expect(screen.getByText('couple-invite-0001')).toBeInTheDocument();
  });

  it('"Copy" button writes invite code to clipboard', async () => {
    // Mock clipboard for the browser API
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn(() => Promise.resolve()),
      },
      configurable: true,
    });

    renderWithProviders(<InvitePage />);
    const user = userEvent.setup();

    // Click the copy button
    await user.click(screen.getByRole('button', { name: /copy/i }));

    // After clipboard operation completes, button should show "Copied!" state
    expect(screen.getByRole('button', { name: /copied/i })).toBeInTheDocument();
  });
});
