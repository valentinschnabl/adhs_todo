import { SQLiteDatabase } from 'expo-sqlite';
import { generateMicrotasks } from './gemini';
import { getSubtasksByTaskId, insertSubtask, Subtask } from '../db/subtasks';

function countQualitySubtasks(subtasks: Subtask[], taskTitle: string): number {
    const taskNorm = taskTitle.toLowerCase().trim();
    return subtasks.filter((s) => s.title.toLowerCase().trim() !== taskNorm).length;
}

export async function ensureQualitySubtasksForTask(
    db: SQLiteDatabase,
    taskId: number,
    taskTitle: string
): Promise<Subtask[]> {
    let subtasks = await getSubtasksByTaskId(db, taskId);

    if (subtasks.length === 0) {
        const steps = await generateMicrotasks(taskTitle);
        const taskNorm = taskTitle.toLowerCase().trim();
        const qualitySteps = steps.filter((s) => s.toLowerCase().trim() !== taskNorm);

        if (qualitySteps.length >= 2) {
            await Promise.all(
                qualitySteps.map((step, i) => insertSubtask(db, taskId, step, 'ai', i))
            );
            subtasks = await getSubtasksByTaskId(db, taskId);
        }
    }

    return countQualitySubtasks(subtasks, taskTitle) >= 2 ? subtasks : [];
}
