import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

import type { HouseholdResponse, HouseholdMemberResponse } from '@/types/household.types';
import type { ExpenseResponse } from '@/types/expense.types';
import type { GoalResponse } from '@/types/goal.types';
import type { TaskResponse, RotationStatus } from '@/types/task.types';
import type {
  FinanceMode,
  ExpenseSplitMethod,
  TaskManagementLevel,
  TaskDistributionMethod,
} from '@/types/onboarding.types';

import {
  useDeleteExpense,
  useClaimExpense,
  useResolveExpense,
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
  useRecordSettlement,
  useDeleteJointTransaction,
  useTasks,
} from '@/hooks/queries';

import { deriveIncomeSplit, getDueDateStatus } from '@/utils/dashboardHelpers';

import AddExpenseForm from '@/components/dashboard/shared/AddExpenseForm';
import AddTaskForm from '@/components/dashboard/shared/AddTaskForm';
import AddGoalForm from '@/components/dashboard/shared/AddGoalForm';
import AddContributionDialog from '@/components/dashboard/shared/AddContributionDialog';
import AddRecurringTaskForm from '@/components/dashboard/shared/AddRecurringTaskForm';
import AddTransactionForm from '@/components/dashboard/shared/AddTransactionForm';
import SetRotationDialog from '@/components/dashboard/shared/SetRotationDialog';

// ── Context Value ─────────────────────────────────────────────────────────

export interface DashboardContextValue {
  // Core data
  household: HouseholdResponse;
  currentUserId: string;

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

  // Settings (derived from household)
  financeMode: FinanceMode;
  splitMethod: ExpenseSplitMethod;
  taskLevel: TaskManagementLevel;
  distribution: TaskDistributionMethod;
  customMyPct: number;
  setCustomMyPct: (v: number) => void;
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

  // Mutation functions
  deleteExpense: (id: string) => Promise<void>;
  claimExpense: (id: string) => Promise<void>;
  resolveExpense: (id: string) => Promise<void>;
  deactivateRecurringExpense: (id: string) => Promise<void>;
  toggleTaskComplete: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  assignTask: (taskId: string, memberId: string | null) => Promise<void>;
  setRotation: (startMemberId: string) => Promise<void>;
  deactivateRecurringTask: (id: string) => Promise<void>;
  updateGoal: (goalId: string, input: { status: 'completed' | 'abandoned' }) => Promise<void>;
  deleteGoal: (goalId: string) => Promise<void>;
  removeContribution: (goalId: string, contributionId: string) => Promise<void>;
  handleSettleUp: (month: string, amount: number) => Promise<void>;
  deleteJointTransaction: (txId: string) => Promise<void>;
  handleFinanceModeChange: (v: FinanceMode) => Promise<void>;
  handleSplitMethodChange: (v: ExpenseSplitMethod) => Promise<void>;
  handleCustomPctCommit: (v: number) => Promise<void>;
}

// ── Context ───────────────────────────────────────────────────────────────

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider');
  return ctx;
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
  const [customMyPct, setCustomMyPct] = useState(
    household.settings.customSplitPercentage ?? 50
  );

  // ── Hoisted queries ───────────────────────────────────────────────────
  const { data: tasksData, isLoading: tasksLoading } = useTasks(household._id);
  const tasks = tasksData?.tasks ?? [];
  const rotationStatus = tasksData?.rotation ?? null;

  const { data: goalsData, isLoading: goalsLoading } = useGoals(household._id);
  const goals = goalsData ?? [];

  // ── Mutations ─────────────────────────────────────────────────────────
  const deleteExpenseMutation = useDeleteExpense(household._id);
  const claimExpenseMutation = useClaimExpense(household._id);
  const resolveExpenseMutation = useResolveExpense(household._id);
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
  const settleMutation = useRecordSettlement(household._id);
  const deleteJointTxMutation = useDeleteJointTransaction(household._id);

  // ── Derived member data ───────────────────────────────────────────────
  const myMember = household.members.find((m) => m.userId === currentUserId);
  const partnerMember = household.members.find(
    (m) => m.userId && m.userId !== currentUserId && m.participatesInFinances
  );
  const myNickname = myMember?.nickname ?? 'You';
  const partnerNickname = partnerMember?.nickname ?? 'Partner';
  const currency = household.settings.currency ?? 'BGN';
  const myMemberId = myMember?._id ?? '';
  const isAdmin = myMember?.role === 'owner' || myMember?.role === 'admin';
  const myParticipatesInFinances = myMember?.participatesInFinances ?? false;
  const hasFinancialPartner = partnerMember != null;
  const taskMembers = household.members.filter((m) => m.participatesInTasks);

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

  // ── Derived counts ────────────────────────────────────────────────────
  const overdueCount = tasks.filter(
    (t) => !t.isCompleted && getDueDateStatus(t.dueDate, t.isCompleted) === 'overdue'
  ).length;

  // ── Settings handlers ─────────────────────────────────────────────────
  const handleFinanceModeChange = async (v: FinanceMode) => {
    if (!isAdmin) return;
    try {
      await updateSettingsMutation.mutateAsync({ financeMode: v });
    } catch {
      /* ignore — household query will revert on refetch */
    }
  };

  const handleSplitMethodChange = async (v: ExpenseSplitMethod) => {
    if (!isAdmin) return;
    try {
      await updateSettingsMutation.mutateAsync({ expenseSplitMethod: v });
    } catch {
      /* ignore */
    }
  };

  const handleCustomPctCommit = async (v: number) => {
    if (!isAdmin) return;
    try {
      await updateSettingsMutation.mutateAsync({ customSplitPercentage: v });
    } catch {
      /* ignore */
    }
  };

  // ── Mutation wrappers ─────────────────────────────────────────────────
  const deleteExpense = async (id: string) => { await deleteExpenseMutation.mutateAsync(id); };
  const claimExpense = async (id: string) => { await claimExpenseMutation.mutateAsync(id); };
  const resolveExpense = async (id: string) => { await resolveExpenseMutation.mutateAsync(id); };
  const deactivateRecurringExpense = async (id: string) => {
    await deactivateRecurringExpenseMutation.mutateAsync(id);
  };
  const toggleTaskComplete = async (id: string) => {
    await toggleCompleteMutation.mutateAsync(id);
  };
  const deleteTask = async (id: string) => { await deleteTaskMutation.mutateAsync(id); };
  const assignTask = async (taskId: string, memberId: string | null) => {
    await assignTaskMutation.mutateAsync({ taskId, input: { assignedToMemberId: memberId } });
  };
  const setRotation = async (startMemberId: string) => {
    await setRotationMutation.mutateAsync(startMemberId);
  };
  const deactivateRecurringTask = async (id: string) => {
    await deactivateRecurringTaskMutation.mutateAsync(id);
  };
  const updateGoal = async (goalId: string, input: { status: 'completed' | 'abandoned' }) => {
    await updateGoalMutation.mutateAsync({ goalId, input });
  };
  const deleteGoal = async (goalId: string) => {
    await deleteGoalMutation.mutateAsync(goalId);
  };
  const removeContribution = async (goalId: string, contributionId: string) => {
    await removeContributionMutation.mutateAsync({ goalId, contributionId });
  };
  const handleSettleUp = async (month: string, amount: number) => {
    await settleMutation.mutateAsync({ month, amount });
  };
  const deleteJointTransaction = async (txId: string) => {
    await deleteJointTxMutation.mutateAsync(txId);
  };

  const value: DashboardContextValue = {
    household,
    currentUserId,
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
    financeMode,
    splitMethod,
    taskLevel,
    distribution,
    customMyPct,
    setCustomMyPct,
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
    deleteExpense,
    claimExpense,
    resolveExpense,
    deactivateRecurringExpense,
    toggleTaskComplete,
    deleteTask,
    assignTask,
    setRotation,
    deactivateRecurringTask,
    updateGoal,
    deleteGoal,
    removeContribution,
    handleSettleUp,
    deleteJointTransaction,
    handleFinanceModeChange,
    handleSplitMethodChange,
    handleCustomPctCommit,
  };

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
        isAdmin={isAdmin}
        currentUserId={currentUserId}
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

      <SetRotationDialog
        open={rotationConfigOpen}
        onOpenChange={setRotationConfigOpen}
        taskMembers={taskMembers}
        onConfirm={setRotation}
      />

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
        onOpenChange={setAddTransactionOpen}
        currency={currency}
      />
    </DashboardContext.Provider>
  );
}
