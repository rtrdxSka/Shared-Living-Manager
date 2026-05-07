import { Types } from 'mongoose';
import type { SeedResult } from './seed';

import usersData from './data/users.json';
import householdsData from './data/households.json';
import expensesData from './data/expenses.json';
import tasksData from './data/tasks.json';
import goalsData from './data/goals.json';
import shoppingData from './data/shopping-items.json';
import jointAccountData from './data/joint-account-tx.json';

type UserKey = (typeof usersData)[number]['key'];
type HouseholdKey = (typeof householdsData)[number]['key'];
type MemberKey = (typeof householdsData)[number]['members'][number]['memberKey'];
type ExpenseKey = (typeof expensesData)[number]['key'];
type TaskKey = (typeof tasksData)[number]['key'];
type GoalKey = (typeof goalsData)[number]['key'];
type ShoppingKey = (typeof shoppingData)[number]['key'];
type JointTxKey = (typeof jointAccountData)[number]['key'];

interface Fixtures {
  user: (key: UserKey) => {
    _id: Types.ObjectId;
    email: string;
    password: string;
    firstName: string;
  };
  household: (key: HouseholdKey) => { _id: Types.ObjectId; inviteCode: string };
  member: (key: MemberKey) => Types.ObjectId;
  expense: (key: ExpenseKey) => Types.ObjectId;
  task: (key: TaskKey) => Types.ObjectId;
  goal: (key: GoalKey) => Types.ObjectId;
  shopping: (key: ShoppingKey) => Types.ObjectId;
  jointTx: (key: JointTxKey) => Types.ObjectId;
}

let current: SeedResult | null = null;

export const setFixtures = (result: SeedResult): void => {
  current = result;
};

const must = (): SeedResult => {
  if (!current) {
    throw new Error('FIXTURES not initialised — call setFixtures(seedResult) first.');
  }
  return current;
};

export const FIXTURES: Fixtures = {
  user: (key) => {
    const data = usersData.find((u) => u.key === key);
    if (!data) throw new Error(`No seeded user with key "${key}"`);
    return {
      _id: must().userIds[key],
      email: data.email,
      password: data.password,
      firstName: data.firstName,
    };
  },
  household: (key) => {
    const data = householdsData.find((h) => h.key === key);
    if (!data) throw new Error(`No seeded household with key "${key}"`);
    return { _id: must().householdIds[key], inviteCode: data.inviteCode };
  },
  member: (key) => must().memberIds[key],
  expense: (key) => must().expenseIds[key],
  task: (key) => must().taskIds[key],
  goal: (key) => must().goalIds[key],
  shopping: (key) => must().shoppingIds[key],
  jointTx: (key) => must().jointTxIds[key],
};
