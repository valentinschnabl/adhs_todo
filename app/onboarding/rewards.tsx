import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';
import { insertReward } from '../../src/db/rewards';
import { COLORS } from '../../src/theme';

interface LocalReward {
  title: string;
}

export default function OnboardingRewardsScreen() {
  const db = useSQLiteContext();
  const [title, setTitle] = useState('');
  const [rewards, setRewards] = useState<LocalReward[]>([]);
  const [saving, setSaving] = useState(false);

  function addReward() {
    const trimmed = title.trim();
    if (!trimmed) {
      Alert.alert('Please enter a reward title');
      return;
    }
    setRewards((prev) => [...prev, { title: trimmed }]);
    setTitle('');
  }

  function removeReward(index: number) {
    setRewards((prev) => prev.filter((_, i) => i !== index));
  }

  const totalCount = rewards.length;
  const canEnter = totalCount >= 3;

  async function handleEnter() {
    if (!canEnter) return;

    setSaving(true);
    try {
      for (const reward of rewards) {
        await insertReward(db, reward.title);
      }
      router.replace('/dashboard');
    } catch (error) {
      console.error('Error saving rewards:', error);
      Alert.alert('Error saving rewards. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.stepText}>Step 2 of 2</Text>
          <Text style={styles.title}>Add your rewards</Text>
          <Text style={styles.subtitle}>
            What motivates you? Add at least 3 rewards to keep yourself motivated.
          </Text>
        </View>

        {/* Input area */}
        <View style={styles.inputCard}>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. 15 min gaming, Coffee break..."
            placeholderTextColor={COLORS.subtext}
            returnKeyType="done"
            onSubmitEditing={addReward}
          />



          <TouchableOpacity style={styles.addButton} onPress={addReward} activeOpacity={0.8}>
            <Text style={styles.addButtonText}>+ Add Reward</Text>
          </TouchableOpacity>
        </View>

        {/* Requirements summary */}
        <View style={styles.requirementsCard}>
          <RequirementRow
            label="At least 3 rewards total"
            met={totalCount >= 3}
            current={totalCount}
            needed={3}
          />
        </View>

        {/* Reward list */}
        {rewards.length > 0 && (
          <View style={styles.rewardList}>
            <Text style={styles.listHeader}>Added rewards</Text>
            {rewards.map((reward, index) => (
              <View key={index} style={styles.rewardItem}>
                <View style={styles.rewardInfo}>
                  <Text style={styles.rewardItemText}>{reward.title}</Text>
                </View>
                <TouchableOpacity onPress={() => removeReward(index)} style={styles.removeButton}>
                  <Text style={styles.removeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[styles.enterButton, !canEnter && styles.enterButtonDisabled]}
          onPress={handleEnter}
          disabled={!canEnter || saving}
          activeOpacity={0.8}
        >
          <Text style={styles.enterButtonText}>
            {saving ? 'Saving...' : 'Enter App ✨'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function RequirementRow({
  label,
  met,
  current,
  needed,
}: {
  label: string;
  met: boolean;
  current: number;
  needed: number;
}) {
  return (
    <View style={requirementStyles.row}>
      <Text style={[requirementStyles.icon, met ? requirementStyles.iconMet : requirementStyles.iconPending]}>
        {met ? '✓' : '○'}
      </Text>
      <Text style={[requirementStyles.label, met && requirementStyles.labelMet]}>{label}</Text>
      <Text style={requirementStyles.count}>
        {current}/{needed}
      </Text>
    </View>
  );
}

const requirementStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  icon: {
    fontSize: 16,
    width: 20,
    textAlign: 'center',
  },
  iconMet: {
    color: '#7D9E72',
  },
  iconPending: {
    color: '#9CA3AF',
  },
  label: {
    flex: 1,
    color: '#9CA3AF',
    fontSize: 14,
  },
  labelMet: {
    color: '#F9FAFB',
  },
  count: {
    color: '#7C3AED',
    fontSize: 14,
    fontWeight: '700',
  },
});

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
    marginBottom: 16,
  },
  input: {
    color: COLORS.text,
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 16,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#141210',
    fontSize: 16,
    fontWeight: '700',
  },
  requirementsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  rewardList: {
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
  rewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  rewardInfo: {
    flex: 1,
  },
  rewardItemText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  removeButton: {
    padding: 4,
  },
  removeButtonText: {
    color: COLORS.subtext,
    fontSize: 14,
  },
  enterButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  enterButtonDisabled: {
    backgroundColor: '#2E2418',
    shadowOpacity: 0,
  },
  enterButtonText: {
    color: '#141210',
    fontSize: 18,
    fontWeight: '700',
  },
});
