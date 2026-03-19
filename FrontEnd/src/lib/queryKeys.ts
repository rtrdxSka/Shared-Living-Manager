export const queryKeys = {
  household: {
    all: ['household'] as const,
    detail: (id: string) => ['household', id] as const,
  },
  expenses: {
    all: (householdId: string) => ['expenses', householdId] as const,
    list: (householdId: string, month: string) =>
      ['expenses', householdId, 'list', month] as const,
  },
  recurringExpenses: {
    all: (householdId: string) => ['recurringExpenses', householdId] as const,
    list: (householdId: string) =>
      ['recurringExpenses', householdId, 'list'] as const,
  },
  tasks: {
    all: (householdId: string) => ['tasks', householdId] as const,
    list: (householdId: string) => ['tasks', householdId, 'list'] as const,
  },
  recurringTasks: {
    all: (householdId: string) => ['recurringTasks', householdId] as const,
    list: (householdId: string) =>
      ['recurringTasks', householdId, 'list'] as const,
  },
  goals: {
    all: (householdId: string) => ['goals', householdId] as const,
    list: (householdId: string) => ['goals', householdId, 'list'] as const,
    detail: (householdId: string, goalId: string) =>
      ['goals', householdId, goalId] as const,
  },
} as const;
