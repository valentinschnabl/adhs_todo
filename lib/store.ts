import { create } from 'zustand';
import { executeSql, getAppState, initDb, setAppState } from '@/lib/db';
import { evaluateClarity, generateMicrotasks } from '@/lib/ai';
import { nowIso, todayKey, uid, weightedPick } from '@/lib/utils';
import { Reward, SubTask, Task, User, ImportanceWeight } from '@/lib/types';

type DrawResult = {
  type: 'TASK' | 'REWARD';
  task: Task | null;
  reward: Reward | null;
  hasBonusReward: boolean;
};

type StoreState = {
  isReady: boolean;
  user: User | null;
  tasks: Task[];
  rewards: Reward[];
  subtasks: SubTask[];
  activeTaskId: string | null;
  activeSubtaskIds: string[];
  drawLocked: boolean;
  activeBonusRewardPending: boolean;
  lastDraw: DrawResult | null;
  activeTaskStartedAt: string | null;
  lastProgressAt: string | null;
  rescueOpen: boolean;
  rescueTask: string | null;

  init: () => Promise<void>;
  addTaskAuto: (title: string, weight: ImportanceWeight) => Promise<void>;
  addReward: (title: string) => Promise<void>;
  toggleTaskCompleted: (taskId: string, completed: boolean) => Promise<void>;
  toggleSubtaskCompleted: (subtaskId: string, completed: boolean) => Promise<void>;
  draw: () => Promise<DrawResult | null>;
  activateSubtasks: (taskId: string) => Promise<void>;
  skipSubtasks: () => Promise<void>;
  completeActiveTask: () => Promise<void>;
  clearLastDraw: () => void;
  maybeTriggerRescue: () => void;
  completeRescue: () => Promise<void>;
  setRescueOpen: (open: boolean) => void;
};

const RESCUE_TASKS = [
  'Drink water',
  'Put away one item',
  'Write one sentence',
  'Open the document',
  'Stand up and stretch',
];

async function loadUser(): Promise<User> {
  const result = await executeSql('SELECT * FROM user LIMIT 1;');
  if (result.rows.length > 0) {
    return result.rows.item(0) as User;
  }
  const now = nowIso();
  const user: User = {
    id: uid('user'),
    created_at: now,
    isPremiumUser: 0,
    dailyDrawCount: 0,
    lastDrawReset: todayKey(),
    drawsSinceReward: 0,
  };
  await executeSql(
    'INSERT INTO user (id, created_at, isPremiumUser, dailyDrawCount, lastDrawReset, drawsSinceReward) VALUES (?, ?, ?, ?, ?, ?);',
    [
      user.id,
      user.created_at,
      user.isPremiumUser,
      user.dailyDrawCount,
      user.lastDrawReset,
      user.drawsSinceReward,
    ]
  );
  return user;
}

async function updateUser(user: User) {
  await executeSql(
    'UPDATE user SET isPremiumUser = ?, dailyDrawCount = ?, lastDrawReset = ?, drawsSinceReward = ? WHERE id = ?;',
    [user.isPremiumUser, user.dailyDrawCount, user.lastDrawReset, user.drawsSinceReward, user.id]
  );
}

async function loadList<T>(sql: string): Promise<T[]> {
  const result = await executeSql(sql);
  const items: T[] = [];
  for (let i = 0; i < result.rows.length; i += 1) {
    items.push(result.rows.item(i) as T);
  }
  return items;
}

async function loadAppStateValue<T>(key: string, fallback: T): Promise<T> {
  const raw = await getAppState(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const useAppStore = create<StoreState>((set, get) => ({
  isReady: false,
  user: null,
  tasks: [],
  rewards: [],
  subtasks: [],
  activeTaskId: null,
  activeSubtaskIds: [],
  drawLocked: false,
  activeBonusRewardPending: false,
  lastDraw: null,
  activeTaskStartedAt: null,
  lastProgressAt: null,
  rescueOpen: false,
  rescueTask: null,

  init: async () => {
    await initDb();
    const user = await loadUser();
    const tasks = await loadList<Task>('SELECT * FROM tasks ORDER BY created_at DESC;');
    const rewards = await loadList<Reward>('SELECT * FROM rewards ORDER BY created_at DESC;');
    const subtasks = await loadList<SubTask>('SELECT * FROM subtasks ORDER BY order_index ASC;');

    const activeTaskId = await loadAppStateValue<string | null>('activeTaskId', null);
    const activeSubtaskIds = await loadAppStateValue<string[]>('activeSubtaskIds', []);
    const drawLocked = await loadAppStateValue<boolean>('drawLocked', false);
    const activeBonusRewardPending = await loadAppStateValue<boolean>(
      'activeBonusRewardPending',
      false
    );
    const activeTaskStartedAt = await loadAppStateValue<string | null>('activeTaskStartedAt', null);
    const lastProgressAt = await loadAppStateValue<string | null>('lastProgressAt', null);

    const today = todayKey();
    if (user.lastDrawReset !== today) {
      user.dailyDrawCount = 0;
      user.lastDrawReset = today;
      await updateUser(user);
    }

    set({
      isReady: true,
      user,
      tasks,
      rewards,
      subtasks,
      activeTaskId,
      activeSubtaskIds,
      drawLocked,
      activeBonusRewardPending,
      activeTaskStartedAt,
      lastProgressAt,
    });
  },

  addTaskAuto: async (title, weight) => {
    const now = nowIso();
    const task: Task = {
      id: uid('task'),
      title,
      importanceWeight: weight,
      isCompleted: 0,
      created_at: now,
    };
    await executeSql(
      'INSERT INTO tasks (id, title, importanceWeight, isCompleted, created_at) VALUES (?, ?, ?, ?, ?);',
      [task.id, task.title, task.importanceWeight, task.isCompleted, task.created_at]
    );
    set((state) => ({ tasks: [task, ...state.tasks] }));

    try {
      const micro = await generateMicrotasks(title);
      const items = micro.microtasks.length ? micro.microtasks : ['Start task', 'Continue task', 'Finish task'];
      let order = 0;
      for (const item of items.slice(0, 5)) {
        const sub: SubTask = {
          id: uid('sub'),
          task_id: task.id,
          title: item,
          isCompleted: 0,
          order_index: order,
        };
        order += 1;
        await executeSql(
          'INSERT INTO subtasks (id, task_id, title, isCompleted, order_index) VALUES (?, ?, ?, ?, ?);',
          [sub.id, sub.task_id, sub.title, sub.isCompleted, sub.order_index]
        );
        set((state) => ({ subtasks: [...state.subtasks, sub] }));
      }
    } catch {
      const fallback = ['Start task', 'Continue task', 'Finish task'];
      let order = 0;
      for (const item of fallback) {
        const sub: SubTask = {
          id: uid('sub'),
          task_id: task.id,
          title: item,
          isCompleted: 0,
          order_index: order,
        };
        order += 1;
        await executeSql(
          'INSERT INTO subtasks (id, task_id, title, isCompleted, order_index) VALUES (?, ?, ?, ?, ?);',
          [sub.id, sub.task_id, sub.title, sub.isCompleted, sub.order_index]
        );
        set((state) => ({ subtasks: [...state.subtasks, sub] }));
      }
    }
  },

  addReward: async (title) => {
    const now = nowIso();
    const reward: Reward = { id: uid('reward'), title, created_at: now };
    await executeSql('INSERT INTO rewards (id, title, created_at) VALUES (?, ?, ?);', [
      reward.id,
      reward.title,
      reward.created_at,
    ]);
    set((state) => ({ rewards: [reward, ...state.rewards] }));
  },

  toggleTaskCompleted: async (taskId, completed) => {
    const state = get();
    if (state.activeTaskId === taskId && completed) {
      await get().completeActiveTask();
      return;
    }
    await executeSql('UPDATE tasks SET isCompleted = ? WHERE id = ?;', [completed ? 1 : 0, taskId]);
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, isCompleted: completed ? 1 : 0 } : t)),
    }));
  },

  toggleSubtaskCompleted: async (subtaskId, completed) => {
    await executeSql('UPDATE subtasks SET isCompleted = ? WHERE id = ?;', [completed ? 1 : 0, subtaskId]);
    set((state) => ({
      subtasks: state.subtasks.map((s) =>
        s.id === subtaskId ? { ...s, isCompleted: completed ? 1 : 0 } : s
      ),
      lastProgressAt: nowIso(),
    }));
    await setAppState('lastProgressAt', JSON.stringify(nowIso()));
  },

  draw: async () => {
    const state = get();
    if (!state.user) return null;

    const today = todayKey();
    const user = { ...state.user };
    if (user.lastDrawReset !== today) {
      user.dailyDrawCount = 0;
      user.lastDrawReset = today;
    }

    const availableTasks = state.tasks.filter((t) => t.isCompleted === 0);
    const availableRewards = state.rewards;

    const pityTriggered = user.drawsSinceReward >= 4;

    let drawType: 'TASK' | 'REWARD' = 'TASK';
    if (availableTasks.length === 0) {
      drawType = 'REWARD';
    } else if (availableRewards.length === 0) {
      drawType = 'TASK';
    } else if (pityTriggered) {
      drawType = 'REWARD';
    } else {
      drawType = Math.random() < 0.6 ? 'TASK' : 'REWARD';
    }

    let task: Task | null = null;
    let reward: Reward | null = null;
    let hasBonusReward = false;

    if (drawType === 'TASK') {
      task = weightedPick(availableTasks);
      if (!task) return null;
      hasBonusReward = availableRewards.length > 0 && Math.random() < 0.3;
      user.drawsSinceReward += 1;
      set({
        activeTaskId: task.id,
        drawLocked: true,
        activeBonusRewardPending: hasBonusReward,
        activeTaskStartedAt: nowIso(),
        lastProgressAt: nowIso(),
      });
      await setAppState('activeTaskId', JSON.stringify(task.id));
      await setAppState('drawLocked', JSON.stringify(true));
      await setAppState('activeBonusRewardPending', JSON.stringify(hasBonusReward));
      await setAppState('activeTaskStartedAt', JSON.stringify(nowIso()));
      await setAppState('lastProgressAt', JSON.stringify(nowIso()));
    } else {
      reward = availableRewards[Math.floor(Math.random() * availableRewards.length)] ?? null;
      user.drawsSinceReward = 0;
    }

    user.dailyDrawCount += 1;
    await updateUser(user);
    set({ user });

    const drawResult: DrawResult = { type: drawType, task, reward, hasBonusReward };
    set({ lastDraw: drawResult });

    await executeSql(
      'INSERT INTO draw_history (id, draw_type, task_id, reward_id, hasBonusReward, created_at) VALUES (?, ?, ?, ?, ?, ?);',
      [uid('draw'), drawType, task?.id ?? null, reward?.id ?? null, hasBonusReward ? 1 : 0, nowIso()]
    );

    return drawResult;
  },

  activateSubtasks: async (taskId) => {
    const subs = get().subtasks.filter((s) => s.task_id === taskId);
    const ids = subs.map((s) => s.id);
    set({ activeSubtaskIds: ids, drawLocked: true });
    await setAppState('activeSubtaskIds', JSON.stringify(ids));
    await setAppState('drawLocked', JSON.stringify(true));
  },

  skipSubtasks: async () => {
    set({ activeSubtaskIds: [] });
    await setAppState('activeSubtaskIds', JSON.stringify([]));
  },

  completeActiveTask: async () => {
    const state = get();
    if (!state.activeTaskId || !state.user) return;
    await executeSql('UPDATE tasks SET isCompleted = 1 WHERE id = ?;', [state.activeTaskId]);
    const tasks = state.tasks.map((t) =>
      t.id === state.activeTaskId ? { ...t, isCompleted: 1 } : t
    );

    let reward: Reward | null = null;
    let user = { ...state.user };
    if (state.activeBonusRewardPending && state.rewards.length > 0) {
      reward = state.rewards[Math.floor(Math.random() * state.rewards.length)];
      user.drawsSinceReward = 0;
    }

    await updateUser(user);

    set({
      tasks,
      user,
      drawLocked: false,
      activeTaskId: null,
      activeSubtaskIds: [],
      activeBonusRewardPending: false,
      lastDraw: reward
        ? { type: 'REWARD', task: null, reward, hasBonusReward: false }
        : state.lastDraw,
      activeTaskStartedAt: null,
    });
    await setAppState('activeTaskId', JSON.stringify(null));
    await setAppState('activeSubtaskIds', JSON.stringify([]));
    await setAppState('drawLocked', JSON.stringify(false));
    await setAppState('activeBonusRewardPending', JSON.stringify(false));
    await setAppState('activeTaskStartedAt', JSON.stringify(null));
  },

  clearLastDraw: () => set({ lastDraw: null }),

  maybeTriggerRescue: () => {
    const state = get();
    if (!state.activeTaskId || state.rescueOpen) return;
    if (!state.activeTaskStartedAt || !state.lastProgressAt) return;
    const started = new Date(state.activeTaskStartedAt).getTime();
    const last = new Date(state.lastProgressAt).getTime();
    const now = Date.now();
    if (now - started < 10 * 60 * 1000) return;
    if (now - last < 10 * 60 * 1000) return;
    const rescueTask = RESCUE_TASKS[Math.floor(Math.random() * RESCUE_TASKS.length)];
    set({ rescueOpen: true, rescueTask });
  },

  completeRescue: async () => {
    const state = get();
    let reward: Reward | null = null;
    let user = state.user ? { ...state.user } : null;
    if (state.rewards.length > 0) {
      reward = state.rewards[Math.floor(Math.random() * state.rewards.length)];
      if (user) user.drawsSinceReward = 0;
    } else if (user) {
      user.drawsSinceReward = Math.max(0, user.drawsSinceReward - 1);
    }
    if (user) await updateUser(user);
    set({
      user: user ?? state.user,
      rescueOpen: false,
      rescueTask: null,
      lastDraw: reward
        ? { type: 'REWARD', task: null, reward, hasBonusReward: false }
        : state.lastDraw,
    });
  },

  setRescueOpen: (open) => set({ rescueOpen: open }),
}));

export async function clarityCheck(title: string) {
  return evaluateClarity(title);
}
