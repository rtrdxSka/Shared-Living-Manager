import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// ── Types ──────────────────────────────────────────────────────────────────

type FinanceMode = 'joint' | 'split';
type SplitMethod = 'equal' | 'income_based' | 'custom';
type TaskLevel = 'full' | 'basic' | 'disabled';
type DistributionMethod = 'rotation' | 'fixed' | 'voluntary';
type Tab = 'overview' | 'expenses' | 'tasks';

// ── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_ME = { nickname: 'Alex' };
const MOCK_PARTNER = { nickname: 'Sam' };
const MOCK_HOUSEHOLD_NAME = 'Our Apartment';
const MOCK_CURRENCY = 'лв';

const MOCK_INCOMES = { alex: 3000, sam: 2000 }; // лв/mo
const MOCK_INCOME_SPLIT = { myPct: 60, partnerPct: 40 };

const MOCK_EXPENSES = [
  { id: 1, description: 'Rent', amount: 1200, paidBy: 'Alex', date: 'Feb 1', category: 'rent' },
  { id: 2, description: 'Electricity bill', amount: 85.5, paidBy: 'Sam', date: 'Feb 5', category: 'utilities' },
  { id: 3, description: 'Weekly groceries', amount: 124, paidBy: 'Alex', date: 'Feb 10', category: 'groceries' },
  { id: 4, description: 'Internet', amount: 49.99, paidBy: 'Sam', date: 'Feb 15', category: 'internet' },
  { id: 5, description: 'Cleaning supplies', amount: 32, paidBy: 'Alex', date: 'Feb 18', category: 'cleaning' },
];

const MOCK_GOALS = [
  { id: 1, name: 'Summer Vacation', target: 3000, current: 1200, deadline: 'Jul 2026' },
  { id: 2, name: 'New Sofa', target: 800, current: 320, deadline: 'Apr 2026' },
];

const MOCK_TASKS = {
  rotation: [
    { id: 1, title: 'Buy groceries', assignedTo: 'Sam', due: 'Today', done: false, note: 'This week: Sam' },
    { id: 2, title: 'Take out trash', assignedTo: 'Alex', due: 'Tomorrow', done: false, note: 'This week: Alex' },
    { id: 3, title: 'Clean bathroom', assignedTo: 'Sam', due: 'This week', done: false },
    { id: 4, title: 'Vacuum living room', assignedTo: 'Alex', due: 'Last week', done: true },
  ],
  fixed: [
    { id: 1, title: 'Take out trash', assignedTo: 'Alex', due: 'Tomorrow', done: false, fixed: true },
    { id: 2, title: 'Vacuum living room', assignedTo: 'Alex', due: 'This week', done: false, fixed: true },
    { id: 3, title: 'Buy groceries', assignedTo: 'Sam', due: 'Today', done: false, fixed: true },
    { id: 4, title: 'Clean bathroom', assignedTo: 'Sam', due: 'This week', done: true, fixed: true },
  ],
  voluntary: [
    { id: 1, title: 'Buy groceries', claimedBy: 'Sam', due: 'Today', done: false },
    { id: 2, title: 'Take out trash', claimedBy: null, due: 'Tomorrow', done: false },
    { id: 3, title: 'Clean bathroom', claimedBy: null, due: 'This week', done: false },
    { id: 4, title: 'Vacuum living room', claimedBy: 'Alex', due: 'Last week', done: true },
  ],
};

// ── Helpers ────────────────────────────────────────────────────────────────

const TOTAL_AMOUNT = MOCK_EXPENSES.reduce((s, e) => s + e.amount, 0); // 1491.49
const ALEX_PAID = MOCK_EXPENSES.filter((e) => e.paidBy === 'Alex').reduce((s, e) => s + e.amount, 0);
const SAM_PAID = MOCK_EXPENSES.filter((e) => e.paidBy === 'Sam').reduce((s, e) => s + e.amount, 0);

function getBalance(splitMethod: SplitMethod, customMyPct: number): number {
  if (splitMethod === 'equal') return ALEX_PAID - TOTAL_AMOUNT * 0.5;
  if (splitMethod === 'income_based') return ALEX_PAID - TOTAL_AMOUNT * (MOCK_INCOME_SPLIT.myPct / 100);
  return ALEX_PAID - TOTAL_AMOUNT * (customMyPct / 100);
}

function getMyShareLabel(expense: (typeof MOCK_EXPENSES)[0], splitMethod: SplitMethod, customMyPct: number): string {
  const { amount } = expense;
  if (splitMethod === 'equal') {
    return `Your share: ${(amount / 2).toFixed(2)} ${MOCK_CURRENCY}`;
  }
  if (splitMethod === 'income_based') {
    const pct = MOCK_INCOME_SPLIT.myPct;
    return `Your share: ${((amount * pct) / 100).toFixed(2)} ${MOCK_CURRENCY} (${pct}%)`;
  }
  return `Your share: ${((amount * customMyPct) / 100).toFixed(2)} ${MOCK_CURRENCY} (${customMyPct}%)`;
}

function getBalanceSplitLabel(splitMethod: SplitMethod, customMyPct: number): string {
  if (splitMethod === 'equal') return '50/50 equal split';
  if (splitMethod === 'income_based')
    return `${MOCK_INCOME_SPLIT.myPct}/${MOCK_INCOME_SPLIT.partnerPct} income-based split`;
  return `${customMyPct}/${100 - customMyPct} custom split`;
}

const CATEGORY_CHIP_CLASSES: Record<string, string> = {
  rent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  utilities: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  groceries: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  internet: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  cleaning: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
};

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// ── Tab config ─────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'tasks', label: 'Tasks' },
];

// ── Sub-components ─────────────────────────────────────────────────────────

function ToggleGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="w-32 shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              value === opt.value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-transparent hover:bg-muted'
            }`}
          >
            {opt.label}
            {value === opt.value && ' ✓'}
          </button>
        ))}
      </div>
    </div>
  );
}

function MockControls({
  financeMode,
  setFinanceMode,
  splitMethod,
  setSplitMethod,
  taskLevel,
  setTaskLevel,
  distribution,
  setDistribution,
}: {
  financeMode: FinanceMode;
  setFinanceMode: (v: FinanceMode) => void;
  splitMethod: SplitMethod;
  setSplitMethod: (v: SplitMethod) => void;
  taskLevel: TaskLevel;
  setTaskLevel: (v: TaskLevel) => void;
  distribution: DistributionMethod;
  setDistribution: (v: DistributionMethod) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-4 rounded-xl border border-dashed border-border bg-muted/30 p-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-widest text-muted-foreground"
      >
        <span>Mock Controls</span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-2.5">
          <ToggleGroup<FinanceMode>
            label="Finance Mode"
            options={[
              { value: 'joint', label: 'Joint' },
              { value: 'split', label: 'Split' },
            ]}
            value={financeMode}
            onChange={setFinanceMode}
          />

          {financeMode === 'split' && (
            <ToggleGroup<SplitMethod>
              label="Split Method"
              options={[
                { value: 'equal', label: 'Equal' },
                { value: 'income_based', label: 'Income-based' },
                { value: 'custom', label: 'Custom' },
              ]}
              value={splitMethod}
              onChange={setSplitMethod}
            />
          )}

          <ToggleGroup<TaskLevel>
            label="Task Level"
            options={[
              { value: 'full', label: 'Full' },
              { value: 'basic', label: 'Basic' },
              { value: 'disabled', label: 'Disabled' },
            ]}
            value={taskLevel}
            onChange={setTaskLevel}
          />

          {taskLevel !== 'disabled' && (
            <ToggleGroup<DistributionMethod>
              label="Distribution"
              options={[
                { value: 'rotation', label: 'Rotation' },
                { value: 'fixed', label: 'Fixed' },
                { value: 'voluntary', label: 'Voluntary' },
              ]}
              value={distribution}
              onChange={setDistribution}
            />
          )}
        </div>
      )}
    </div>
  );
}

function StatsRow({ financeMode, splitMethod, customMyPct }: { financeMode: FinanceMode; splitMethod: SplitMethod; customMyPct: number }) {
  if (financeMode === 'joint') {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Spent</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {fmt(TOTAL_AMOUNT)} {MOCK_CURRENCY}
            </p>
            <p className="text-xs text-muted-foreground">this month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Per Person</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              ~{fmt(TOTAL_AMOUNT / 2)} {MOCK_CURRENCY}
            </p>
            <p className="text-xs text-muted-foreground">each</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Next Bill</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">Electricity</p>
            <p className="text-xs text-muted-foreground">in 12 days</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Split mode
  const balance = getBalance(splitMethod, customMyPct);
  const balancePositive = balance > 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`text-2xl font-bold ${balancePositive ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {balancePositive
              ? `${MOCK_PARTNER.nickname} owes you ${fmt(Math.abs(balance))} ${MOCK_CURRENCY}`
              : `You owe ${MOCK_PARTNER.nickname} ${fmt(Math.abs(balance))} ${MOCK_CURRENCY}`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {splitMethod === 'equal' && '50 / 50 split'}
            {splitMethod === 'income_based' && `${MOCK_INCOME_SPLIT.myPct} / ${MOCK_INCOME_SPLIT.partnerPct} income-based`}
            {splitMethod === 'custom' && `${customMyPct} / ${100 - customMyPct} custom`}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Spent</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">
            {fmt(TOTAL_AMOUNT)} {MOCK_CURRENCY}
          </p>
          <p className="text-xs text-muted-foreground">this month</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Your Payments</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-base font-semibold">
            You paid: {fmt(ALEX_PAID)} {MOCK_CURRENCY}
          </p>
          <p className="text-sm text-muted-foreground">
            {MOCK_PARTNER.nickname} paid: {fmt(SAM_PAID)} {MOCK_CURRENCY}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function GoalsCard() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold">Shared Goals</CardTitle>
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {MOCK_GOALS.map((goal) => {
          const pct = Math.round((goal.current / goal.target) * 100);
          return (
            <div key={goal.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{goal.name}</span>
                <span className="text-xs text-muted-foreground">{goal.deadline}</span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{pct}%</span>
                <span>
                  {fmt(goal.current)} / {fmt(goal.target)} {MOCK_CURRENCY}
                </span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function RecentActivityCard({
  taskLevel,
  distribution,
  setActiveTab,
}: {
  taskLevel: TaskLevel;
  distribution: DistributionMethod;
  setActiveTab: (tab: Tab) => void;
}) {
  const topExpenses = MOCK_EXPENSES.slice(0, 3);

  const taskList = MOCK_TASKS[distribution];
  const pendingTasks = taskList.filter((t) => !t.done).slice(0, 2);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Expenses summary */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Expenses</p>
          {topExpenses.map((expense) => (
            <div key={expense.id} className="flex items-center gap-2">
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                  CATEGORY_CHIP_CLASSES[expense.category] ?? ''
                }`}
              >
                {expense.category}
              </span>
              <span className="flex-1 truncate text-sm">{expense.description}</span>
              <span className="shrink-0 text-sm font-semibold">
                {fmt(expense.amount)} {MOCK_CURRENCY}
              </span>
            </div>
          ))}
          <button
            onClick={() => setActiveTab('expenses')}
            className="text-xs text-primary hover:underline"
          >
            → See all expenses
          </button>
        </div>

        {/* Tasks summary */}
        {taskLevel !== 'disabled' ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pending Tasks</p>
            {pendingTasks.map((task) => {
              const label =
                'claimedBy' in task
                  ? (task.claimedBy ?? 'Unclaimed')
                  : (task as { assignedTo: string }).assignedTo;
              return (
                <div key={task.id} className="flex items-center gap-2">
                  <div className="h-4 w-4 shrink-0 rounded border-2 border-border" />
                  <span className="flex-1 text-sm">{task.title}</span>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {label}
                  </span>
                </div>
              );
            })}
            <button
              onClick={() => setActiveTab('tasks')}
              className="text-xs text-primary hover:underline"
            >
              → See all tasks
            </button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Task management is disabled.</p>
        )}
      </CardContent>
    </Card>
  );
}

function SplitMethodCallout({
  splitMethod,
  customMyPct,
  setCustomMyPct,
}: {
  splitMethod: SplitMethod;
  customMyPct: number;
  setCustomMyPct: (v: number) => void;
}) {
  const customPartnerPct = 100 - customMyPct;

  return (
    <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
      {splitMethod === 'equal' && (
        <p className="text-muted-foreground">Expenses are split <strong>50/50</strong> equally between both partners.</p>
      )}
      {splitMethod === 'income_based' && (
        <div className="space-y-1.5">
          <p className="font-medium">Income-based split</p>
          <div className="grid grid-cols-2 gap-x-6 text-muted-foreground">
            <span>{MOCK_ME.nickname} — {fmt(MOCK_INCOMES.alex)} {MOCK_CURRENCY}/mo <span className="font-medium text-foreground">({MOCK_INCOME_SPLIT.myPct}%)</span></span>
            <span>{MOCK_PARTNER.nickname} — {fmt(MOCK_INCOMES.sam)} {MOCK_CURRENCY}/mo <span className="font-medium text-foreground">({MOCK_INCOME_SPLIT.partnerPct}%)</span></span>
          </div>
        </div>
      )}
      {splitMethod === 'custom' && (
        <div className="space-y-2">
          <p className="font-medium">Custom split</p>
          <div className="flex items-center gap-3">
            <span className="w-16 text-right text-xs text-muted-foreground">{MOCK_ME.nickname} {customMyPct}%</span>
            <input
              type="range"
              min={10}
              max={90}
              step={5}
              value={customMyPct}
              onChange={(e) => setCustomMyPct(Number(e.target.value))}
              className="flex-1 accent-primary"
            />
            <span className="w-16 text-xs text-muted-foreground">{MOCK_PARTNER.nickname} {customPartnerPct}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

function FullExpensesCard({
  financeMode,
  splitMethod,
  customMyPct,
  setCustomMyPct,
}: {
  financeMode: FinanceMode;
  splitMethod: SplitMethod;
  customMyPct: number;
  setCustomMyPct: (v: number) => void;
}) {
  const balance = getBalance(splitMethod, customMyPct);
  const balancePositive = balance > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold">Expenses — February 2026</CardTitle>
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {financeMode === 'split' && (
          <SplitMethodCallout
            splitMethod={splitMethod}
            customMyPct={customMyPct}
            setCustomMyPct={setCustomMyPct}
          />
        )}
        {MOCK_EXPENSES.map((expense) => (
          <div key={expense.id} className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                  CATEGORY_CHIP_CLASSES[expense.category] ?? ''
                }`}
              >
                {expense.category}
              </span>
              <span className="flex-1 truncate text-sm font-medium">{expense.description}</span>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {expense.paidBy}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{expense.date}</span>
              <span className="shrink-0 text-sm font-semibold">
                {fmt(expense.amount)} {MOCK_CURRENCY}
              </span>
            </div>
            {financeMode === 'split' && (
              <p className="ml-2 text-xs text-muted-foreground">{getMyShareLabel(expense, splitMethod, customMyPct)}</p>
            )}
          </div>
        ))}

        {financeMode === 'split' && (
          <div className="mt-2 border-t border-border pt-3 text-sm">
            <span className={balancePositive ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}>
              {balancePositive
                ? `${MOCK_PARTNER.nickname} owes you ${fmt(Math.abs(balance))} ${MOCK_CURRENCY}`
                : `You owe ${MOCK_PARTNER.nickname} ${fmt(Math.abs(balance))} ${MOCK_CURRENCY}`}
            </span>
            <span className="text-muted-foreground"> · based on {getBalanceSplitLabel(splitMethod, customMyPct)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TasksCard({ taskLevel, distribution }: { taskLevel: TaskLevel; distribution: DistributionMethod }) {
  if (taskLevel === 'disabled') {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Task management is disabled for this household.
        </CardContent>
      </Card>
    );
  }

  const tasks = MOCK_TASKS[distribution];

  if (taskLevel === 'basic') {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Tasks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {MOCK_TASKS.rotation.map((task) => (
            <div
              key={task.id}
              className={`flex items-center gap-2 ${task.done ? 'opacity-50' : ''}`}
            >
              <div
                className={`h-4 w-4 shrink-0 rounded border-2 ${
                  task.done ? 'border-primary bg-primary' : 'border-border'
                }`}
              />
              <span className={`flex-1 text-sm ${task.done ? 'line-through' : ''}`}>{task.title}</span>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {task.assignedTo}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{task.due}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  // Full level
  if (distribution === 'rotation') {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Tasks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            🔄 This week: <strong>{MOCK_PARTNER.nickname}</strong> · Next week: <strong>{MOCK_ME.nickname}</strong>
          </div>
          <div className="space-y-2">
            {(tasks as typeof MOCK_TASKS.rotation).map((task) => (
              <div
                key={task.id}
                className={`flex items-center gap-2 ${task.done ? 'opacity-50' : ''}`}
              >
                <div
                  className={`h-4 w-4 shrink-0 rounded border-2 ${
                    task.done ? 'border-primary bg-primary' : 'border-border'
                  }`}
                />
                <span className={`flex-1 text-sm ${task.done ? 'line-through' : ''}`}>{task.title}</span>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {task.assignedTo}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{task.due}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (distribution === 'fixed') {
    const alexTasks = (tasks as typeof MOCK_TASKS.fixed).filter((t) => t.assignedTo === 'Alex');
    const samTasks = (tasks as typeof MOCK_TASKS.fixed).filter((t) => t.assignedTo === 'Sam');

    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Tasks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: `${MOCK_ME.nickname}'s tasks`, items: alexTasks },
            { label: `${MOCK_PARTNER.nickname}'s tasks`, items: samTasks },
          ].map(({ label, items }) => (
            <div key={label} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
              {items.map((task) => (
                <div
                  key={task.id}
                  className={`flex items-center gap-2 ${task.done ? 'opacity-50' : ''}`}
                >
                  <div
                    className={`h-4 w-4 shrink-0 rounded border-2 ${
                      task.done ? 'border-primary bg-primary' : 'border-border'
                    }`}
                  />
                  <span className={`flex-1 text-sm ${task.done ? 'line-through' : ''}`}>{task.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{task.due}</span>
                </div>
              ))}
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  // voluntary
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Tasks</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          Anyone can claim any task
        </div>
        <div className="space-y-2">
          {(tasks as typeof MOCK_TASKS.voluntary).map((task) => (
            <div
              key={task.id}
              className={`flex items-center gap-2 ${task.done ? 'opacity-50' : ''}`}
            >
              <div
                className={`h-4 w-4 shrink-0 rounded border-2 ${
                  task.done ? 'border-primary bg-primary' : 'border-border'
                }`}
              />
              <span className={`flex-1 text-sm ${task.done ? 'line-through' : ''}`}>{task.title}</span>
              {task.claimedBy ? (
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {task.claimedBy}
                </span>
              ) : (
                !task.done && (
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                    Claim
                  </Button>
                )
              )}
              <span className="shrink-0 text-xs text-muted-foreground">{task.due}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function CoupleDashboard() {
  const [financeMode, setFinanceMode] = useState<FinanceMode>('split');
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('equal');
  const [taskLevel, setTaskLevel] = useState<TaskLevel>('full');
  const [distribution, setDistribution] = useState<DistributionMethod>('rotation');
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [customMyPct, setCustomMyPct] = useState(70);

  const subLine = [
    `${MOCK_ME.nickname} & ${MOCK_PARTNER.nickname}`,
    financeMode === 'split'
      ? `Split: ${splitMethod === 'equal' ? 'Equal' : splitMethod === 'income_based' ? 'Income-based' : 'Custom'}`
      : 'Joint finances',
    taskLevel !== 'disabled'
      ? `Tasks: ${distribution.charAt(0).toUpperCase() + distribution.slice(1)}`
      : 'Tasks: Off',
  ].join(' · ');

  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-4">
        {/* Mock Controls */}
        <MockControls
          financeMode={financeMode}
          setFinanceMode={setFinanceMode}
          splitMethod={splitMethod}
          setSplitMethod={setSplitMethod}
          taskLevel={taskLevel}
          setTaskLevel={setTaskLevel}
          distribution={distribution}
          setDistribution={setDistribution}
        />

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{MOCK_HOUSEHOLD_NAME}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{subLine}</p>
          </div>
          <div className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
            {financeMode === 'joint' ? 'Joint finances' : `Split: ${splitMethod}`}
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex gap-0 border-b border-border">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-primary font-medium text-foreground'
                  : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <StatsRow financeMode={financeMode} splitMethod={splitMethod} customMyPct={customMyPct} />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <GoalsCard />
              <RecentActivityCard
                taskLevel={taskLevel}
                distribution={distribution}
                setActiveTab={setActiveTab}
              />
            </div>
          </div>
        )}

        {activeTab === 'expenses' && (
          <FullExpensesCard financeMode={financeMode} splitMethod={splitMethod} customMyPct={customMyPct} setCustomMyPct={setCustomMyPct} />
        )}

        {activeTab === 'tasks' && (
          <TasksCard taskLevel={taskLevel} distribution={distribution} />
        )}
      </div>
    </div>
  );
}
