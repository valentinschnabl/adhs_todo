import { SQLiteDatabase } from 'expo-sqlite';

export interface Task {
  id: number;
  title: string;
  importanceWeight: 'LOW' | 'MEDIUM' | 'HIGH';
  isCompleted: number;
  clarity_status: 'clear' | 'skipped';
  draw_count: number;
  last_drawn_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function insertTask(
  db: SQLiteDatabase,
  title: string,
  importanceWeight: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM'
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO tasks (title, importanceWeight, isCompleted, clarity_status, draw_count, created_at, updated_at)
     VALUES (?, ?, 0, 'skipped', 0, datetime('now'), datetime('now'))`,
    [title, importanceWeight]
  );
  return result.lastInsertRowId;
}

export async function updateTask(
  db: SQLiteDatabase,
  id: number,
  updates: Partial<Pick<Task, 'title' | 'importanceWeight' | 'clarity_status'>>
): Promise<void> {
  const fields: string[] = [];
  const values: (string | number)[] = [];

  if (updates.title !== undefined) {
    fields.push('title = ?');
    values.push(updates.title);
  }
  if (updates.importanceWeight !== undefined) {
    fields.push('importanceWeight = ?');
    values.push(updates.importanceWeight);
  }
  if (updates.clarity_status !== undefined) {
    fields.push('clarity_status = ?');
    values.push(updates.clarity_status);
  }

  if (fields.length === 0) return;

  fields.push("updated_at = datetime('now')");
  values.push(id);

  await db.runAsync(
    `UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}

export async function deleteTask(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM draw_history WHERE task_id = ?', [id]);
  await db.runAsync('DELETE FROM tasks WHERE id = ?', [id]);
}

export async function getTaskById(db: SQLiteDatabase, id: number): Promise<Task | null> {
  return db.getFirstAsync<Task>('SELECT * FROM tasks WHERE id = ?', [id]);
}

export async function getAllIncompleteTasks(db: SQLiteDatabase): Promise<Task[]> {
  return db.getAllAsync<Task>('SELECT * FROM tasks WHERE isCompleted = 0 ORDER BY created_at DESC');
}

export async function getAllCompletedTasks(db: SQLiteDatabase): Promise<Task[]> {
  return db.getAllAsync<Task>('SELECT * FROM tasks WHERE isCompleted = 1 ORDER BY updated_at DESC');
}

export async function drawWeightedTask(db: SQLiteDatabase): Promise<Task | null> {
  return db.getFirstAsync<Task>(`
    SELECT *
    FROM tasks
    WHERE isCompleted = 0
    ORDER BY (
      CASE importanceWeight
        WHEN 'LOW'    THEN 1
        WHEN 'MEDIUM' THEN 3
        WHEN 'HIGH'   THEN 6
      END
      +
      MIN(7, CAST(julianday('now') - julianday(COALESCE(last_drawn_at, created_at)) AS INTEGER))
    ) * RANDOM() DESC
    LIMIT 1
  `);
}

export async function markTaskDrawn(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync(
    `UPDATE tasks SET last_drawn_at = datetime('now'), draw_count = draw_count + 1, updated_at = datetime('now') WHERE id = ?`,
    [id]
  );
}

export async function markTaskCompleted(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync(
    `UPDATE tasks SET isCompleted = 1, updated_at = datetime('now') WHERE id = ?`,
    [id]
  );
}

export async function markTaskIncomplete(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync(
    `UPDATE tasks SET isCompleted = 0, updated_at = datetime('now') WHERE id = ?`,
    [id]
  );
}

export async function deleteAllCompletedTasks(db: SQLiteDatabase): Promise<void> {
  await db.runAsync(
    'DELETE FROM draw_history WHERE task_id IN (SELECT id FROM tasks WHERE isCompleted = 1)'
  );
  await db.runAsync('DELETE FROM tasks WHERE isCompleted = 1');
}

export async function countIncompleteTasks(db: SQLiteDatabase): Promise<number> {
  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM tasks WHERE isCompleted = 0'
  );
  return result?.count ?? 0;
}

export async function countTotalTasks(db: SQLiteDatabase): Promise<number> {
  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM tasks'
  );
  return result?.count ?? 0;
}
