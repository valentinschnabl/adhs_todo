import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '../../src/store/useAppStore';
import { useUserStore } from '../../src/store/useUserStore';
import { DrawButton } from '../../src/components/DrawButton';
import { TaskCard } from '../../src/components/TaskCard';
import { SubtaskChecklist } from '../../src/components/SubtaskChecklist';
import { RewardCard } from '../../src/components/RewardCard';
import {
  drawWeightedTask,
  markTaskDrawn,
  markTaskCompleted,
} from '../../src/db/tasks';
import { drawRandomReward } from '../../src/db/rewards';
import {
  getSubtasksByTaskId,
  toggleSubtask,
} from '../../src/db/subtasks';
import { insertDrawHistory } from '../../src/db/drawHistory';
import { ensureQualitySubtasksForTask } from '../../src/services/subtasks';
import { BONUS_REWARD_ON_TASK_CHANCE, TASK_DRAW_CHANCE } from '../../src/config/drawConfig';
import { Reward } from '../../src/db/rewards';
import { Task } from '../../src/db/tasks';
import { COLORS } from '../../src/theme';
import { getGeminiApiKey, hasGeminiApiKey } from '../../src/services/env';





export default function DashboardScreen() {
  const db = useSQLiteContext();
  const {
    drawLocked,
    activeTask,
    activeSubtasks,
    showSubtasks,
    activeBonusReward,
    setDrawLocked,
    setActiveTask,
    setActiveSubtasks,
    setShowSubtasks,
    setActiveBonusReward,
    setTaskStartedAt,
    resetForNewDraw,
  } = useAppStore();

  const { userId, dailyDrawCount, incrementDailyDraw } = useUserStore();

  const [activeReward, setActiveReward] = useState<Reward | null>(null);
  const isDrawingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  async function loadSubtasksForTask(task: Task) {
    try {
      const subs = await ensureQualitySubtasksForTask(db, task.id, task.title);
      if (subs.length > 0 && isMountedRef.current) {
        setActiveSubtasks(subs);
        setShowSubtasks(true);
      }
    } catch {
      // No steps available — silently skip
    }
  }

  async function handleDraw() {
    if (drawLocked || isDrawingRef.current) return;

    isDrawingRef.current = true;
    setDrawLocked(true);

    try {
      const rand = Math.random();
      const drawReward = rand >= TASK_DRAW_CHANCE;

      if (drawReward) {
        const reward = await drawRandomReward(db);
        if (!reward) {
          Alert.alert('No rewards available', 'Please add more rewards in the Tasks tab.');
          setDrawLocked(false);
          return;
        }

        await insertDrawHistory(db, 'REWARD', null, reward.id, 0);

        if (userId) {
          await db.runAsync(
            'UPDATE users SET dailyDrawCount = dailyDrawCount + 1 WHERE id = ?',
            [userId]
          );
        }

        incrementDailyDraw();
        resetForNewDraw();
        if (isMountedRef.current) setActiveReward(reward);
        setDrawLocked(false);
      } else {
        const task = await drawWeightedTask(db);
        if (!task) {
          Alert.alert('No tasks available', 'Please add tasks in the Tasks tab.');
          setDrawLocked(false);
          return;
        }

        await markTaskDrawn(db, task.id);

        // 30% bonus reward chance
        let bonusReward: Reward | null = null;
        if (Math.random() < BONUS_REWARD_ON_TASK_CHANCE) {
          bonusReward = await drawRandomReward(db);
        }

        await insertDrawHistory(db, 'TASK', task.id, bonusReward?.id ?? null, bonusReward ? 1 : 0);

        if (userId) {
          await db.runAsync(
            'UPDATE users SET dailyDrawCount = dailyDrawCount + 1 WHERE id = ?',
            [userId]
          );
        }

        incrementDailyDraw();
        if (isMountedRef.current) setActiveReward(null);
        resetForNewDraw();
        setActiveTask(task);
        if (bonusReward) setActiveBonusReward(bonusReward);
        setTaskStartedAt(Date.now());
        setDrawLocked(true);

        await loadSubtasksForTask(task);
      }
    } catch (error) {
      console.error('Draw error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
      setDrawLocked(false);
    } finally {
      isDrawingRef.current = false;
    }
  }

  async function handleToggleSubtask(subtaskId: number) {
    await toggleSubtask(db, subtaskId);
    if (activeTask) {
      const updated = await getSubtasksByTaskId(db, activeTask.id);
      setActiveSubtasks(updated);
    }
  }

  async function handleCompleteTask() {
    if (!activeTask) return;

    try {
      await markTaskCompleted(db, activeTask.id);

      if (activeBonusReward) {
        setActiveReward(activeBonusReward);
        if (userId) {
          await db.runAsync('UPDATE users SET drawsSinceReward = 0 WHERE id = ?', [userId]);
        }
      }

      resetForNewDraw();
      setDrawLocked(false);
    } catch (error) {
      console.error('Complete task error:', error);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Text style={{color: 'white', fontSize: 10}}>
  hasKey: {String(hasGeminiApiKey())} | key: {getGeminiApiKey()?.slice(0, 8)}
</Text>
        <View style={styles.header}>
          <Text style={styles.appTitle}>ADHD Quest</Text>
          <View style={styles.drawCountBadge}>
            <Text style={styles.drawCountText}>{dailyDrawCount} draws</Text>
          </View>
        </View>

        {/* Draw button */}
        <View style={styles.drawSection}>
          <DrawButton
            onPress={handleDraw}
            isLocked={drawLocked}
          />
        </View>

        {/* Reward */}
        {activeReward && (
          <View style={styles.section}>
            <RewardCard reward={activeReward} isBonusReward={false} />
          </View>
        )}

        {/* Active task */}
        {activeTask && (
          <View style={styles.section}>
            <TaskCard task={activeTask} onComplete={handleCompleteTask} />

            {/* Bonus reward hint */}
            {activeBonusReward && (
              <View style={styles.bonusHint}>
                <Text style={styles.bonusHintText}>🎁 Bonus reward unlocks on completion</Text>
              </View>
            )}

            {/* Inline subtasks */}
            {showSubtasks && activeSubtasks.length > 0 && (
              <View style={styles.subtaskSection}>
                <SubtaskChecklist subtasks={activeSubtasks} onToggle={handleToggleSubtask} />
              </View>
            )}
          </View>
        )}

        {/* Empty state */}
        {!activeTask && !activeReward && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>Ready when you are.</Text>
            <Text style={styles.emptyStateSubtext}>Tap Draw to get a random task or reward.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  appTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  drawCountBadge: {
    backgroundColor: COLORS.cardAlt,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  drawCountText: {
    color: COLORS.subtext,
    fontSize: 12,
    fontWeight: '600',
  },
  drawSection: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  bonusHint: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.cardAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  bonusHintText: {
    color: COLORS.subtext,
    fontSize: 13,
  },
  subtaskSection: {
    marginTop: 8,
  },
  generateStepsRow: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  generateStepsText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 8,
  },
  emptyStateTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    color: COLORS.subtext,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
