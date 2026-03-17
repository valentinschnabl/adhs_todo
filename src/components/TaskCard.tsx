import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Task } from '../db/tasks';
import { COLORS } from '../theme';

interface TaskCardProps {
  task: Task;
  onComplete?: () => void;
}

const IMPORTANCE_COLORS = {
  LOW: '#7A7060',
  MEDIUM: '#C4924A',
  HIGH: '#C46A6A',
};

const IMPORTANCE_LABELS = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
};

export function TaskCard({ task, onComplete }: TaskCardProps) {
  const translateX = useSharedValue(0);
  const rotateY = useSharedValue(90);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 200 });
    rotateY.value = withTiming(0, { duration: 600 });

    const shakeDelay = setTimeout(() => {
      translateX.value = withSequence(
        withTiming(-8, { duration: 50 }),
        withTiming(8, { duration: 50 }),
        withTiming(-5, { duration: 50 }),
        withTiming(5, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );
    }, 600);

    return () => clearTimeout(shakeDelay);
  }, [task.id]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { perspective: 1000 },
      { rotateY: rotateY.value + 'deg' },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.card, animatedStyle]}>
      <View style={styles.header}>
        <Text style={styles.label}>Current Task</Text>
        <View
          style={[
            styles.importanceBadge,
            { backgroundColor: IMPORTANCE_COLORS[task.importanceWeight] + '22' },
          ]}
        >
          <View
            style={[styles.dot, { backgroundColor: IMPORTANCE_COLORS[task.importanceWeight] }]}
          />
          <Text style={[styles.importanceText, { color: IMPORTANCE_COLORS[task.importanceWeight] }]}>
            {IMPORTANCE_LABELS[task.importanceWeight]}
          </Text>
        </View>
      </View>

      <Text style={styles.taskTitle}>{task.title}</Text>

      {onComplete && (
        <TouchableOpacity style={styles.completeButton} onPress={onComplete}>
          <Text style={styles.completeButtonText}>Mark done</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    color: COLORS.subtext,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  importanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    gap: 5,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  importanceText: {
    fontSize: 11,
    fontWeight: '600',
  },
  taskTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 30,
    marginBottom: 16,
  },
  completeButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.success,
  },
  completeButtonText: {
    color: COLORS.background,
    fontSize: 14,
    fontWeight: '700',
  },
});
