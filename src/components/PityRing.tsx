import React from 'react';
import { View, StyleSheet } from 'react-native';
import { COLORS } from '../theme';

interface PityRingProps {
  drawsSinceReward: number;
  maxDraws?: number;
  size?: number;
  children?: React.ReactNode;
}

export function PityRing({
  drawsSinceReward,
  maxDraws = 4,
  size = 180,
  children,
}: PityRingProps) {
  const ringSize = size + 24;

  // Render 4 segment indicators around the ring
  const segments = Array.from({ length: maxDraws }, (_, i) => i);

  return (
    <View style={[styles.container, { width: ringSize, height: ringSize }]}>
      {/* Segment dots */}
      {segments.map((i) => {
        const angle = (i / maxDraws) * 2 * Math.PI - Math.PI / 2;
        const radius = ringSize / 2 - 6;
        const x = ringSize / 2 + radius * Math.cos(angle) - 6;
        const y = ringSize / 2 + radius * Math.sin(angle) - 6;
        const filled = i < drawsSinceReward;

        return (
          <View
            key={i}
            style={[
              styles.segment,
              {
                left: x,
                top: y,
                backgroundColor: filled ? COLORS.success : COLORS.border,
              },
            ]}
          />
        );
      })}

      {/* Center content */}
      <View style={styles.centerContent}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segment: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  centerContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
