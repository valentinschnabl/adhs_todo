import { Platform } from 'react-native';

type RowResult = {
  rows: {
    length: number;
    item: (index: number) => any;
  };
};

type SqliteModule = typeof import('expo-sqlite');
let sqliteModule: SqliteModule | null = null;
let dbPromise: Promise<import('expo-sqlite').SQLiteDatabase> | null = null;

type MemoryTables = {
  user: any[];
  tasks: any[];
  subtasks: any[];
  rewards: any[];
  draw_history: any[];
  app_state: { key: string; value: string }[];
};

const memoryTables: MemoryTables = {
  user: [],
  tasks: [],
  subtasks: [],
  rewards: [],
  draw_history: [],
  app_state: [],
};

async function getDb() {
  if (!dbPromise) {
    if (!sqliteModule) {
      sqliteModule = await import('expo-sqlite');
    }
    dbPromise = sqliteModule.openDatabaseAsync('adhsTodo.db');
  }
  return dbPromise;
}

function buildRows(items: any[]): RowResult {
  return {
    rows: {
      length: items.length,
      item: (index: number) => items[index],
    },
  };
}

function isSelectQuery(sql: string) {
  const trimmed = sql.trim().toUpperCase();
  return trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA');
}

function executeSqlMemory(sql: string, params: (string | number | null)[] = []) {
  const text = sql.trim().toUpperCase();

  if (text.startsWith('CREATE TABLE')) {
    return Promise.resolve(buildRows([]));
  }

  if (text.startsWith('SELECT * FROM USER')) {
    const row = memoryTables.user[0];
    return Promise.resolve(buildRows(row ? [row] : []));
  }

  if (text.startsWith('SELECT * FROM TASKS')) {
    const items = [...memoryTables.tasks];
    items.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return Promise.resolve(buildRows(items));
  }

  if (text.startsWith('SELECT * FROM REWARDS')) {
    const items = [...memoryTables.rewards];
    items.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return Promise.resolve(buildRows(items));
  }

  if (text.startsWith('SELECT * FROM SUBTASKS')) {
    const items = [...memoryTables.subtasks];
    items.sort((a, b) => Number(a.order_index) - Number(b.order_index));
    return Promise.resolve(buildRows(items));
  }

  if (text.startsWith('SELECT VALUE FROM APP_STATE')) {
    const key = String(params[0] ?? '');
    const row = memoryTables.app_state.find((item) => item.key === key);
    return Promise.resolve(buildRows(row ? [row] : []));
  }

  if (text.startsWith('INSERT INTO USER')) {
    const [id, created_at, isPremiumUser, dailyDrawCount, lastDrawReset, drawsSinceReward] =
      params as string[];
    memoryTables.user = [
      { id, created_at, isPremiumUser, dailyDrawCount, lastDrawReset, drawsSinceReward },
    ];
    return Promise.resolve(buildRows([]));
  }

  if (text.startsWith('UPDATE USER')) {
    const [isPremiumUser, dailyDrawCount, lastDrawReset, drawsSinceReward, id] = params as string[];
    const current = memoryTables.user.find((u) => u.id === id);
    if (current) {
      current.isPremiumUser = isPremiumUser;
      current.dailyDrawCount = dailyDrawCount;
      current.lastDrawReset = lastDrawReset;
      current.drawsSinceReward = drawsSinceReward;
    }
    return Promise.resolve(buildRows([]));
  }

  if (text.startsWith('INSERT INTO TASKS')) {
    const [id, title, importanceWeight, isCompleted, created_at] = params as string[];
    memoryTables.tasks.push({ id, title, importanceWeight, isCompleted, created_at });
    return Promise.resolve(buildRows([]));
  }

  if (text.startsWith('UPDATE TASKS')) {
    const [isCompleted, id] = params as string[];
    const task = memoryTables.tasks.find((t) => t.id === id);
    if (task) task.isCompleted = isCompleted;
    return Promise.resolve(buildRows([]));
  }

  if (text.startsWith('INSERT INTO SUBTASKS')) {
    const [id, task_id, title, isCompleted, order_index] = params as string[];
    memoryTables.subtasks.push({ id, task_id, title, isCompleted, order_index });
    return Promise.resolve(buildRows([]));
  }

  if (text.startsWith('UPDATE SUBTASKS')) {
    const [isCompleted, id] = params as string[];
    const sub = memoryTables.subtasks.find((s) => s.id === id);
    if (sub) sub.isCompleted = isCompleted;
    return Promise.resolve(buildRows([]));
  }

  if (text.startsWith('INSERT INTO REWARDS')) {
    const [id, title, created_at] = params as string[];
    memoryTables.rewards.push({ id, title, created_at });
    return Promise.resolve(buildRows([]));
  }

  if (text.startsWith('INSERT INTO DRAW_HISTORY')) {
    const [id, draw_type, task_id, reward_id, hasBonusReward, created_at] = params as string[];
    memoryTables.draw_history.push({
      id,
      draw_type,
      task_id,
      reward_id,
      hasBonusReward,
      created_at,
    });
    return Promise.resolve(buildRows([]));
  }

  if (text.startsWith('INSERT OR REPLACE INTO APP_STATE')) {
    const [key, value] = params as string[];
    const existing = memoryTables.app_state.find((item) => item.key === key);
    if (existing) existing.value = value;
    else memoryTables.app_state.push({ key, value });
    return Promise.resolve(buildRows([]));
  }

  return Promise.resolve(buildRows([]));
}

export async function executeSql(sql: string, params: (string | number | null)[] = []) {
  if (Platform.OS === 'web') {
    return executeSqlMemory(sql, params);
  }
  const db = await getDb();
  if (isSelectQuery(sql)) {
    const rows = await db.getAllAsync(sql, params);
    return buildRows(rows);
  }
  await db.runAsync(sql, params);
  return buildRows([]);
}

export async function initDb() {
  await executeSql(
    `CREATE TABLE IF NOT EXISTS user (
      id TEXT PRIMARY KEY NOT NULL,
      created_at TEXT NOT NULL,
      isPremiumUser INTEGER NOT NULL,
      dailyDrawCount INTEGER NOT NULL,
      lastDrawReset TEXT NOT NULL,
      drawsSinceReward INTEGER NOT NULL
    );`
  );

  await executeSql(
    `CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      importanceWeight TEXT NOT NULL,
      isCompleted INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );`
  );

  await executeSql(
    `CREATE TABLE IF NOT EXISTS subtasks (
      id TEXT PRIMARY KEY NOT NULL,
      task_id TEXT NOT NULL,
      title TEXT NOT NULL,
      isCompleted INTEGER NOT NULL,
      order_index INTEGER NOT NULL
    );`
  );

  await executeSql(
    `CREATE TABLE IF NOT EXISTS rewards (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL
    );`
  );

  await executeSql(
    `CREATE TABLE IF NOT EXISTS draw_history (
      id TEXT PRIMARY KEY NOT NULL,
      draw_type TEXT NOT NULL,
      task_id TEXT,
      reward_id TEXT,
      hasBonusReward INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );`
  );

  await executeSql(
    `CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );`
  );
}

export async function getAppState(key: string) {
  const result = await executeSql('SELECT value FROM app_state WHERE key = ?;', [key]);
  if (result.rows.length === 0) return null;
  return result.rows.item(0).value as string;
}

export async function setAppState(key: string, value: string) {
  await executeSql(
    'INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?);',
    [key, value]
  );
}
