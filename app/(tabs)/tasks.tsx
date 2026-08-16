import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppTheme } from '@/constants/app-theme';
import { ImportanceWeight } from '@/lib/types';
import { clarityCheck, useAppStore } from '@/lib/store';

const weights: ImportanceWeight[] = ['LOW', 'MEDIUM', 'HIGH'];

export default function TasksScreen() {
  const addTaskAuto = useAppStore((s) => s.addTaskAuto);
  const tasks = useAppStore((s) => s.tasks);
  const toggleTaskCompleted = useAppStore((s) => s.toggleTaskCompleted);

  const [draft, setDraft] = useState('');
  const [weight, setWeight] = useState<ImportanceWeight>('MEDIUM');
  const [clarifyOpen, setClarifyOpen] = useState(false);
  const [clarifyQuestion, setClarifyQuestion] = useState('');
  const [clarifyOptions, setClarifyOptions] = useState<string[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [suspendCheck, setSuspendCheck] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sortedTasks = useMemo(
    () => [...tasks].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [tasks]
  );

  useEffect(() => {
    if (!draft.trim()) return;
    if (suspendCheck) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      setIsChecking(true);
      try {
        const result = await clarityCheck(draft.trim());
        if (result.status === 'CLEAR') {
          await addTaskAuto(draft.trim(), weight);
          setDraft('');
        } else {
          setClarifyQuestion(result.question);
          setClarifyOptions(result.options);
          setSuspendCheck(true);
          setClarifyOpen(true);
        }
      } catch {
        await addTaskAuto(draft.trim(), weight);
        setDraft('');
      } finally {
        setIsChecking(false);
      }
    }, 1000);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [draft, weight, addTaskAuto, suspendCheck]);

  const handleOption = (option: string) => {
    setClarifyOpen(false);
    setSuspendCheck(false);
    setDraft(option);
  };

  const handleCustom = () => {
    setClarifyOpen(false);
    setSuspendCheck(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.title}>Tasks</Text>
      <Text style={styles.subtitle}>Quick thoughts turn into clear actions.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>New task</Text>
        <TextInput
          value={draft}
          onChangeText={(text) => {
            setDraft(text);
            setSuspendCheck(false);
          }}
          placeholder="Clean desk"
          placeholderTextColor={AppTheme.colors.clay}
          style={styles.input}
        />
        <View style={styles.weightRow}>
          {weights.map((w) => (
            <Pressable
              key={w}
              onPress={() => setWeight(w)}
              style={[styles.weightChip, weight === w && styles.weightChipActive]}>
              <Text style={[styles.weightText, weight === w && styles.weightTextActive]}>{w}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.helperText}>
          {isChecking ? 'Checking clarity...' : 'Stops typing for 1 second to auto-save.'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {sortedTasks.map((task) => (
          <Pressable
            key={task.id}
            style={[styles.taskItem, task.isCompleted ? styles.taskItemDone : null]}
            onPress={() => toggleTaskCompleted(task.id, task.isCompleted === 0)}>
            <View style={styles.taskMeta}>
              <Text style={[styles.taskTitle, task.isCompleted ? styles.taskTitleDone : null]}>
                {task.title}
              </Text>
              <Text style={styles.taskWeight}>{task.importanceWeight}</Text>
            </View>
            <Text style={styles.taskStatus}>{task.isCompleted ? 'Done' : 'Open'}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Modal visible={clarifyOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>It looks like a quick thought.</Text>
            <Text style={styles.modalText}>{clarifyQuestion}</Text>
            {clarifyOptions.map((opt) => (
              <Pressable key={opt} style={styles.modalOption} onPress={() => handleOption(opt)}>
                <Text style={styles.modalOptionText}>{opt}</Text>
              </Pressable>
            ))}
            <Pressable style={styles.modalAlt} onPress={handleCustom}>
              <Text style={styles.modalAltText}>Something else</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppTheme.colors.parchment,
    padding: 20,
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
  card: {
    marginTop: 20,
    backgroundColor: '#FFF7EC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  label: {
    fontFamily: AppTheme.fonts.body,
    color: AppTheme.colors.ink,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: AppTheme.fonts.body,
    color: AppTheme.colors.ink,
    backgroundColor: '#FFFEFB',
  },
  weightRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  weightChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  weightChipActive: {
    backgroundColor: AppTheme.colors.ember,
    borderColor: AppTheme.colors.ember,
  },
  weightText: {
    fontFamily: AppTheme.fonts.body,
    color: AppTheme.colors.ink,
    fontSize: 12,
  },
  weightTextActive: {
    color: '#FFF7EC',
  },
  helperText: {
    marginTop: 10,
    fontFamily: AppTheme.fonts.body,
    color: AppTheme.colors.clay,
    fontSize: 12,
  },
  list: {
    paddingTop: 16,
    paddingBottom: 60,
  },
  taskItem: {
    backgroundColor: '#FFFDF8',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  taskItemDone: {
    opacity: 0.6,
  },
  taskMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  taskTitle: {
    fontFamily: AppTheme.fonts.heading,
    fontSize: 16,
    color: AppTheme.colors.ink,
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
  },
  taskWeight: {
    fontFamily: AppTheme.fonts.body,
    color: AppTheme.colors.clay,
    fontSize: 12,
  },
  taskStatus: {
    marginTop: 8,
    fontFamily: AppTheme.fonts.body,
    color: AppTheme.colors.moss,
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
});
