import { ImportanceWeight, Task } from '@/lib/types';

export function nowIso() {
  return new Date().toISOString();
}

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

export function weightValue(weight: ImportanceWeight) {
  if (weight === 'HIGH') return 6;
  if (weight === 'MEDIUM') return 3;
  return 1;
}

export function weightedPick(tasks: Task[]) {
  const total = tasks.reduce((sum, t) => sum + weightValue(t.importanceWeight), 0);
  if (total <= 0) return tasks[0] ?? null;
  const roll = Math.random() * total;
  let acc = 0;
  for (const task of tasks) {
    acc += weightValue(task.importanceWeight);
    if (roll <= acc) return task;
  }
  return tasks[0] ?? null;
}
