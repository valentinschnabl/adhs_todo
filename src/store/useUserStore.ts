import { create } from 'zustand';

interface UserState {
  userId: number | null;
  isPremiumUser: boolean;
  dailyDrawCount: number;
  drawsSinceReward: number;
  aiClarityCount: number;
  aiMicrotaskCount: number;

  setUserId: (id: number) => void;
  setIsPremium: (v: boolean) => void;
  setDailyDrawCount: (n: number) => void;
  incrementDailyDraw: () => void;
  setDrawsSinceReward: (n: number) => void;
  setAIClarityCount: (n: number) => void;
  setAIMicrotaskCount: (n: number) => void;
  incrementAIClarity: () => void;
  incrementAIMicrotask: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  userId: null,
  isPremiumUser: false,
  dailyDrawCount: 0,
  drawsSinceReward: 0,
  aiClarityCount: 0,
  aiMicrotaskCount: 0,

  setUserId: (id) => set({ userId: id }),
  setIsPremium: (v) => set({ isPremiumUser: v }),
  setDailyDrawCount: (n) => set({ dailyDrawCount: n }),
  incrementDailyDraw: () => set((state) => ({ dailyDrawCount: state.dailyDrawCount + 1 })),
  setDrawsSinceReward: (n) => set({ drawsSinceReward: n }),
  setAIClarityCount: (n) => set({ aiClarityCount: n }),
  setAIMicrotaskCount: (n) => set({ aiMicrotaskCount: n }),
  incrementAIClarity: () => set((state) => ({ aiClarityCount: state.aiClarityCount + 1 })),
  incrementAIMicrotask: () => set((state) => ({ aiMicrotaskCount: state.aiMicrotaskCount + 1 })),
}));
