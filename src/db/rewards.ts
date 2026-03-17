import { SQLiteDatabase } from 'expo-sqlite';

export interface Reward {
  id: number;
  title: string;
  created_at: string;
}

export async function insertReward(
  db: SQLiteDatabase,
  title: string
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO rewards (title, created_at)
     VALUES (?, datetime('now'))`,
    [title]
  );
  return result.lastInsertRowId;
}

export async function deleteReward(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM rewards WHERE id = ?', [id]);
}

export async function getAllRewards(db: SQLiteDatabase): Promise<Reward[]> {
  return db.getAllAsync<Reward>('SELECT * FROM rewards ORDER BY created_at DESC');
}

export async function drawRandomReward(db: SQLiteDatabase): Promise<Reward | null> {
  return db.getFirstAsync<Reward>(
    'SELECT * FROM rewards ORDER BY RANDOM() LIMIT 1'
  );
}

export async function countTotalRewards(db: SQLiteDatabase): Promise<number> {
  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM rewards'
  );
  return result?.count ?? 0;
}
