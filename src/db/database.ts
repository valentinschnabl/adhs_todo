import { SQLiteDatabase } from 'expo-sqlite';

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);

  const versionRow = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = versionRow?.user_version ?? 0;

  if (currentVersion < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        isPremiumUser INTEGER NOT NULL DEFAULT 0,
        dailyDrawCount INTEGER NOT NULL DEFAULT 0,
        lastDrawReset TEXT,
        drawsSinceReward INTEGER NOT NULL DEFAULT 0,
        aiClarityCount INTEGER NOT NULL DEFAULT 0,
        aiMicrotaskCount INTEGER NOT NULL DEFAULT 0,
        lastAIReset TEXT
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        importanceWeight TEXT NOT NULL DEFAULT 'MEDIUM' CHECK(importanceWeight IN ('LOW', 'MEDIUM', 'HIGH')),
        isCompleted INTEGER NOT NULL DEFAULT 0,
        clarity_status TEXT NOT NULL DEFAULT 'skipped' CHECK(clarity_status IN ('clear', 'skipped')),
        draw_count INTEGER NOT NULL DEFAULT 0,
        last_drawn_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS subtasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'fallback' CHECK(source IN ('ai', 'fallback')),
        isCompleted INTEGER NOT NULL DEFAULT 0,
        order_index INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS rewards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS draw_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        draw_type TEXT NOT NULL CHECK(draw_type IN ('TASK', 'REWARD')),
        task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        reward_id INTEGER REFERENCES rewards(id) ON DELETE CASCADE,
        hasBonusReward INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    await db.runAsync('PRAGMA user_version = 1');
  }

  if (currentVersion < 2) {
    const drawHistoryTable = await db.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'draw_history'"
    );

    if (drawHistoryTable) {
      const foreignKeys = await db.getAllAsync<{ from: string; on_delete: string }>('PRAGMA foreign_key_list(draw_history)');
      const taskFk = foreignKeys.find((fk) => fk.from === 'task_id');
      const rewardFk = foreignKeys.find((fk) => fk.from === 'reward_id');
      const taskCascade = taskFk?.on_delete?.toUpperCase() === 'CASCADE';
      const rewardCascade = rewardFk?.on_delete?.toUpperCase() === 'CASCADE';

      if (!taskCascade || !rewardCascade) {
        await db.execAsync(`
          PRAGMA foreign_keys = OFF;

          CREATE TABLE draw_history_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            draw_type TEXT NOT NULL CHECK(draw_type IN ('TASK', 'REWARD')),
            task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
            reward_id INTEGER REFERENCES rewards(id) ON DELETE CASCADE,
            hasBonusReward INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
          );

          INSERT INTO draw_history_new (id, draw_type, task_id, reward_id, hasBonusReward, created_at)
          SELECT id, draw_type, task_id, reward_id, hasBonusReward, created_at
          FROM draw_history;

          DROP TABLE draw_history;
          ALTER TABLE draw_history_new RENAME TO draw_history;

          PRAGMA foreign_keys = ON;
        `);
      }
    }

    await db.runAsync('PRAGMA user_version = 2');
  }

  // Create default user row if not exists
  const userCount = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM users'
  );
  if (!userCount || userCount.count === 0) {
    await db.runAsync(
      `INSERT INTO users (created_at, isPremiumUser, dailyDrawCount, drawsSinceReward, aiClarityCount, aiMicrotaskCount)
       VALUES (datetime('now'), 0, 0, 0, 0, 0)`
    );
  }
}
