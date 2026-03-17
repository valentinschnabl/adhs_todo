import { SQLiteDatabase } from 'expo-sqlite';

export interface DrawHistory {
  id: number;
  draw_type: 'TASK' | 'REWARD';
  task_id: number | null;
  reward_id: number | null;
  hasBonusReward: number;
  created_at: string;
}

export async function insertDrawHistory(
  db: SQLiteDatabase,
  draw_type: 'TASK' | 'REWARD',
  task_id: number | null,
  reward_id: number | null,
  hasBonusReward: number = 0
): Promise<void> {
  await db.runAsync(
    `INSERT INTO draw_history (draw_type, task_id, reward_id, hasBonusReward, created_at)
     VALUES (?, ?, ?, ?, datetime('now'))`,
    [draw_type, task_id, reward_id, hasBonusReward]
  );
}

export async function getRecentHistory(db: SQLiteDatabase, limit: number = 20): Promise<DrawHistory[]> {
  return db.getAllAsync<DrawHistory>(
    'SELECT * FROM draw_history ORDER BY created_at DESC LIMIT ?',
    [limit]
  );
}
