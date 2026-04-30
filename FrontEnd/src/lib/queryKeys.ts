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
  shoppingList: {
    all: (householdId: string) => ['shoppingList', householdId] as const,
    list: (householdId: string) => ['shoppingList', householdId, 'list'] as const,
    history: (householdId: string) => ['shoppingList', householdId, 'history'] as const,
  },
  goals: {
    all: (householdId: string) => ['goals', householdId] as const,
    list: (householdId: string) => ['goals', householdId, 'list'] as const,
    detail: (householdId: string, goalId: string) =>
      ['goals', householdId, goalId] as const,
  },
  jointAccount: {
    all: (householdId: string) => ['jointAccount', householdId] as const,
    summary: (householdId: string, month: string) =>
      ['jointAccount', householdId, 'summary', month] as const,
  },
} as const;
