import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Subtask } from '../db/subtasks';
import { COLORS } from '../theme';

interface SubtaskChecklistProps {
  subtasks: Subtask[];
  onToggle: (id: number) => void;
}

export function SubtaskChecklist({ subtasks, onToggle }: SubtaskChecklistProps) {
  const completedCount = subtasks.filter((s) => s.isCompleted).length;
  const total = subtasks.length;
  const [collapsed, setCollapsed] = useState(true);

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.header} onPress={() => setCollapsed((prev) => !prev)} activeOpacity={0.8}>
        <Text style={styles.headerTitle}>Steps</Text>
        <View style={styles.headerRight}>
          <Text style={styles.progress}>{completedCount}/{total}</Text>
          <Text style={styles.chevron}>{collapsed ? '▼' : '▲'}</Text>
        </View>
      </TouchableOpacity>

      {!collapsed && (
        <>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                { width: total > 0 ? `${(completedCount / total) * 100}%` : '0%' },
              ]}
            />
          </View>

          {subtasks.map((subtask) => (
            <TouchableOpacity
              key={subtask.id}
              style={[styles.row, !!subtask.isCompleted && styles.rowCompleted]}
              onPress={() => onToggle(subtask.id)}
              activeOpacity={0.6}
            >
              <View style={[styles.checkbox, !!subtask.isCompleted && styles.checkboxChecked]}>
                {!!subtask.isCompleted && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={[styles.stepText, !!subtask.isCompleted && styles.stepTextDone]}>
                {subtask.title}
              </Text>
            </TouchableOpacity>
          ))}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: COLORS.subtext,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  chevron: {
    color: COLORS.subtext,
    fontSize: 11,
    fontWeight: '700',
  },
  progress: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  progressBarBg: {
    height: 3,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.success,
    borderRadius: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rowCompleted: {
    opacity: 0.5,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  checkmark: {
    color: COLORS.background,
    fontSize: 12,
    fontWeight: '700',
  },
  stepText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 20,
  },
  stepTextDone: {
    textDecorationLine: 'line-through',
    color: COLORS.subtext,
  },
});
