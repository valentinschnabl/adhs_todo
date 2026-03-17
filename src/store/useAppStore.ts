import { create } from 'zustand';
import { Task } from '../db/tasks';
import { Subtask } from '../db/subtasks';
import { Reward } from '../db/rewards';

interface AppState {
  isHydrated: boolean;
  drawLocked: boolean;
  activeTask: Task | null;
  activeSubtasks: Subtask[];
  showSubtasks: boolean;
  activeBonusReward: Reward | null;
  task_started_at: number | null;
  rescueShownThisTask: boolean;

  setHydrated: (v: boolean) => void;
  setDrawLocked: (v: boolean) => void;
  setActiveTask: (task: Task | null) => void;
  setActiveSubtasks: (subtasks: Subtask[]) => void;
  setShowSubtasks: (v: boolean) => void;
  setActiveBonusReward: (reward: Reward | null) => void;
  setTaskStartedAt: (t: number | null) => void;
  setRescueShownThisTask: (v: boolean) => void;
  resetForNewDraw: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  isHydrated: false,
  drawLocked: false,
  activeTask: null,
  activeSubtasks: [],
  showSubtasks: false,
  activeBonusReward: null,
  task_started_at: null,
  rescueShownThisTask: false,

  setHydrated: (v) => set({ isHydrated: v }),
  setDrawLocked: (v) => set({ drawLocked: v }),
  setActiveTask: (task) => set({ activeTask: task }),
  setActiveSubtasks: (subtasks) => set({ activeSubtasks: subtasks }),
  setShowSubtasks: (v) => set({ showSubtasks: v }),
  setActiveBonusReward: (reward) => set({ activeBonusReward: reward }),
  setTaskStartedAt: (t) => set({ task_started_at: t }),
  setRescueShownThisTask: (v) => set({ rescueShownThisTask: v }),
  resetForNewDraw: () =>
    set({
      activeTask: null,
      activeSubtasks: [],
      showSubtasks: false,
      activeBonusReward: null,
      task_started_at: null,
      rescueShownThisTask: false,
      drawLocked: false,
    }),
}));
