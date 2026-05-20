import { Outlet } from 'react-router-dom';

import { DashboardProvider } from '@/contexts/DashboardContext';
import AppLayout from '@/components/layout/AppLayout';
import type { HouseholdResponse } from '@/types/household.types';

interface CoupleDashboardShellProps {
  household: HouseholdResponse;
  currentUserId: string;
}

export default function CoupleDashboardShell({
  household,
  currentUserId,
}: CoupleDashboardShellProps) {
  return (
    <DashboardProvider household={household} currentUserId={currentUserId}>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </DashboardProvider>
  );
}
