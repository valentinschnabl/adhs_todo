import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getAllIncompleteTasks,
  getAllCompletedTasks,
  insertTask,
  markTaskCompleted,
  markTaskIncomplete,
  deleteAllCompletedTasks,
  deleteTask,
  Task,
} from '../../src/db/tasks';
import {
  getAllRewards,
  insertReward,
  deleteReward,
  Reward,
} from '../../src/db/rewards';
import { checkClarity } from '../../src/services/gemini';
import { hasGeminiApiKey } from '../../src/services/env';
import { ensureQualitySubtasksForTask } from '../../src/services/subtasks';
import { COLORS } from '../../src/theme';

type ImportanceWeight = 'LOW' | 'MEDIUM' | 'HIGH';
type ClarityStatus = 'idle' | 'checking' | 'clear' | 'vague' | 'skipped';
type AddTarget = 'task' | 'reward';

const IMPORTANCE_COLORS: Record<ImportanceWeight, string> = {
  LOW: '#7A7060',
  MEDIUM: '#C4924A',
  HIGH: '#C46A6A',
};



export default function TasksScreen() {
  const db = useSQLiteContext();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [activeTab, setActiveTab] = useState<'tasks' | 'rewards'>('tasks');
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);

  // Task form
  const [taskTitle, setTaskTitle] = useState('');
  const [importance, setImportance] = useState<ImportanceWeight>('MEDIUM');
  const [showTaskForm, setShowTaskForm] = useState(false);

  // Reward form
  const [rewardTitle, setRewardTitle] = useState('');
  const [showRewardForm, setShowRewardForm] = useState(false);
  const [taskClarityStatus, setTaskClarityStatus] = useState<ClarityStatus>('idle');
  const [rewardClarityStatus, setRewardClarityStatus] = useState<ClarityStatus>('idle');
  const [taskVagueData, setTaskVagueData] = useState<{ question: string; options: string[] } | null>(null);
  const [rewardVagueData, setRewardVagueData] = useState<{ question: string; options: string[] } | null>(null);
  const [showVagueModal, setShowVagueModal] = useState(false);
  const [vagueModalTarget, setVagueModalTarget] = useState<'task' | 'reward' | null>(null);
  const [vagueOriginalInput, setVagueOriginalInput] = useState('');

  const taskDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rewardDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTaskCheckedRef = useRef('');
  const lastRewardCheckedRef = useRef('');

  const loadData = useCallback(async () => {
    try {
      const [t, completed, r] = await Promise.all([
        getAllIncompleteTasks(db),
        getAllCompletedTasks(db),
        getAllRewards(db),
      ]);
      setTasks(t);
      setCompletedTasks(completed);
      setRewards(r);
    } catch (error) {
      console.error('Load error:', error);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  function normalize(value: string) {
    return value.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  async function runClarityCheck(
    rawText: string,
    setStatus: (status: ClarityStatus) => void,
    setVagueData: (data: { question: string; options: string[] } | null) => void,
    lastCheckedRef: React.MutableRefObject<string>
  ) {
    const normalized = normalize(rawText);
    if (!hasGeminiApiKey() || normalized.length < 3) {
      setStatus('skipped');
      setVagueData(null);
      lastCheckedRef.current = normalized;
      return { result: 'CLEAR', question: null, options: null } as const;
    }

    setStatus('checking');
    try {
      const result = await checkClarity(rawText.trim());
      lastCheckedRef.current = normalized;
      if (result.result === 'VAGUE' && result.question && result.options) {
        setStatus('vague');
        setVagueData({ question: result.question, options: result.options });
        return result;
      }

      setStatus('clear');
      setVagueData(null);
      return result;
    } catch {
      setStatus('skipped');
      setVagueData(null);
      lastCheckedRef.current = normalized;
      return { result: 'CLEAR', question: null, options: null } as const;
    }
  }

  useEffect(() => {
    if (taskDebounceRef.current) clearTimeout(taskDebounceRef.current);
    if (!showTaskForm || activeTab !== 'tasks') return;

    const normalized = normalize(taskTitle);
    if (normalized.length < 3) {
      setTaskClarityStatus('idle');
      return;
    }
    if (normalized === lastTaskCheckedRef.current) return;

    // Grey the button immediately — check is pending
    setTaskClarityStatus('idle');

    taskDebounceRef.current = setTimeout(() => {
      void runClarityCheck(taskTitle, setTaskClarityStatus, setTaskVagueData, lastTaskCheckedRef);
    }, 700);

    return () => {
      if (taskDebounceRef.current) clearTimeout(taskDebounceRef.current);
    };
  }, [taskTitle, showTaskForm, activeTab]);

  useEffect(() => {
    if (rewardDebounceRef.current) clearTimeout(rewardDebounceRef.current);
    if (!showRewardForm || activeTab !== 'rewards') return;

    const normalized = normalize(rewardTitle);
    if (normalized.length < 3) {
      setRewardClarityStatus('idle');
      return;
    }
    if (normalized === lastRewardCheckedRef.current) return;

    // Grey the button immediately — check is pending
    setRewardClarityStatus('idle');

    rewardDebounceRef.current = setTimeout(() => {
      void runClarityCheck(rewardTitle, setRewardClarityStatus, setRewardVagueData, lastRewardCheckedRef);
    }, 700);

    return () => {
      if (rewardDebounceRef.current) clearTimeout(rewardDebounceRef.current);
    };
  }, [rewardTitle, showRewardForm, activeTab]);

  async function generateAndStoreTaskSubtasks(taskId: number, title: string) {
    try {
      await ensureQualitySubtasksForTask(db, taskId, title);
    } catch {
      // Silently ignore — task runs without pre-generated steps
    }
  }

  async function saveTask(resolvedTitle: string) {
    const taskId = await insertTask(db, resolvedTitle, importance);
    // Fire subtask generation in background — don't block the UI
    void generateAndStoreTaskSubtasks(taskId, resolvedTitle);
    setTaskTitle('');
    setImportance('MEDIUM');
    setTaskClarityStatus('idle');
    setTaskVagueData(null);
    lastTaskCheckedRef.current = '';
    setShowTaskForm(false);
    await loadData();
  }

  async function saveReward(resolvedTitle: string) {
    await insertReward(db, resolvedTitle);
    setRewardTitle('');
    setRewardClarityStatus('idle');
    setRewardVagueData(null);
    lastRewardCheckedRef.current = '';
    setShowRewardForm(false);
    await loadData();
  }

  function closeTaskForm() {
    if (taskDebounceRef.current) clearTimeout(taskDebounceRef.current);
    setTaskTitle('');
    setImportance('MEDIUM');
    setTaskClarityStatus('idle');
    setTaskVagueData(null);
    lastTaskCheckedRef.current = '';
    setShowTaskForm(false);
  }

  function closeRewardForm() {
    if (rewardDebounceRef.current) clearTimeout(rewardDebounceRef.current);
    setRewardTitle('');
    setRewardClarityStatus('idle');
    setRewardVagueData(null);
    lastRewardCheckedRef.current = '';
    setShowRewardForm(false);
  }

  async function handleAddItem(target: AddTarget) {
    const isTask = target === 'task';
    const trimmed = (isTask ? taskTitle : rewardTitle).trim();
    if (!trimmed) return;

    const clarityStatus = isTask ? taskClarityStatus : rewardClarityStatus;
    const debounceRef = isTask ? taskDebounceRef : rewardDebounceRef;
    const lastCheckedRef = isTask ? lastTaskCheckedRef : lastRewardCheckedRef;
    const setStatus = isTask ? setTaskClarityStatus : setRewardClarityStatus;
    const setVagueData = isTask ? setTaskVagueData : setRewardVagueData;
    const vagueData = isTask ? taskVagueData : rewardVagueData;
    const save = isTask ? saveTask : saveReward;

    // Prevent keyboard-submit race while check is in-flight
    if (clarityStatus === 'checking') return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    try {
      // Text changed since last check (e.g. keyboard submit before debounce fired)
      if (hasGeminiApiKey() && normalize(trimmed).length >= 3 && lastCheckedRef.current !== normalize(trimmed)) {
        const result = await runClarityCheck(trimmed, setStatus, setVagueData, lastCheckedRef);
        if (result.result === 'VAGUE' && result.question && result.options) {
          setVagueModalTarget(target);
          setVagueOriginalInput(trimmed);
          setShowVagueModal(true);
          return;
        }
        await save(trimmed);
        return;
      }

      // Check already completed — use the cached result
      if (clarityStatus === 'vague' && vagueData) {
        setVagueModalTarget(target);
        setVagueOriginalInput(trimmed);
        setShowVagueModal(true);
        return;
      }

      await save(trimmed);
    } catch (error) {
      console.error(`[AI][${isTask ? 'Task' : 'Reward'}Add] Failed`, error);
      try {
        await save(trimmed);
        Alert.alert('AI unavailable', `${isTask ? 'Task' : 'Reward'} saved without AI check.`);
      } catch {
        Alert.alert(`Error adding ${isTask ? 'task' : 'reward'}`);
      }
    }
  }

  async function handleAddTask() {
    await handleAddItem('task');
  }

  async function handleCompleteTask(id: number) {
    try {
      await markTaskCompleted(db, id);
      await loadData();
    } catch {
      Alert.alert('Error');
    }
  }

  async function handleDeleteTask(id: number) {
    Alert.alert('Delete task?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTask(db, id);
            await loadData();
          } catch (error) {
            console.error('Delete task failed:', error);
            Alert.alert('Error deleting task');
          }
        },
      },
    ]);
  }

  async function handleAddReward() {
    await handleAddItem('reward');
  }

  async function handleSelectOption(option: string) {
    setShowVagueModal(false);

    try {
      if (vagueModalTarget === 'task') {
        setTaskClarityStatus('clear');
        setTaskVagueData(null);
        lastTaskCheckedRef.current = normalize(option);
        await saveTask(option);
      }

      if (vagueModalTarget === 'reward') {
        setRewardClarityStatus('clear');
        setRewardVagueData(null);
        lastRewardCheckedRef.current = normalize(option);
        await saveReward(option);
      }
    } catch {
      Alert.alert('Error adding item');
    } finally {
      setVagueModalTarget(null);
      setVagueOriginalInput('');
    }
  }

  async function handleDeleteReward(id: number) {
    Alert.alert('Delete reward?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteReward(db, id);
            await loadData();
          } catch (error) {
            console.error('Delete reward failed:', error);
            Alert.alert('Error deleting reward');
          }
        },
      },
    ]);
  }

  async function handleRestoreCompletedTask(id: number) {
    try {
      await markTaskIncomplete(db, id);
      await loadData();
    } catch {
      Alert.alert('Error restoring task');
    }
  }

  function handleDeleteAllCompleted() {
    const total = completedTasks.length;
    if (total === 0) return;

    Alert.alert(
      'Delete completed tasks?',
      `Are you sure you want to delete ${total} task${total === 1 ? '' : 's'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteAllCompletedTasks(db);
            await loadData();
            setShowCompletedTasks(false);
          },
        },
      ]
    );
  }

  const apiKeyAvailable = hasGeminiApiKey();
  const taskNormalizedLen = normalize(taskTitle).length;
  const rewardNormalizedLen = normalize(rewardTitle).length;
  const taskNeedsClarityGate = apiKeyAvailable && taskNormalizedLen >= 3;
  const rewardNeedsClarityGate = apiKeyAvailable && rewardNormalizedLen >= 3;
  const taskAddDisabled = taskNormalizedLen < 3 || (taskNeedsClarityGate && (taskClarityStatus === 'idle' || taskClarityStatus === 'checking'));
  const rewardAddDisabled = rewardNormalizedLen < 3 || (rewardNeedsClarityGate && (rewardClarityStatus === 'idle' || rewardClarityStatus === 'checking'));

  const currentVagueOptions = vagueModalTarget === 'task' ? taskVagueData?.options : rewardVagueData?.options;
  const originalOptionLabel = currentVagueOptions
    ? `${String.fromCharCode(65 + currentVagueOptions.length)})`
    : 'D)';

  return (
    <SafeAreaView style={styles.container}>
      {/* Tab switcher */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'tasks' && styles.tabActive]}
          onPress={() => {
            setActiveTab('tasks');
            setShowCompletedTasks(false);
          }}
        >
          <Text style={[styles.tabText, activeTab === 'tasks' && styles.tabTextActive]}>
            Tasks ({tasks.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'rewards' && styles.tabActive]}
          onPress={() => {
            setActiveTab('rewards');
            setShowCompletedTasks(false);
          }}
        >
          <Text style={[styles.tabText, activeTab === 'rewards' && styles.tabTextActive]}>
            Rewards ({rewards.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {activeTab === 'tasks' ? (
          <>
            {/* Add task form */}
            {showTaskForm ? (
              <View style={styles.form}>
                <View style={styles.formHeader}>
                  <Text style={styles.formTitle}>New Task</Text>
                  <TouchableOpacity onPress={closeTaskForm}>
                    <Text style={styles.formCancelLink}>Cancel</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.input}
                  value={taskTitle}
                  onChangeText={setTaskTitle}
                  placeholder="What needs to be done?"
                  placeholderTextColor={COLORS.subtext}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleAddTask}
                />
                {taskClarityStatus === 'checking' && (
                  <View style={styles.clarityRow}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                    <Text style={styles.clarityChecking}>Checking sanity...</Text>
                  </View>
                )}
                <View style={styles.importanceRow}>
                  {(['LOW', 'MEDIUM', 'HIGH'] as ImportanceWeight[]).map((level) => (
                    <TouchableOpacity
                      key={level}
                      style={[
                        styles.importanceBtn,
                        importance === level && {
                          backgroundColor: IMPORTANCE_COLORS[level] + '22',
                          borderColor: IMPORTANCE_COLORS[level],
                        },
                      ]}
                      onPress={() => setImportance(level)}
                    >
                      <Text
                        style={[
                          styles.importanceBtnText,
                          importance === level && { color: IMPORTANCE_COLORS[level] },
                        ]}
                      >
                        {level}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  style={[
                    styles.formSaveBtn,
                    taskAddDisabled && styles.formSaveBtnDisabled,
                  ]}
                  onPress={handleAddTask}
                  disabled={taskAddDisabled}
                  activeOpacity={0.85}
                >
                  <Text style={styles.formSaveBtnText}>Add Task</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Task list */}
            {tasks.length === 0 ? (
              <Text style={styles.emptyText}>No tasks yet</Text>
            ) : (
              tasks.map((task) => (
                <View key={task.id} style={styles.listItem}>
                  <View
                    style={[
                      styles.importanceDot,
                      { backgroundColor: IMPORTANCE_COLORS[task.importanceWeight] },
                    ]}
                  />
                  <Text style={styles.listItemTitle} numberOfLines={2}>
                    {task.title}
                  </Text>
                  <TouchableOpacity
                    style={styles.doneBtn}
                    onPress={() => handleCompleteTask(task.id)}
                  >
                    <Text style={styles.doneBtnText}>✓</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteTask(task.id)}>
                    <Text style={styles.deleteText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}

            <View style={styles.completedSection}>
              <TouchableOpacity
                style={styles.completedHeader}
                onPress={() => setShowCompletedTasks((prev) => !prev)}
                activeOpacity={0.8}
              >
                <Text style={styles.completedHeaderText}>
                  Completed tasks ({completedTasks.length})
                </Text>
                <Text style={styles.completedChevron}>{showCompletedTasks ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {showCompletedTasks && completedTasks.length > 0 && (
                <View style={styles.completedActionsRow}>
                  <TouchableOpacity
                    style={styles.completedDeleteAllBtn}
                    onPress={handleDeleteAllCompleted}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.completedDeleteAllText}>Delete all completed</Text>
                  </TouchableOpacity>
                </View>
              )}

              {showCompletedTasks && (
                completedTasks.length === 0 ? (
                  <Text style={styles.completedEmpty}>No completed tasks yet</Text>
                ) : (
                  completedTasks.map((task) => (
                    <View key={`completed-${task.id}`} style={styles.completedItem}>
                      <View
                        style={[
                          styles.importanceDot,
                          { backgroundColor: IMPORTANCE_COLORS[task.importanceWeight] },
                        ]}
                      />
                      <Text style={styles.completedItemText} numberOfLines={2}>
                        {task.title}
                      </Text>
                      <TouchableOpacity
                        style={styles.completedRestoreBtn}
                        onPress={() => handleRestoreCompletedTask(task.id)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.completedRestoreText}>Uncheck</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )
              )}
            </View>
          </>
        ) : (
          <>
            {/* Add reward form */}
            {showRewardForm ? (
              <View style={styles.form}>
                <View style={styles.formHeader}>
                  <Text style={styles.formTitle}>New Reward</Text>
                  <TouchableOpacity onPress={closeRewardForm}>
                    <Text style={styles.formCancelLink}>Cancel</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.input}
                  value={rewardTitle}
                  onChangeText={setRewardTitle}
                  placeholder="e.g. 10 min break, coffee..."
                  placeholderTextColor={COLORS.subtext}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleAddReward}
                />
                {rewardClarityStatus === 'checking' && (
                  <View style={styles.clarityRow}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                    <Text style={styles.clarityChecking}>Checking sanity...</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={[
                    styles.formSaveBtn,
                    rewardAddDisabled && styles.formSaveBtnDisabled,
                  ]}
                  onPress={handleAddReward}
                  disabled={rewardAddDisabled}
                  activeOpacity={0.85}
                >
                  <Text style={styles.formSaveBtnText}>Add Reward</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Reward list */}
            {rewards.length === 0 ? (
              <Text style={styles.emptyText}>No rewards yet</Text>
            ) : (
              rewards.map((reward) => (
                <View key={reward.id} style={styles.listItem}>
                  <View style={styles.rewardInfo}>
                    <Text style={styles.listItemTitle} numberOfLines={2}>
                      {reward.title}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDeleteReward(reward.id)}>
                    <Text style={styles.deleteText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* FAB — always visible */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          if (activeTab === 'tasks') {
            setShowRewardForm(false);
            setShowTaskForm((prev) => !prev);
          } else {
            setShowTaskForm(false);
            setShowRewardForm((prev) => !prev);
          }
        }}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>{(showTaskForm || showRewardForm) ? '×' : '+'}</Text>
      </TouchableOpacity>

      <Modal
        visible={showVagueModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowVagueModal(false);
          setVagueModalTarget(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalHint}>It looks like a quick thought.</Text>
            <Text style={styles.modalQuestion}>
              {vagueModalTarget === 'task' ? taskVagueData?.question : rewardVagueData?.question}
            </Text>

            <View style={styles.optionsList}>
              {(vagueModalTarget === 'task' ? taskVagueData?.options : rewardVagueData?.options)?.map((opt, i) => (
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

              <TouchableOpacity
                style={styles.optionButton}
                onPress={() => handleSelectOption(vagueOriginalInput)}
                activeOpacity={0.8}
              >
                <Text style={styles.optionLabel}>{originalOptionLabel}</Text>
                <Text style={styles.optionText}>{vagueOriginalInput}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.somethingElseButton}
              onPress={() => {
                setShowVagueModal(false);
                setVagueModalTarget(null);
                setVagueOriginalInput('');
              }}
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
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    color: COLORS.subtext,
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: COLORS.primary,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  form: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  input: {
    color: COLORS.text,
    fontSize: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 14,
  },
  clarityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  clarityChecking: {
    color: COLORS.subtext,
    fontSize: 12,
  },
  importanceRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  importanceBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  importanceBtnText: {
    color: COLORS.subtext,
    fontSize: 12,
    fontWeight: '600',
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  formTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  formCancelLink: {
    color: COLORS.subtext,
    fontSize: 14,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
  fabText: {
    color: COLORS.background,
    fontSize: 30,
    fontWeight: '300',
    lineHeight: 34,
  },
  formSaveBtn: {
    marginTop: 14,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  formSaveBtnDisabled: {
    opacity: 0.35,
  },
  formSaveBtnText: {
    color: COLORS.background,
    fontSize: 15,
    fontWeight: '700' as const,
    letterSpacing: 0.4,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 10,
  },
  importanceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  listItemTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 21,
  },
  doneBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    color: COLORS.success,
    fontSize: 13,
    fontWeight: '700',
  },
  deleteText: {
    color: COLORS.subtext,
    fontSize: 14,
    paddingHorizontal: 4,
  },
  rewardInfo: {
    flex: 1,
  },
  completedSection: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
  },
  completedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  completedHeaderText: {
    color: COLORS.subtext,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  completedChevron: {
    color: COLORS.subtext,
    fontSize: 12,
  },
  completedEmpty: {
    color: COLORS.subtext,
    fontSize: 13,
    marginTop: 8,
  },
  completedActionsRow: {
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  completedDeleteAllBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: COLORS.danger,
    borderRadius: 8,
    backgroundColor: COLORS.dangerDim,
  },
  completedDeleteAllText: {
    color: COLORS.dangerText,
    fontSize: 12,
    fontWeight: '700',
  },
  completedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    opacity: 0.75,
  },
  completedItemText: {
    flex: 1,
    color: COLORS.subtext,
    fontSize: 14,
    textDecorationLine: 'line-through',
  },
  completedRestoreBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
  },
  completedRestoreText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyText: {
    color: COLORS.subtext,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 32,
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
