import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { Reward } from '../db/rewards';
import { COLORS } from '../theme';

interface RewardCardProps {
  reward: Reward;
  isBonusReward?: boolean;
}

export function RewardCard({ reward, isBonusReward = false }: RewardCardProps) {
  const rotateY = useSharedValue(90);
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 200 });
    rotateY.value = withTiming(0, { duration: 600 });
    scale.value = withSequence(
      withTiming(1.04, { duration: 400 }),
      withSpring(1, { damping: 12, stiffness: 120 })
    );
  }, [reward.id]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1000 },
      { rotateY: rotateY.value + 'deg' },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.card, animatedStyle]}>
      <View style={styles.topRow}>
        <Text style={styles.icon}>{isBonusReward ? '🎁' : '🏆'}</Text>
        <Text style={styles.badge}>{isBonusReward ? 'BONUS' : 'REWARD'}</Text>
      </View>

      <Text style={styles.rewardTitle}>{reward.title}</Text>

      <Text style={styles.subline}>Take a moment and enjoy it.</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  icon: {
    fontSize: 28,
  },
  badge: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  rewardTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 30,
    marginBottom: 6,
  },
  subline: {
    color: COLORS.subtext,
    fontSize: 13,
    marginTop: 4,
  },
});
