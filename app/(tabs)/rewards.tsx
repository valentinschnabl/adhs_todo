import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppTheme } from '@/constants/app-theme';
import { useAppStore } from '@/lib/store';

export default function RewardsScreen() {
  const rewards = useAppStore((s) => s.rewards);
  const addReward = useAppStore((s) => s.addReward);
  const [draft, setDraft] = useState('');

  const sortedRewards = useMemo(
    () => [...rewards].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [rewards]
  );

  const handleAdd = async () => {
    if (!draft.trim()) return;
    await addReward(draft.trim());
    setDraft('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.title}>Rewards</Text>
      <Text style={styles.subtitle}>Small joys that keep momentum moving.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>New reward</Text>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Make tea, 5 min scroll, stretch"
          placeholderTextColor={AppTheme.colors.clay}
          style={styles.input}
        />
        <Pressable style={styles.addButton} onPress={handleAdd}>
          <Text style={styles.addButtonText}>Add reward</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {sortedRewards.map((reward) => (
          <View key={reward.id} style={styles.rewardItem}>
            <Text style={styles.rewardTitle}>{reward.title}</Text>
            <Text style={styles.rewardMeta}>Repeatable</Text>
          </View>
        ))}
      </ScrollView>
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
  addButton: {
    marginTop: 12,
    backgroundColor: AppTheme.colors.moss,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  addButtonText: {
    fontFamily: AppTheme.fonts.body,
    color: '#F5F0E6',
  },
  list: {
    paddingTop: 16,
    paddingBottom: 60,
  },
  rewardItem: {
    backgroundColor: '#FFFDF8',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  rewardTitle: {
    fontFamily: AppTheme.fonts.heading,
    fontSize: 16,
    color: AppTheme.colors.ink,
  },
  rewardMeta: {
    marginTop: 6,
    fontFamily: AppTheme.fonts.body,
    color: AppTheme.colors.clay,
    fontSize: 12,
  },
});
