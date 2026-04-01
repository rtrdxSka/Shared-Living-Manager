import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import {
  LayoutDashboard,
  Receipt,
  CheckSquare,
  Target,
  Wallet,
  User,
  LogOut,
  Sun,
  Moon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useDashboard } from '@/contexts/DashboardContext';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';

// ── Nav items ─────────────────────────────────────────────────────────────

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

function useNavItems(): NavItem[] {
  const { financeMode, taskLevel, overdueCount } = useDashboard();

  const items: NavItem[] = [
    { id: 'overview', label: 'Overview', href: '/dashboard/overview', icon: LayoutDashboard },
    { id: 'expenses', label: 'Expenses', href: '/dashboard/expenses', icon: Receipt },
  ];

  if (taskLevel !== 'disabled') {
    items.push({
      id: 'tasks',
      label: 'Tasks',
      href: '/dashboard/tasks',
      icon: CheckSquare,
      badge: overdueCount > 0 ? overdueCount : undefined,
    });
  }

  items.push({ id: 'goals', label: 'Goals', href: '/dashboard/goals', icon: Target });

  if (financeMode === 'joint') {
    items.push({ id: 'account', label: 'Account', href: '/dashboard/account', icon: Wallet });
  }

  return items;
}

// ── Sidebar nav item ──────────────────────────────────────────────────────

function SidebarItem({ item, isActive }: { item: NavItem; isActive: boolean }) {
  return (
    <Link
      to={item.href}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{item.label}</span>
      {item.badge != null && (
        <Badge variant="destructive" className="h-5 min-w-[1.25rem] justify-center px-1 text-[10px]">
          {item.badge}
        </Badge>
      )}
    </Link>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────

function Sidebar() {
  const { household, myNickname, partnerNickname } = useDashboard();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const navItems = useNavItems();
  const { toggleTheme } = useTheme();

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  // Member initials display
  const membersLabel = `${myNickname} & ${partnerNickname}`;

  return (
    <aside className="hidden md:flex w-[220px] shrink-0 flex-col border-r border-border bg-background">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2 border-b border-border px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
          <span className="text-xs font-bold text-primary-foreground">H</span>
        </div>
        <span className="text-sm font-bold tracking-tight">HouseMate</span>
      </div>

      {/* Household header */}
      <div className="px-4 py-3">
        <p className="text-xs font-semibold text-foreground leading-tight">{household.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{membersLabel}</p>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
        {navItems.map((item) => (
          <SidebarItem
            key={item.id}
            item={item}
            isActive={location.pathname === item.href}
          />
        ))}
      </nav>

      <Separator />

      {/* Bottom actions */}
      <div className="space-y-1 px-2 py-3">
        <Link
          to="/profile"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
        >
          <User className="h-4 w-4 shrink-0" />
          Profile
        </Link>
        <button
          onClick={toggleTheme}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
        >
          <Sun className="h-4 w-4 shrink-0 rotate-0 scale-100 transition-transform dark:rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 shrink-0 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
          <span>Theme</span>
        </button>
        <button
          onClick={() => void handleLogout()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-destructive"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Logout
        </button>
      </div>
    </aside>
  );
}

// ── Mobile bottom nav ─────────────────────────────────────────────────────

function MobileBottomNav() {
  const location = useLocation();
  const navItems = useNavItems();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center border-t border-border bg-background md:hidden">
      {navItems.map((item) => {
        const isActive = location.pathname === item.href;
        return (
          <Link
            key={item.id}
            to={item.href}
            className={cn(
              'relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
              isActive ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <div className="relative">
              <item.icon className={cn('h-5 w-5', isActive && 'text-primary')} />
              {item.badge != null && (
                <span className="absolute -right-2 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-0.5 text-[9px] font-bold text-destructive-foreground">
                  {item.badge}
                </span>
              )}
            </div>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// ── App Layout ────────────────────────────────────────────────────────────

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      {/* Main content — pb-20 on mobile to clear bottom nav */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        {children}
      </main>

      <MobileBottomNav />
    </div>
  );
}
