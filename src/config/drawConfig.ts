export const TASK_DRAW_CHANCE = 0.75;
export const REWARD_DRAW_CHANCE = 0.25;
export const BONUS_REWARD_ON_TASK_CHANCE = 0.3;

export function toPercentString(value: number): string {
    return `${Math.round(value * 100)}%`;
}
