import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BONUS_REWARD_ON_TASK_CHANCE,
  REWARD_DRAW_CHANCE,
  TASK_DRAW_CHANCE,
  toPercentString,
} from '../../src/config/drawConfig';
import { COLORS } from '../../src/theme';

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
    </View>
  );
}

export default function SettingsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Settings</Text>

        <Text style={styles.sectionTitle}>Draw Probabilities</Text>
        <View style={styles.card}>
          <Row label="Task draw chance" value={toPercentString(TASK_DRAW_CHANCE)} />
          <Row label="Reward draw chance" value={toPercentString(REWARD_DRAW_CHANCE)} />
          <Row
            label="Bonus reward chance"
            value={`${toPercentString(BONUS_REWARD_ON_TASK_CHANCE)} on task draw`}
          />
        </View>

        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.card}>
          <Row label="App" value="ADHD Quest" />
          <Row label="Version" value="1.0.0" />
          <Row label="Storage" value="Local — no cloud sync" />
        </View>

        <Text style={styles.sectionTitle}>How it works</Text>
        <View style={styles.card}>
          <Text style={styles.bodyText}>
            Tap Draw on the main screen to get a random task or reward. Tasks are weighted by importance and how long since they were last drawn — older tasks become more likely over time.
          </Text>
          <Text style={[styles.bodyText, { marginTop: 12 }]}>
            A {toPercentString(BONUS_REWARD_ON_TASK_CHANCE)} bonus reward is attached when a task is drawn. Complete the task to reveal it.
          </Text>
          <Text style={[styles.bodyText, { marginTop: 12 }]}>
            If you've been on a task for more than 10 minutes without progress, a rescue prompt will appear to help you switch gears.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  heading: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 24,
  },
  sectionTitle: {
    color: COLORS.subtext,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 24,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rowLabel: {
    color: COLORS.text,
    fontSize: 15,
  },
  rowValue: {
    color: COLORS.subtext,
    fontSize: 14,
  },
  bodyText: {
    color: COLORS.subtext,
    fontSize: 14,
    lineHeight: 21,
    paddingVertical: 14,
  },
});
