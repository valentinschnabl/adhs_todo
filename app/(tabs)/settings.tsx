import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppTheme } from '@/constants/app-theme';
import { useAppStore } from '@/lib/store';

export default function SettingsScreen() {
  const user = useAppStore((s) => s.user);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>Local-first and gentle by design.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>AI Connection</Text>
        <Text style={styles.cardText}>
          Add your Gemini API key as `EXPO_PUBLIC_GEMINI_API_KEY` in your environment to enable
          clarity checks and microtasks. Optional: set `EXPO_PUBLIC_GEMINI_MODEL`.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Daily Draws</Text>
        <Text style={styles.cardText}>
          {user ? `Today: ${user.dailyDrawCount} draws` : 'Loading...'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Local Storage</Text>
        <Text style={styles.cardText}>
          Tasks, rewards, and draw history are saved locally with SQLite on mobile. On web, data
          resets on refresh. This app works offline except for AI calls.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppTheme.colors.parchment,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
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
    marginTop: 18,
    backgroundColor: '#FFF7EC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  cardTitle: {
    fontFamily: AppTheme.fonts.heading,
    color: AppTheme.colors.ink,
    fontSize: 16,
  },
  cardText: {
    marginTop: 8,
    fontFamily: AppTheme.fonts.body,
    color: AppTheme.colors.night,
  },
});
