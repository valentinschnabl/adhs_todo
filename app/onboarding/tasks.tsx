import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';
import { insertTask, updateTask } from '../../src/db/tasks';
import { checkClarity } from '../../src/services/gemini';
import { hasGeminiApiKey } from '../../src/services/env';
import { COLORS } from '../../src/theme';

type ImportanceWeight = 'LOW' | 'MEDIUM' | 'HIGH';
type ClarityStatus = 'idle' | 'checking' | 'clear' | 'vague' | 'skipped';

interface LocalTask {
  title: string;
  importanceWeight: ImportanceWeight;
  clarityStatus: 'clear' | 'skipped';
}

const IMPORTANCE_COLORS: Record<ImportanceWeight, string> = {
  LOW: '#6B7280',
  MEDIUM: '#F59E0B',
  HIGH: '#EF4444',
};

function normalize(s: string) {
  return s.toLowerCase().trim().replace(/\s+/g, ' ');
}

async function resolveTaskClarity(
  taskTitle: string,
  setClarityStatus: (status: ClarityStatus) => void,
  setVagueData: (data: { question: string; options: string[] } | null) => void,
  lastCheckedRef: React.MutableRefObject<string>
) {
  const normalized = normalize(taskTitle);

  if (!hasGeminiApiKey() || normalized.length < 3) {
    setClarityStatus('skipped');
    lastCheckedRef.current = normalized;
    return { result: 'CLEAR', question: null, options: null } as const;
  }

  setClarityStatus('checking');

  try {
    const result = await checkClarity(taskTitle.trim());
    lastCheckedRef.current = normalized;

    if (result.result === 'VAGUE' && result.question && result.options) {
      setClarityStatus('vague');
      setVagueData({ question: result.question, options: result.options });
      return result;
    }

    setClarityStatus('clear');
    setVagueData(null);
    return result;
  } catch {
    setClarityStatus('skipped');
    lastCheckedRef.current = normalized;
    return { result: 'CLEAR', question: null, options: null } as const;
  }
}

function buildLocalTask(
  title: string,
  importanceWeight: ImportanceWeight,
  clarityStatus: LocalTask['clarityStatus']
): LocalTask {
  return {
    title,
    importanceWeight,
    clarityStatus,
  };
}

export default function OnboardingTasksScreen() {
  const db = useSQLiteContext();
  const [title, setTitle] = useState('');
  const [importance, setImportance] = useState<ImportanceWeight>('MEDIUM');
  const [tasks, setTasks] = useState<LocalTask[]>([]);
  const [saving, setSaving] = useState(false);
  const [clarityStatus, setClarityStatus] = useState<ClarityStatus>('idle');
  const [vagueData, setVagueData] = useState<{ question: string; options: string[] } | null>(null);
  const [showVagueModal, setShowVagueModal] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCheckedRef = useRef('');

  function resetInput() {
    setTitle('');
    setImportance('MEDIUM');
    setClarityStatus('idle');
    setVagueData(null);
    lastCheckedRef.current = '';
  }

  function appendTask(taskTitle: string, taskClarityStatus: LocalTask['clarityStatus']) {
    setTasks((prev) => [
      ...prev,
      buildLocalTask(taskTitle, importance, taskClarityStatus),
    ]);
    resetInput();
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const normalized = normalize(title);
    const canUseAi = hasGeminiApiKey();

    if (normalized.length < 3) {
      setClarityStatus('idle');
      return;
    }

    if (normalized === lastCheckedRef.current) return;

    if (!canUseAi) {
      setClarityStatus('skipped');
      return;
    }

    setClarityStatus('checking');
    debounceRef.current = setTimeout(async () => {
      await resolveTaskClarity(
        title.trim(),
        setClarityStatus,
        setVagueData,
        lastCheckedRef
      );
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [title]);

  async function addTask() {
    const trimmed = title.trim();
    if (!trimmed) {
      Alert.alert('Please enter a task title');
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    let nextClarityStatus: LocalTask['clarityStatus'] = clarityStatus === 'clear' ? 'clear' : 'skipped';

    if (hasGeminiApiKey() && normalize(trimmed).length >= 3) {
      const shouldForceCheck =
        lastCheckedRef.current !== normalize(trimmed)
        || clarityStatus === 'checking'
        || clarityStatus === 'idle';

      if (shouldForceCheck) {
        const result = await resolveTaskClarity(
          trimmed,
          setClarityStatus,
          setVagueData,
          lastCheckedRef
        );

        if (result.result === 'VAGUE' && result.question && result.options) {
          setShowVagueModal(true);
          return;
        }

        nextClarityStatus = 'clear';
      }
    }

    if (clarityStatus === 'vague') {
      setShowVagueModal(true);
      return;
    }

    if (clarityStatus === 'clear') {
      nextClarityStatus = 'clear';
    }

    appendTask(trimmed, nextClarityStatus);
  }

  function handleSelectOption(option: string) {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    setShowVagueModal(false);
    appendTask(option, 'clear');
  }

  function removeTask(index: number) {
    setTasks((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleContinue() {
    if (tasks.length < 3) {
      Alert.alert('Add at least 3 tasks to continue');
      return;
    }

    setSaving(true);
    try {
      for (const task of tasks) {
        const id = await insertTask(db, task.title, task.importanceWeight);
        if (task.clarityStatus === 'clear') {
          await updateTask(db, id, { clarity_status: 'clear' });
        }
      }

      router.push('/onboarding/rewards');
    } catch (error) {
      console.error('Error saving tasks:', error);
      Alert.alert('Error saving tasks. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const canContinue = tasks.length >= 3;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.stepText}>Step 1 of 2</Text>
          <Text style={styles.title}>Add your tasks</Text>
          <Text style={styles.subtitle}>
            Add at least 3 tasks that you need to get done. These go into your draw pool.
          </Text>
        </View>

        {/* Input area */}
        <View style={styles.inputCard}>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="What needs to be done?"
            placeholderTextColor={COLORS.subtext}
            returnKeyType="done"
            onSubmitEditing={addTask}
          />

          {/* AI clarity indicator - removed per user request */}

          <Text style={styles.importanceLabel}>Importance</Text>
          <View style={styles.importanceRow}>
            {(['LOW', 'MEDIUM', 'HIGH'] as ImportanceWeight[]).map((level) => (
              <TouchableOpacity
                key={level}
                style={[
                  styles.importanceButton,
                  importance === level && {
                    backgroundColor: IMPORTANCE_COLORS[level] + '33',
                    borderColor: IMPORTANCE_COLORS[level],
                  },
                ]}
                onPress={() => setImportance(level)}
              >
                <Text
                  style={[
                    styles.importanceButtonText,
                    importance === level && { color: IMPORTANCE_COLORS[level] },
                  ]}
                >
                  {level}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.addButton, clarityStatus === 'checking' && styles.addButtonDisabled]}
            onPress={addTask}
            activeOpacity={clarityStatus === 'checking' ? 1 : 0.8}
          >
            <Text style={[styles.addButtonText, clarityStatus === 'checking' && styles.addButtonTextDisabled]}>+ Add Task</Text>
          </TouchableOpacity>

          {clarityStatus === 'checking' && (
            <View style={styles.loadingIndicator}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.loadingText}>Checking clarity...</Text>
            </View>
          )}
        </View>

        {/* Task list */}
        {tasks.length > 0 && (
          <View style={styles.taskList}>
            <Text style={styles.listHeader}>Added ({tasks.length}/3 minimum)</Text>
            {tasks.map((task, index) => (
              <View key={index} style={styles.taskItem}>
                <View
                  style={[styles.importanceDot, { backgroundColor: IMPORTANCE_COLORS[task.importanceWeight] }]}
                />
                <Text style={styles.taskItemText} numberOfLines={2}>
                  {task.title}
                </Text>
                <TouchableOpacity onPress={() => removeTask(index)} style={styles.removeButton}>
                  <Text style={styles.removeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {tasks.length < 3 && (
          <Text style={styles.hintText}>
            {3 - tasks.length} more task{3 - tasks.length !== 1 ? 's' : ''} needed to continue
          </Text>
        )}

        <TouchableOpacity
          style={[styles.continueButton, !canContinue && styles.continueButtonDisabled]}
          onPress={handleContinue}
          disabled={!canContinue || saving}
          activeOpacity={0.8}
        >
          <Text style={styles.continueButtonText}>
            {saving ? 'Setting up tasks...' : 'Continue →'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* VAGUE clarification modal */}
      <Modal
        visible={showVagueModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowVagueModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalHint}>It looks like a quick thought.</Text>
            <Text style={styles.modalQuestion}>{vagueData?.question}</Text>

            <View style={styles.optionsList}>
              {vagueData?.options.map((opt, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.optionButton}
                  onPress={() => handleSelectOption(opt)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.optionLabel}>{String.fromCharCode(65 + i)})</Text>
                  <Text style={styles.optionText}>{opt}</Text>
                </TouchableOpacity>
              ))}
              {/* Option D: Original task text */}
              <TouchableOpacity
                style={styles.optionButton}
                onPress={() => handleSelectOption(title)}
                activeOpacity={0.8}
              >
                <Text style={styles.optionLabel}>D)</Text>
                <Text style={styles.optionText}>{title}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.somethingElseButton}
              onPress={() => setShowVagueModal(false)}
            >
              <Text style={styles.somethingElseText}>Something else (keep editing)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 48,
  },
  header: {
    marginBottom: 24,
  },
  stepText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: COLORS.subtext,
    fontSize: 15,
    lineHeight: 22,
  },
  inputCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  input: {
    color: COLORS.text,
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 8,
  },
  importanceLabel: {
    color: COLORS.subtext,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  importanceRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  importanceButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  importanceButtonText: {
    color: COLORS.subtext,
    fontSize: 13,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  addButtonText: {
    color: '#141210',
    fontSize: 16,
    fontWeight: '700',
  },
  addButtonTextDisabled: {
    opacity: 0.7,
  },
  loadingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 8,
  },
  loadingText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  taskList: {
    marginBottom: 20,
  },
  listHeader: {
    color: COLORS.subtext,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  importanceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  taskItemText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
  },
  removeButton: {
    padding: 4,
  },
  removeButtonText: {
    color: COLORS.subtext,
    fontSize: 14,
  },
  hintText: {
    color: COLORS.subtext,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  continueButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: '#2E2418',
    shadowOpacity: 0,
  },
  continueButtonText: {
    color: '#141210',
    fontSize: 18,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  modalHint: {
    color: COLORS.subtext,
    fontSize: 13,
    marginBottom: 8,
  },
  modalQuestion: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
    lineHeight: 26,
  },
  optionsList: {
    gap: 10,
    marginBottom: 16,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(124,58,237,0.1)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  optionLabel: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '700',
    width: 24,
  },
  optionText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
  },
  somethingElseButton: {
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  somethingElseText: {
    color: COLORS.subtext,
    fontSize: 15,
  },
});
