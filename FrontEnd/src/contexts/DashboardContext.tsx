import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { DashboardContext } from './useDashboard';

import type { HouseholdResponse, HouseholdMemberResponse } from '@/types/household.types';
import type { ExpenseResponse } from '@/types/expense.types';
import type { GoalResponse } from '@/types/goal.types';
import type { TaskResponse, RotationStatus } from '@/types/task.types';
import type { TransactionType } from '@/types/joint-account.types';
import type {
  FinanceMode,
  ExpenseSplitMethod,
  TaskManagementLevel,
  TaskDistributionMethod,
  UIMode,
} from '@/types/onboarding.types';

import {
  useDeleteExpense,
  useClaimExpense,
  useClaimPayback,
  useConfirmPayback,
  useDisputePayback,
  useDeactivateRecurringExpense,
  useToggleTaskComplete,
  useDeleteTask,
  useAssignTask,
  useSetRotation,
  useDeactivateRecurringTask,
  useGoals,
  useUpdateGoal,
  useDeleteGoal,
  useRemoveContribution,
  useUpdateSettings,
  useDeleteJointTransaction,
  useJointAccountSummary,
  useTasks,
} from '@/hooks/queries';

import { deriveIncomeSplit, deriveCustomSplit, deriveRoommateCustomShares, getDueDateStatus, currentMonthString } from '@/utils/dashboardHelpers';

import AddExpenseForm from '@/components/dashboard/shared/AddExpenseForm';
import AddTaskForm from '@/components/dashboard/shared/AddTaskForm';
import AddGoalForm from '@/components/dashboard/shared/AddGoalForm';
import AddContributionDialog from '@/components/dashboard/shared/AddContributionDialog';
import AddRecurringTaskForm from '@/components/dashboard/shared/AddRecurringTaskForm';
import AddTransactionForm from '@/components/dashboard/shared/AddTransactionForm';
import SetRotationDialog from '@/components/dashboard/shared/SetRotationDialog';

// Module-level stable empty arrays so fallback identity doesn't churn each
// render when the query data is undefined — critical for useMemo stability.
const EMPTY_TASKS: TaskResponse[] = [];
const EMPTY_GOALS: GoalResponse[] = [];

// ── Context Value ─────────────────────────────────────────────────────────

export interface DashboardContextValue {
  // Core data
  household: HouseholdResponse;
  currentUserId: string;
  uiMode: UIMode;

  // Derived member data
  myMember: HouseholdMemberResponse | undefined;
  partnerMember: HouseholdMemberResponse | undefined;
  myNickname: string;
  partnerNickname: string;
  currency: string;
  myMemberId: string;
  isAdmin: boolean;
  myParticipatesInFinances: boolean;
  hasFinancialPartner: boolean;
  taskMembers: HouseholdMemberResponse[];
  roommateMembers: HouseholdMemberResponse[];
  roommateNicknames: string[];

  // Settings (derived from household)
  financeMode: FinanceMode;
  splitMethod: ExpenseSplitMethod;
  taskLevel: TaskManagementLevel;
  distribution: TaskDistributionMethod;
  customMyPct: number;
  setCustomMyPct: (v: number) => void;
  /** Per-member roommate custom split, seeded from settings (even-split fallback). */
  customShares: { userId: string; nickname: string; pct: number }[];
  incomeSplit: { myPct: number; partnerPct: number } | null;

  // Hoisted data (always fetched — needed by sidebar badge + multiple pages)
  tasks: TaskResponse[];
  rotationStatus: RotationStatus | null;
  tasksLoading: boolean;
  goals: GoalResponse[];
  goalsLoading: boolean;
  overdueCount: number;

  // Sheet open/close state
  addExpenseOpen: boolean;
  setAddExpenseOpen: (o: boolean) => void;
  editingExpense: ExpenseResponse | null;
  setEditingExpense: (e: ExpenseResponse | null) => void;

  addTaskOpen: boolean;
  setAddTaskOpen: (o: boolean) => void;
  addRecurringTaskOpen: boolean;
  setAddRecurringTaskOpen: (o: boolean) => void;
  rotationConfigOpen: boolean;
  setRotationConfigOpen: (o: boolean) => void;

  addGoalOpen: boolean;
  setAddGoalOpen: (o: boolean) => void;
  contributionTarget: GoalResponse | null;
  setContributionTarget: (g: GoalResponse | null) => void;

  addTransactionOpen: boolean;
  setAddTransactionOpen: (o: boolean) => void;
  openTransactionForm: (type: TransactionType) => void;

  // Mutation functions
  deleteExpense: (id: string) => Promise<void>;
  claimExpense: (id: string) => Promise<void>;
  claimPayback: (id: string) => Promise<void>;
  confirmPayback: (args: { expenseId: string; debtorUserId: string }) => Promise<void>;
  disputePayback: (args: { expenseId: string; debtorUserId: string }) => Promise<void>;
  deactivateRecurringExpense: (id: string) => Promise<void>;
  toggleTaskComplete: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  assignTask: (taskId: string, memberId: string | null) => Promise<void>;
  setRotation: (startMemberId: string) => Promise<void>;
  deactivateRecurringTask: (id: string) => Promise<void>;
  updateGoal: (goalId: string, input: { status: 'completed' | 'abandoned' }) => Promise<void>;
  deleteGoal: (goalId: string) => Promise<void>;
  removeContribution: (goalId: string, contributionId: string) => Promise<void>;
  deleteJointTransaction: (txId: string) => Promise<void>;
  handleFinanceModeChange: (v: FinanceMode) => Promise<void>;
  handleSplitMethodChange: (v: ExpenseSplitMethod) => Promise<void>;
  handleCustomPctCommit: (v: number) => Promise<void>;
  handleCustomSharesCommit: (shares: { userId: string; pct: number }[]) => Promise<void>;
}

// ── Provider ──────────────────────────────────────────────────────────────

interface DashboardProviderProps {
  household: HouseholdResponse;
  currentUserId: string;
  children: ReactNode;
}

export function DashboardProvider({ household, currentUserId, children }: DashboardProviderProps) {
  // ── Sheet open/close state ────────────────────────────────────────────
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseResponse | null>(null);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [addRecurringTaskOpen, setAddRecurringTaskOpen] = useState(false);
  const [rotationConfigOpen, setRotationConfigOpen] = useState(false);
  const [addGoalOpen, setAddGoalOpen] = useState(false);
  const [contributionTarget, setContributionTarget] = useState<GoalResponse | null>(null);
  const [addTransactionOpen, setAddTransactionOpen] = useState(false);
  const [transactionFormDefaultType, setTransactionFormDefaultType] = useState<TransactionType | null>(null);

  const openTransactionForm = useCallback((type: TransactionType) => {
    setTransactionFormDefaultType(type);
    setAddTransactionOpen(true);
  }, []);

  // Seed owner-relatively: the stored `customSplitPercentage` is the OWNER's
  // share, so each user's slider starts at THEIR own share (owner → stored,
  // partner → 100 − stored). Kept as state so the slider can drag locally.
  const [customMyPct, setCustomMyPct] = useState(
    () => deriveCustomSplit(household, currentUserId).myPct
  );

  // ── Hoisted queries ───────────────────────────────────────────────────
  const { data: tasksData, isLoading: tasksLoading } = useTasks(household._id);
  // tasksData is InfiniteData<TaskListResult>; flatten pages for downstream
  // consumers that don't paginate (counts, summaries). The TasksPage drives
  // fetchNextPage on its own copy of the same query (shared cache by key).
  const tasks = useMemo(
    () => tasksData?.pages.flatMap((p) => p.items) ?? EMPTY_TASKS,
    [tasksData]
  );
  const rotationStatus = tasksData?.pages[0]?.rotation ?? null;

  const { data: goalsData, isLoading: goalsLoading } = useGoals(household._id);
  const goals = goalsData?.items ?? EMPTY_GOALS;

  // Joint-account summary — fetched only in joint mode so the AddTransactionForm
  // can warn on overdraws. Cache-keyed by month so the AccountPage/OverviewPage
  // share the same in-flight request.
  const isJointMode = (household.settings.financeMode as FinanceMode) === 'joint';
  const { data: jointSummaryForBalance } = useJointAccountSummary(
    household._id,
    currentMonthString(),
    isJointMode
  );
  const currentJointBalance = jointSummaryForBalance?.balance;

  // ── Mutations ─────────────────────────────────────────────────────────
  const deleteExpenseMutation = useDeleteExpense(household._id);
  const claimExpenseMutation = useClaimExpense(household._id);
  const claimPaybackMutation = useClaimPayback(household._id);
  const confirmPaybackMutation = useConfirmPayback(household._id);
  const disputePaybackMutation = useDisputePayback(household._id);
  const deactivateRecurringExpenseMutation = useDeactivateRecurringExpense(household._id);
  const toggleCompleteMutation = useToggleTaskComplete(household._id);
  const deleteTaskMutation = useDeleteTask(household._id);
  const assignTaskMutation = useAssignTask(household._id);
  const setRotationMutation = useSetRotation(household._id);
  const deactivateRecurringTaskMutation = useDeactivateRecurringTask(household._id);
  const updateGoalMutation = useUpdateGoal(household._id);
  const deleteGoalMutation = useDeleteGoal(household._id);
  const removeContributionMutation = useRemoveContribution(household._id);
  const updateSettingsMutation = useUpdateSettings(household._id);
  const deleteJointTxMutation = useDeleteJointTransaction(household._id);

  // ── Derived member data ───────────────────────────────────────────────
  const myMember = household.members.find((m) => m.userId === currentUserId);
  const partnerMember = household.members.find(
    (m) => m.userId && m.userId !== currentUserId && m.participatesInFinances
  );
  const myNickname = myMember?.nickname ?? 'You';
  const partnerNickname = partnerMember?.nickname ?? 'Partner';
  const currency = household.settings.currency ?? 'EUR';
  const myMemberId = myMember?._id ?? '';
  const isAdmin = myMember?.role === 'owner' || myMember?.role === 'admin';
  const myParticipatesInFinances = myMember?.participatesInFinances ?? false;
  const hasFinancialPartner = partnerMember != null;
  const taskMembers = household.members.filter((m) => m.participatesInTasks);
  const roommateMembers = useMemo(
    () => household.members.filter((m) => m.userId?.toString() !== currentUserId),
    [household.members, currentUserId]
  );
  const roommateNicknames = useMemo(
    () => roommateMembers.map((m) => m.nickname),
    [roommateMembers]
  );

  // ── Settings (derived from household.settings) ────────────────────────
  const financeMode: FinanceMode = (household.settings.financeMode as FinanceMode) ?? 'split';
  const splitMethod: ExpenseSplitMethod =
    (household.settings.expenseSplitMethod as ExpenseSplitMethod) ?? 'equal';
  const taskLevel: TaskManagementLevel =
    (household.settings.taskManagementEnabled as TaskManagementLevel) ?? 'full';
  const distribution: TaskDistributionMethod =
    (household.settings.taskDistributionMethod as TaskDistributionMethod) ?? 'rotation';

  const incomeSplit =
    splitMethod === 'income_based' ? deriveIncomeSplit(household, currentUserId) : null;

  // Per-member roommate custom split, seeded from settings (even-split fallback
  // when stale/unset). Drives the household-level editor and pre-fills the
  // per-expense percentages in AddExpenseForm.
  const customShares = useMemo(
    () => deriveRoommateCustomShares(household),
    [household]
  );

  // ── Derived counts ────────────────────────────────────────────────────
  const overdueCount = tasks.filter(
    (t) => !t.isCompleted && getDueDateStatus(t.dueDate, t.isCompleted) === 'overdue'
  ).length;

  // ── Settings handlers ─────────────────────────────────────────────────
  // React Query guarantees `mutateAsync` identity is stable across renders,
  // so keying each useCallback on that reference keeps the wrapper stable.
  const updateSettingsAsync = updateSettingsMutation.mutateAsync;

  const handleFinanceModeChange = useCallback(async (v: FinanceMode) => {
    if (!isAdmin) return;
    try {
      await updateSettingsAsync({ financeMode: v });
    } catch {
      /* ignore — household query will revert on refetch */
    }
  }, [isAdmin, updateSettingsAsync]);

  const handleSplitMethodChange = useCallback(async (v: ExpenseSplitMethod) => {
    if (!isAdmin) return;
    try {
      await updateSettingsAsync({ expenseSplitMethod: v });
    } catch {
      /* ignore */
    }
  }, [isAdmin, updateSettingsAsync]);

  const handleCustomPctCommit = useCallback(async (v: number) => {
    if (!isAdmin) return;
    // `v` is the editor's own share; persist it owner-relatively so storage
    // stays the owner's share (matches the backend's custom split branch).
    const iAmOwner = myMember?.role === 'owner';
    const ownerPct = iAmOwner ? v : 100 - v;
    try {
      await updateSettingsAsync({ customSplitPercentage: ownerPct });
    } catch {
      /* ignore */
    }
  }, [isAdmin, myMember?.role, updateSettingsAsync]);

  const handleCustomSharesCommit = useCallback(
    async (shares: { userId: string; pct: number }[]) => {
      if (!isAdmin) return;
      try {
        await updateSettingsAsync({ customSplitShares: shares });
      } catch {
        /* ignore — household query will revert on refetch */
      }
    },
    [isAdmin, updateSettingsAsync]
  );

  // ── Mutation wrappers ─────────────────────────────────────────────────
  const deleteExpenseAsync = deleteExpenseMutation.mutateAsync;
  const claimExpenseAsync = claimExpenseMutation.mutateAsync;
  const claimPaybackAsync = claimPaybackMutation.mutateAsync;
  const confirmPaybackAsync = confirmPaybackMutation.mutateAsync;
  const disputePaybackAsync = disputePaybackMutation.mutateAsync;
  const deactivateRecurringExpenseAsync = deactivateRecurringExpenseMutation.mutateAsync;
  const toggleCompleteAsync = toggleCompleteMutation.mutateAsync;
  const deleteTaskAsync = deleteTaskMutation.mutateAsync;
  const assignTaskAsync = assignTaskMutation.mutateAsync;
  const setRotationAsync = setRotationMutation.mutateAsync;
  const deactivateRecurringTaskAsync = deactivateRecurringTaskMutation.mutateAsync;
  const updateGoalAsync = updateGoalMutation.mutateAsync;
  const deleteGoalAsync = deleteGoalMutation.mutateAsync;
  const removeContributionAsync = removeContributionMutation.mutateAsync;
  const deleteJointTxAsync = deleteJointTxMutation.mutateAsync;

  const deleteExpense = useCallback(
    async (id: string) => { await deleteExpenseAsync(id); },
    [deleteExpenseAsync]
  );
  const claimExpense = useCallback(
    async (id: string) => { await claimExpenseAsync(id); },
    [claimExpenseAsync]
  );
  const claimPayback = useCallback(
    async (id: string) => { await claimPaybackAsync(id); },
    [claimPaybackAsync]
  );
  const confirmPayback = useCallback(
    async (args: { expenseId: string; debtorUserId: string }) => { await confirmPaybackAsync(args); },
    [confirmPaybackAsync]
  );
  const disputePayback = useCallback(
    async (args: { expenseId: string; debtorUserId: string }) => { await disputePaybackAsync(args); },
    [disputePaybackAsync]
  );
  const deactivateRecurringExpense = useCallback(
    async (id: string) => { await deactivateRecurringExpenseAsync(id); },
    [deactivateRecurringExpenseAsync]
  );
  const toggleTaskComplete = useCallback(
    async (id: string) => { await toggleCompleteAsync(id); },
    [toggleCompleteAsync]
  );
  const deleteTask = useCallback(
    async (id: string) => { await deleteTaskAsync(id); },
    [deleteTaskAsync]
  );
  const assignTask = useCallback(
    async (taskId: string, memberId: string | null) => {
      await assignTaskAsync({ taskId, input: { assignedToMemberId: memberId } });
    },
    [assignTaskAsync]
  );
  const setRotation = useCallback(
    async (startMemberId: string) => { await setRotationAsync(startMemberId); },
    [setRotationAsync]
  );
  const deactivateRecurringTask = useCallback(
    async (id: string) => { await deactivateRecurringTaskAsync(id); },
    [deactivateRecurringTaskAsync]
  );
  const updateGoal = useCallback(
    async (goalId: string, input: { status: 'completed' | 'abandoned' }) => {
      await updateGoalAsync({ goalId, input });
    },
    [updateGoalAsync]
  );
  const deleteGoal = useCallback(
    async (goalId: string) => { await deleteGoalAsync(goalId); },
    [deleteGoalAsync]
  );
  const removeContribution = useCallback(
    async (goalId: string, contributionId: string) => {
      await removeContributionAsync({ goalId, contributionId });
    },
    [removeContributionAsync]
  );
  const deleteJointTransaction = useCallback(
    async (txId: string) => { await deleteJointTxAsync(txId); },
    [deleteJointTxAsync]
  );

  const uiMode: UIMode = household.uiMode;

  const value = useMemo<DashboardContextValue>(() => ({
    household,
    currentUserId,
    uiMode,
    myMember,
    partnerMember,
    myNickname,
    partnerNickname,
    currency,
    myMemberId,
    isAdmin,
    myParticipatesInFinances,
    hasFinancialPartner,
    taskMembers,
    roommateMembers,
    roommateNicknames,
    financeMode,
    splitMethod,
    taskLevel,
    distribution,
    customMyPct,
    setCustomMyPct,
    customShares,
    incomeSplit,
    tasks,
    rotationStatus,
    tasksLoading,
    goals,
    goalsLoading,
    overdueCount,
    addExpenseOpen,
    setAddExpenseOpen,
    editingExpense,
    setEditingExpense,
    addTaskOpen,
    setAddTaskOpen,
    addRecurringTaskOpen,
    setAddRecurringTaskOpen,
    rotationConfigOpen,
    setRotationConfigOpen,
    addGoalOpen,
    setAddGoalOpen,
    contributionTarget,
    setContributionTarget,
    addTransactionOpen,
    setAddTransactionOpen,
    openTransactionForm,
    deleteExpense,
    claimExpense,
    claimPayback,
    confirmPayback,
    disputePayback,
    deactivateRecurringExpense,
    toggleTaskComplete,
    deleteTask,
    assignTask,
    setRotation,
    deactivateRecurringTask,
    updateGoal,
    deleteGoal,
    removeContribution,
    deleteJointTransaction,
    handleFinanceModeChange,
    handleSplitMethodChange,
    handleCustomPctCommit,
    handleCustomSharesCommit,
  }), [
    household,
    currentUserId,
    uiMode,
    myMember,
    partnerMember,
    myNickname,
    partnerNickname,
    currency,
    myMemberId,
    isAdmin,
    myParticipatesInFinances,
    hasFinancialPartner,
    taskMembers,
    roommateMembers,
    roommateNicknames,
    financeMode,
    splitMethod,
    taskLevel,
    distribution,
    customMyPct,
    customShares,
    incomeSplit,
    tasks,
    rotationStatus,
    tasksLoading,
    goals,
    goalsLoading,
    overdueCount,
    addExpenseOpen,
    editingExpense,
    addTaskOpen,
    addRecurringTaskOpen,
    rotationConfigOpen,
    addGoalOpen,
    contributionTarget,
    addTransactionOpen,
    openTransactionForm,
    deleteExpense,
    claimExpense,
    claimPayback,
    confirmPayback,
    disputePayback,
    deactivateRecurringExpense,
    toggleTaskComplete,
    deleteTask,
    assignTask,
    setRotation,
    deactivateRecurringTask,
    updateGoal,
    deleteGoal,
    removeContribution,
    deleteJointTransaction,
    handleFinanceModeChange,
    handleSplitMethodChange,
    handleCustomPctCommit,
    handleCustomSharesCommit,
  ]);

  return (
    <DashboardContext.Provider value={value}>
      {children}

      {/* All shared form sheets — rendered here so they're reachable from any page */}
      <AddExpenseForm
        open={addExpenseOpen || editingExpense !== null}
        onOpenChange={(o) => {
          if (!o) { setAddExpenseOpen(false); setEditingExpense(null); }
        }}
        household={household}
        expense={editingExpense ?? undefined}
      />

      <AddTaskForm
        householdId={household._id}
        open={addTaskOpen}
        onOpenChange={setAddTaskOpen}
        distributionMethod={taskLevel === 'full' ? distribution : undefined}
        taskMembers={taskLevel === 'full' ? taskMembers : []}
      />

      <AddRecurringTaskForm
        householdId={household._id}
        open={addRecurringTaskOpen}
        onOpenChange={setAddRecurringTaskOpen}
        distributionMethod={distribution}
        taskMembers={taskMembers}
      />

      {uiMode === 'couple' && (
        <SetRotationDialog
          open={rotationConfigOpen}
          onOpenChange={setRotationConfigOpen}
          taskMembers={taskMembers}
          onConfirm={setRotation}
        />
      )}

      <AddGoalForm
        householdId={household._id}
        open={addGoalOpen}
        onOpenChange={setAddGoalOpen}
        currency={currency}
      />

      <AddContributionDialog
        householdId={household._id}
        goalId={contributionTarget?._id ?? ''}
        goalName={contributionTarget?.name ?? ''}
        open={contributionTarget !== null}
        onOpenChange={(o) => { if (!o) setContributionTarget(null); }}
        currency={currency}
      />

      <AddTransactionForm
        householdId={household._id}
        open={addTransactionOpen}
        onOpenChange={(o) => {
          setAddTransactionOpen(o);
          if (!o) setTransactionFormDefaultType(null);
        }}
        currency={currency}
        currentBalance={currentJointBalance}
        defaultType={transactionFormDefaultType ?? undefined}
      />
    </DashboardContext.Provider>
  );
}
