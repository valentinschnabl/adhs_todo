export type ImportanceWeight = 'LOW' | 'MEDIUM' | 'HIGH';

export type Task = {
  id: string;
  title: string;
  importanceWeight: ImportanceWeight;
  isCompleted: number;
  created_at: string;
};

export type SubTask = {
  id: string;
  task_id: string;
  title: string;
  isCompleted: number;
  order_index: number;
};

export type Reward = {
  id: string;
  title: string;
  created_at: string;
};

export type User = {
  id: string;
  created_at: string;
  isPremiumUser: number;
  dailyDrawCount: number;
  lastDrawReset: string;
  drawsSinceReward: number;
};

export type DrawHistory = {
  id: string;
  draw_type: 'TASK' | 'REWARD';
  task_id: string | null;
  reward_id: string | null;
  hasBonusReward: number;
  created_at: string;
};
