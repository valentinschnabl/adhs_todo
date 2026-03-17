import React, { useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { COLORS } from '../theme';

interface DrawButtonProps {
  onPress: () => void;
  isLocked: boolean;
}

export function DrawButton({ onPress, isLocked }: DrawButtonProps) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!isLocked) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.04, { duration: 900 }),
          withTiming(1.0, { duration: 900 })
        ),
        -1,
        true
      );
    } else {
      scale.value = withTiming(1.0, { duration: 300 });
    }
  }, [isLocked]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        style={[styles.button, isLocked && styles.buttonLocked]}
        onPress={onPress}
        disabled={isLocked}
        activeOpacity={0.85}
      >
        <Text style={[styles.buttonText, isLocked && styles.buttonTextLocked]}>
          DRAW
        </Text>
        {!isLocked && <Text style={styles.buttonSubtext}>tap to draw</Text>}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 148,
    height: 148,
    borderRadius: 74,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 10,
  },
  buttonLocked: {
    backgroundColor: COLORS.cardAlt,
    shadowOpacity: 0,
  },
  buttonText: {
    color: COLORS.background,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 3,
  },
  buttonTextLocked: {
    color: COLORS.subtext,
  },
  buttonSubtext: {
    color: 'rgba(20,18,16,0.5)',
    fontSize: 11,
    marginTop: 4,
    letterSpacing: 1,
  },
});
