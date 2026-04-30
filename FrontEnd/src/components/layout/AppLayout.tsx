import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import {
  LayoutDashboard,
  Receipt,
  CheckSquare,
  Target,
  ShoppingCart,
  Wallet,
  UserPlus,
  User,
  LogOut,
  Sun,
  Moon,
  MoreHorizontal,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarGroup } from '@/components/ui/avatar';
import { EyebrowLabel } from '@/components/ui/eyebrow-label';
import { useDashboard } from '@/contexts/DashboardContext';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import LeaveShoppingPromptDialog from '@/components/dashboard/shared/LeaveShoppingPromptDialog';

// ── Nav items ─────────────────────────────────────────────────────────────

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

function useNavItems(): NavItem[] {
  const { household, financeMode, taskLevel, overdueCount } = useDashboard();

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

  if (household?.uiMode === 'couple') {
    items.push({
      id: 'shopping-list',
      label: 'Shopping',
      href: '/dashboard/shopping-list',
      icon: ShoppingCart,
    });
  }

  items.push({ id: 'goals', label: 'Goals', href: '/dashboard/goals', icon: Target });
  items.push({ id: 'invite', label: 'Invite', href: '/dashboard/invite', icon: UserPlus });

  if (financeMode === 'joint') {
    items.push({ id: 'account', label: 'Account', href: '/dashboard/account', icon: Wallet });
  }

  return items;
}

const PRIMARY_NAV_IDS = ['overview', 'expenses', 'tasks', 'goals'] as const;

// ── Leave-guard nav click handler ─────────────────────────────────────────

/**
 * Intercepts nav clicks while the user is on the shopping-list page with
 * bought items not yet converted to an expense. Pops the leave-guard dialog
 * (state in DashboardContext, rendered at AppLayout root) and stashes the
 * intended destination so the dialog's actions can complete or cancel the
 * navigation.
 */
function useGuardedNavClick(setLeavePromptOpen: (o: boolean) => void) {
  const location = useLocation();
  const { shoppingListBoughtCount, setPendingNavigationPath } = useDashboard();

  return useCallback(
    (e: React.MouseEvent, href: string) => {
      const onShoppingPage = location.pathname.startsWith('/dashboard/shopping-list');
      const navigatingAway = !href.startsWith('/dashboard/shopping-list');
      if (onShoppingPage && navigatingAway && shoppingListBoughtCount > 0) {
        e.preventDefault();
        setPendingNavigationPath(href);
        setLeavePromptOpen(true);
      }
    },
    [location.pathname, shoppingListBoughtCount, setPendingNavigationPath, setLeavePromptOpen]
  );
}

// ── Sidebar nav item ──────────────────────────────────────────────────────

function SidebarItem({
  item,
  isActive,
  onNavClick,
}: {
  item: NavItem;
  isActive: boolean;
  onNavClick: (e: React.MouseEvent, href: string) => void;
}) {
  return (
    <Link
      to={item.href}
      aria-current={isActive ? 'page' : undefined}
      onClick={(e) => onNavClick(e, item.href)}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'bg-accent text-accent-ink shadow-accent-glow'
          : 'text-ink-3 hover:bg-surface-2 hover:text-ink'
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{item.label}</span>
      {item.badge != null && (
        isActive ? (
          <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-accent-ink/15 px-1 text-[10px] font-semibold text-accent-ink">
            {item.badge}
          </span>
        ) : (
          <Badge variant="destructive" className="h-5 min-w-[1.25rem] justify-center px-1 text-[10px]">
            {item.badge}
          </Badge>
        )
      )}
    </Link>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────

function Sidebar({ onNavClick }: { onNavClick: (e: React.MouseEvent, href: string) => void }) {
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

  return (
    <aside className="hidden md:flex w-[248px] shrink-0 flex-col border-r border-line bg-bg-sub">
      {/* Brand block */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-line">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent">
          <span className="font-mono font-semibold text-sm text-accent-ink">H</span>
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-ink leading-tight">HouseMate</span>
          <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-ink-3 leading-tight mt-0.5">
            for two
          </span>
        </div>
      </div>

      {/* Household card */}
      <div className="px-3 py-3 border-b border-line">
        <div className="rounded-xl bg-surface-2 p-3">
          <EyebrowLabel as="div" className="mb-1.5">HOUSEHOLD</EyebrowLabel>
          <p className="text-sm font-semibold text-ink leading-tight truncate">{household.name}</p>
          <div className="flex items-center gap-2 mt-2">
            <AvatarGroup ringColor="surface-2">
              <Avatar name={myNickname} size={24} variant="filled" />
              <Avatar name={partnerNickname} size={24} variant="filled" />
            </AvatarGroup>
            <span className="text-xs text-ink-3">{myNickname} &amp; {partnerNickname}</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <SidebarItem
            key={item.id}
            item={item}
            isActive={location.pathname === item.href}
            onNavClick={onNavClick}
          />
        ))}
      </nav>

      {/* Footer nav */}
      <div className="border-t border-line px-2 py-3 space-y-1">
        <Link
          to="/profile"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <User className="h-4 w-4 shrink-0" />
          Profile
        </Link>
        <button
          onClick={toggleTheme}
          className="relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <Sun className="h-4 w-4 shrink-0 rotate-0 scale-100 transition-transform dark:rotate-90 dark:scale-0" />
          <Moon className="absolute left-3 h-4 w-4 shrink-0 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
          <span>Theme</span>
        </button>
        <button
          onClick={() => void handleLogout()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-3 transition-colors hover:bg-surface-2 hover:text-neg"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Logout
        </button>
      </div>
    </aside>
  );
}

// ── More sheet (mobile) ───────────────────────────────────────────────────

interface MoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  overflowItems: NavItem[];
  onNavClick: (e: React.MouseEvent, href: string) => void;
}

function MoreSheet({ open, onOpenChange, overflowItems, onNavClick }: MoreSheetProps) {
  const { household, myNickname, partnerNickname } = useDashboard();
  const { logout } = useAuth();
  const { toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    onOpenChange(false);
  }, [location.pathname, onOpenChange]);

  const handleLogout = async () => {
    onOpenChange(false);
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl p-0 max-h-[85vh] overflow-y-auto">
        <SheetTitle className="sr-only">More options</SheetTitle>

        {/* Drag handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-line-2" />
        </div>

        {/* Household context */}
        <div className="px-3 py-3">
          <div className="rounded-xl bg-surface-2 p-3">
            <EyebrowLabel as="div" className="mb-1.5">HOUSEHOLD</EyebrowLabel>
            <p className="text-sm font-semibold text-ink leading-tight truncate">{household.name}</p>
            <div className="flex items-center gap-2 mt-2">
              <AvatarGroup ringColor="surface-2">
                <Avatar name={myNickname} size={24} variant="filled" />
                <Avatar name={partnerNickname} size={24} variant="filled" />
              </AvatarGroup>
              <span className="text-xs text-ink-3">{myNickname} &amp; {partnerNickname}</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Overflow nav items (Invite, Account) */}
        {overflowItems.length > 0 && (
          <>
            <nav className="space-y-1 px-2 py-2">
              {overflowItems.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.id}
                    to={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={(e) => onNavClick(e, item.href)}
                    className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {item.badge != null && (
                      <Badge variant="destructive" className="h-5 min-w-[1.25rem] justify-center px-1 text-[10px]">
                        {item.badge}
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </nav>
            <Separator />
          </>
        )}

        {/* Profile, Theme, Logout */}
        <div className="space-y-1 px-2 py-2">
          <Link
            to="/profile"
            className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <User className="h-5 w-5 shrink-0" />
            Profile
          </Link>
          <button
            onClick={toggleTheme}
            className="relative flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <Sun className="h-5 w-5 shrink-0 rotate-0 scale-100 transition-transform dark:rotate-90 dark:scale-0" />
            <Moon className="absolute left-3 h-5 w-5 shrink-0 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
            <span>Theme</span>
          </button>
          <button
            onClick={() => void handleLogout()}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-ink-3 transition-colors hover:bg-surface-2 hover:text-neg"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            Logout
          </button>
        </div>

        <div className="h-4" />
      </SheetContent>
    </Sheet>
  );
}

// ── Mobile bottom nav ─────────────────────────────────────────────────────

function MobileBottomNav({ onNavClick }: { onNavClick: (e: React.MouseEvent, href: string) => void }) {
  const location = useLocation();
  const navItems = useNavItems();
  const [moreOpen, setMoreOpen] = useState(false);

  const primaryItems = navItems.filter((item) =>
    (PRIMARY_NAV_IDS as readonly string[]).includes(item.id)
  );
  const overflowItems = navItems.filter(
    (item) => !(PRIMARY_NAV_IDS as readonly string[]).includes(item.id)
  );
  const hasOverflowBadge = overflowItems.some((item) => item.badge != null && item.badge > 0);

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center border-t border-line bg-bg md:hidden">
        {primaryItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.id}
              to={item.href}
              aria-current={isActive ? 'page' : undefined}
              onClick={(e) => onNavClick(e, item.href)}
              className={cn(
                'relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                isActive ? 'text-accent' : 'text-ink-3'
              )}
            >
              <div className="relative">
                <item.icon className="h-5 w-5" />
                {item.badge != null && (
                  <span className="absolute -right-2 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-0.5 text-[9px] font-bold text-destructive-foreground">
                    {item.badge}
                  </span>
                )}
              </div>
              <span>{item.label}</span>
              {isActive && (
                <span className="absolute bottom-1.5 h-1 w-6 rounded-full bg-accent" />
              )}
            </Link>
          );
        })}

        {/* More tab */}
        <button
          onClick={() => setMoreOpen(true)}
          aria-label="More"
          className={cn(
            'relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
            moreOpen ? 'text-accent' : 'text-ink-3'
          )}
        >
          <div className="relative">
            <MoreHorizontal className="h-5 w-5" />
            {hasOverflowBadge && (
              <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-destructive" />
            )}
          </div>
          <span>More</span>
          {moreOpen && (
            <span className="absolute bottom-1.5 h-1 w-6 rounded-full bg-accent" />
          )}
        </button>
      </nav>

      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} overflowItems={overflowItems} onNavClick={onNavClick} />
    </>
  );
}

// ── App Layout ────────────────────────────────────────────────────────────

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();
  const {
    shoppingListBoughtCount,
    pendingNavigationPath,
    setPendingNavigationPath,
    shoppingListConvertHandler,
  } = useDashboard();
  const [leavePromptOpen, setLeavePromptOpen] = useState(false);

  const handleNavClick = useGuardedNavClick(setLeavePromptOpen);

  function handleConvertNow() {
    setLeavePromptOpen(false);
    if (shoppingListConvertHandler) shoppingListConvertHandler();
    // Note: pendingNavigationPath stays set; v1 does not auto-navigate after expense submit.
  }

  function handleLeaveAnyway() {
    setLeavePromptOpen(false);
    if (pendingNavigationPath) {
      const target = pendingNavigationPath;
      setPendingNavigationPath(null);
      navigate(target);
    }
  }

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar onNavClick={handleNavClick} />

      {/* Main content — pb-20 on mobile to clear bottom nav */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        {children}
      </main>

      <MobileBottomNav onNavClick={handleNavClick} />

      <LeaveShoppingPromptDialog
        open={leavePromptOpen}
        boughtCount={shoppingListBoughtCount}
        onConvertNow={handleConvertNow}
        onLeaveAnyway={handleLeaveAnyway}
      />
    </div>
  );
}
