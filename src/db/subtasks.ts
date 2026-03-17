import { SQLiteDatabase } from 'expo-sqlite';

export interface Subtask {
  id: number;
  task_id: number;
  title: string;
  source: 'ai' | 'fallback';
  isCompleted: number;
  order_index: number;
}

export async function insertSubtask(
  db: SQLiteDatabase,
  task_id: number,
  title: string,
  source: 'ai' | 'fallback',
  order_index: number
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO subtasks (task_id, title, source, isCompleted, order_index)
     VALUES (?, ?, ?, 0, ?)`,
    [task_id, title, source, order_index]
  );
  return result.lastInsertRowId;
}

export async function getSubtasksByTaskId(db: SQLiteDatabase, task_id: number): Promise<Subtask[]> {
  return db.getAllAsync<Subtask>(
    'SELECT * FROM subtasks WHERE task_id = ? ORDER BY order_index ASC',
    [task_id]
  );
}

export async function toggleSubtask(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync(
    'UPDATE subtasks SET isCompleted = CASE WHEN isCompleted = 0 THEN 1 ELSE 0 END WHERE id = ?',
    [id]
  );
}

export async function countSubtasks(db: SQLiteDatabase, task_id: number): Promise<number> {
  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM subtasks WHERE task_id = ?',
    [task_id]
  );
  return result?.count ?? 0;
}

export async function countCompletedSubtasks(db: SQLiteDatabase, task_id: number): Promise<number> {
  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM subtasks WHERE task_id = ? AND isCompleted = 1',
    [task_id]
  );
  return result?.count ?? 0;
}

export async function deleteSubtasksByTaskId(db: SQLiteDatabase, task_id: number): Promise<void> {
  await db.runAsync('DELETE FROM subtasks WHERE task_id = ?', [task_id]);
}
