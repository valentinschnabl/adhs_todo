import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppTheme } from '@/constants/app-theme';
import { ProgressRing } from '@/components/progress-ring';
import { useAppStore } from '@/lib/store';

export default function DashboardScreen() {
  const {
    init,
    isReady,
    user,
    tasks,
    rewards,
    subtasks,
    activeTaskId,
    activeSubtaskIds,
    drawLocked,
    activeBonusRewardPending,
    lastDraw,
    draw,
    clearLastDraw,
    activateSubtasks,
    skipSubtasks,
    toggleSubtaskCompleted,
    completeActiveTask,
    maybeTriggerRescue,
    rescueOpen,
    rescueTask,
    completeRescue,
    setRescueOpen,
  } = useAppStore();

  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;
  const wobble = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    const interval = setInterval(() => maybeTriggerRescue(), 30000);
    return () => clearInterval(interval);
  }, [maybeTriggerRescue]);

  useEffect(() => {
    if (lastDraw?.type === 'TASK') {
      setBreakdownOpen(true);
    }
  }, [lastDraw]);

  const activeTask = useMemo(
    () => tasks.find((t) => t.id === activeTaskId) ?? null,
    [tasks, activeTaskId]
  );

  const activeSubtasks = useMemo(
    () => subtasks.filter((s) => activeSubtaskIds.includes(s.id)),
    [subtasks, activeSubtaskIds]
  );

  const allSubtasksDone =
    activeSubtasks.length > 0 && activeSubtasks.every((s) => s.isCompleted === 1);

  const onboardingNeeded = tasks.length < 3 || rewards.length < 3;
  const pityProgress = user ? Math.min(user.drawsSinceReward / 4, 1) : 0;

  const runAnimation = () => {
    pulse.setValue(1);
    wobble.setValue(0);
    Animated.sequence([
      Animated.timing(pulse, { toValue: 1.06, duration: 200, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.98, duration: 180, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1.02, duration: 160, useNativeDriver: true }),
      Animated.spring(pulse, { toValue: 1, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.timing(wobble, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(wobble, { toValue: -1, duration: 120, useNativeDriver: true }),
      Animated.timing(wobble, { toValue: 0, duration: 120, useNativeDriver: true }),
    ]).start();
  };

  const handleDraw = async () => {
    if (drawLocked) return;
    runAnimation();
    await draw();
  };

  const handleBreakdownChoice = async (useSteps: boolean) => {
    if (!activeTask) return;
    setBreakdownOpen(false);
    if (useSteps) {
      await activateSubtasks(activeTask.id);
    } else {
      await skipSubtasks();
    }
  };

  const handleCompleteTask = async () => {
    await completeActiveTask();
    clearLastDraw();
  };

  if (!isReady) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Warming up the draw deck...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Draw</Text>
        <Text style={styles.subtitle}>Pick a card, keep the momentum.</Text>

        <View style={styles.successBar}>
          <Text style={styles.successLabel}>Daily momentum</Text>
          <Text style={styles.successValue}>
            {user ? `${user.dailyDrawCount} draws today` : 'Loading...'}
          </Text>
        </View>

        {onboardingNeeded && (
          <View style={styles.onboardingCard}>
            <Text style={styles.onboardingTitle}>Onboarding</Text>
            <Text style={styles.onboardingText}>
              Add at least 3 tasks and 3 rewards to unlock your draw deck.
            </Text>
            <Text style={styles.onboardingText}>
              Tasks: {tasks.length} / 3 - Rewards: {rewards.length} / 3
            </Text>
          </View>
        )}

        <View style={styles.drawArea}>
          <ProgressRing
            size={210}
            stroke={10}
            progress={pityProgress}
            color={AppTheme.colors.gold}
            trackColor="rgba(0,0,0,0.08)"
          />
          <Animated.View
            style={[
              styles.drawButtonWrap,
              {
                transform: [
                  { scale: pulse },
                  {
                    rotate: wobble.interpolate({
                      inputRange: [-1, 1],
                      outputRange: ['-4deg', '4deg'],
                    }),
                  },
                ],
              },
            ]}>
            <Pressable
              onPress={handleDraw}
              style={[styles.drawButton, drawLocked || onboardingNeeded ? styles.drawButtonLocked : null]}
              disabled={drawLocked || onboardingNeeded}>
              <Text style={styles.drawButtonText}>DRAW</Text>
            </Pressable>
          </Animated.View>
        </View>

        {lastDraw && (
          <View style={styles.drawCard}>
            <Text style={styles.drawLabel}>
              {lastDraw.type === 'TASK' ? 'TASK' : 'REWARD'}
            </Text>
            <Text style={styles.drawTitle}>
              {lastDraw.type === 'TASK' ? lastDraw.task?.title : lastDraw.reward?.title}
            </Text>
            {lastDraw.type === 'TASK' && lastDraw.hasBonusReward && (
              <Text style={styles.bonusText}>Bonus reward queued</Text>
            )}
          </View>
        )}

        {activeTask && (
          <View style={styles.activeCard}>
            <Text style={styles.activeTitle}>Active task</Text>
            <Text style={styles.activeTaskTitle}>{activeTask.title}</Text>

            {activeSubtasks.length > 0 && (
              <View style={styles.subtaskList}>
                {activeSubtasks.map((sub) => (
                  <Pressable
                    key={sub.id}
                    onPress={() => toggleSubtaskCompleted(sub.id, sub.isCompleted === 0)}
                    style={[
                      styles.subtaskItem,
                      sub.isCompleted ? styles.subtaskDone : null,
                    ]}>
                    <Text
                      style={[
                        styles.subtaskText,
                        sub.isCompleted ? styles.subtaskTextDone : null,
                      ]}>
                      {sub.isCompleted ? '[x] ' : '[ ] '} {sub.title}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            <Pressable
              onPress={handleCompleteTask}
              disabled={activeSubtasks.length > 0 && !allSubtasksDone}
              style={[
                styles.completeButton,
                activeSubtasks.length > 0 && !allSubtasksDone ? styles.completeButtonLocked : null,
              ]}>
              <Text style={styles.completeButtonText}>
                {activeSubtasks.length > 0 ? 'Finish task' : 'Mark complete'}
              </Text>
            </Pressable>

            {activeBonusRewardPending && (
              <Text style={styles.bonusInline}>Complete to reveal a reward.</Text>
            )}
          </View>
        )}
      </ScrollView>

      <Modal visible={breakdownOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>You drew a task.</Text>
            <Text style={styles.modalText}>{activeTask?.title}</Text>
            <Text style={styles.modalText}>Do you want to break this task into smaller steps?</Text>
            <Pressable style={styles.modalOption} onPress={() => handleBreakdownChoice(true)}>
              <Text style={styles.modalOptionText}>Yes - Show steps</Text>
            </Pressable>
            <Pressable style={styles.modalOption} onPress={() => handleBreakdownChoice(false)}>
              <Text style={styles.modalOptionText}>No - Do task directly</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={rescueOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Feeling stuck?</Text>
            <Text style={styles.modalText}>Start a 2-minute rescue task.</Text>
            <View style={styles.rescueTask}>
              <Text style={styles.rescueTaskText}>{rescueTask}</Text>
            </View>
            <Pressable style={styles.modalOption} onPress={completeRescue}>
              <Text style={styles.modalOptionText}>I did it</Text>
            </Pressable>
            <Pressable style={styles.modalAlt} onPress={() => setRescueOpen(false)}>
              <Text style={styles.modalAltText}>Not now</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppTheme.colors.parchment,
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    backgroundColor: AppTheme.colors.parchment,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontFamily: AppTheme.fonts.body,
    color: AppTheme.colors.clay,
  },
  title: {
    fontSize: 28,
    fontFamily: AppTheme.fonts.heading,
    color: AppTheme.colors.ink,
  },
  subtitle: {
    marginTop: 4,
    color: AppTheme.colors.clay,
    fontFamily: AppTheme.fonts.body,
  },
  successBar: {
    marginTop: 18,
    backgroundColor: '#FFF7EC',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  successLabel: {
    fontFamily: AppTheme.fonts.body,
    color: AppTheme.colors.clay,
  },
  successValue: {
    marginTop: 4,
    fontFamily: AppTheme.fonts.heading,
    fontSize: 16,
    color: AppTheme.colors.ink,
  },
  onboardingCard: {
    marginTop: 16,
    backgroundColor: AppTheme.colors.sky,
    padding: 16,
    borderRadius: 16,
  },
  onboardingTitle: {
    fontFamily: AppTheme.fonts.heading,
    fontSize: 16,
    color: AppTheme.colors.night,
  },
  onboardingText: {
    marginTop: 6,
    fontFamily: AppTheme.fonts.body,
    color: AppTheme.colors.night,
  },
  drawArea: {
    marginTop: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawButtonWrap: {
    position: 'absolute',
  },
  drawButton: {
    width: 150,
    height: 150,
    borderRadius: 999,
    backgroundColor: AppTheme.colors.ember,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
  },
  drawButtonLocked: {
    backgroundColor: AppTheme.colors.clay,
  },
  drawButtonText: {
    fontFamily: AppTheme.fonts.heading,
    color: '#FFF7EC',
    letterSpacing: 2,
    fontSize: 20,
  },
  drawCard: {
    marginTop: 24,
    backgroundColor: '#FFFDF8',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  drawLabel: {
    fontFamily: AppTheme.fonts.body,
    color: AppTheme.colors.clay,
    fontSize: 12,
  },
  drawTitle: {
    marginTop: 6,
    fontFamily: AppTheme.fonts.heading,
    color: AppTheme.colors.ink,
    fontSize: 18,
  },
  bonusText: {
    marginTop: 8,
    fontFamily: AppTheme.fonts.body,
    color: AppTheme.colors.gold,
  },
  activeCard: {
    marginTop: 20,
    backgroundColor: '#FFF7EC',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  activeTitle: {
    fontFamily: AppTheme.fonts.body,
    color: AppTheme.colors.clay,
  },
  activeTaskTitle: {
    marginTop: 6,
    fontFamily: AppTheme.fonts.heading,
    color: AppTheme.colors.ink,
    fontSize: 18,
  },
  subtaskList: {
    marginTop: 12,
  },
  subtaskItem: {
    paddingVertical: 8,
  },
  subtaskText: {
    fontFamily: AppTheme.fonts.body,
    color: AppTheme.colors.ink,
  },
  subtaskDone: {
    opacity: 0.6,
  },
  subtaskTextDone: {
    textDecorationLine: 'line-through',
  },
  completeButton: {
    marginTop: 14,
    backgroundColor: AppTheme.colors.moss,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  completeButtonLocked: {
    backgroundColor: AppTheme.colors.clay,
  },
  completeButtonText: {
    fontFamily: AppTheme.fonts.body,
    color: '#F5F0E6',
  },
  bonusInline: {
    marginTop: 10,
    fontFamily: AppTheme.fonts.body,
    color: AppTheme.colors.ember,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: AppTheme.colors.parchment,
    padding: 20,
    borderRadius: 20,
  },
  modalTitle: {
    fontFamily: AppTheme.fonts.heading,
    fontSize: 18,
    color: AppTheme.colors.ink,
  },
  modalText: {
    marginTop: 8,
    fontFamily: AppTheme.fonts.body,
    color: AppTheme.colors.night,
  },
  modalOption: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFF7EC',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
  },
  modalOptionText: {
    fontFamily: AppTheme.fonts.body,
    color: AppTheme.colors.ink,
  },
  modalAlt: {
    marginTop: 14,
    alignItems: 'center',
  },
  modalAltText: {
    fontFamily: AppTheme.fonts.body,
    color: AppTheme.colors.ember,
  },
  rescueTask: {
    marginTop: 12,
    padding: 12,
    backgroundColor: AppTheme.colors.sky,
    borderRadius: 12,
  },
  rescueTaskText: {
    fontFamily: AppTheme.fonts.heading,
    color: AppTheme.colors.night,
  },
});
