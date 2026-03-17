import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { runMigrations } from '../src/db/database';
import { useAppStore } from '../src/store/useAppStore';
import { useUserStore } from '../src/store/useUserStore';

function HydrationGate({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const isHydrated = useAppStore((s) => s.isHydrated);
  const setHydrated = useAppStore((s) => s.setHydrated);
  const setUserId = useUserStore((s) => s.setUserId);
  const setIsPremium = useUserStore((s) => s.setIsPremium);
  const setDailyDrawCount = useUserStore((s) => s.setDailyDrawCount);
  const userSetDrawsSinceReward = useUserStore((s) => s.setDrawsSinceReward);
  const setAIClarityCount = useUserStore((s) => s.setAIClarityCount);
  const setAIMicrotaskCount = useUserStore((s) => s.setAIMicrotaskCount);

  useEffect(() => {
    async function hydrate() {
      try {
        // Load user row
        const user = await db.getFirstAsync<{
          id: number;
          isPremiumUser: number;
          dailyDrawCount: number;
          drawsSinceReward: number;
          aiClarityCount: number;
          aiMicrotaskCount: number;
        }>('SELECT * FROM users LIMIT 1');

        if (user) {
          setUserId(user.id);
          setIsPremium(user.isPremiumUser === 1);
          setDailyDrawCount(user.dailyDrawCount);
          userSetDrawsSinceReward(user.drawsSinceReward);
          setAIClarityCount(user.aiClarityCount);
          setAIMicrotaskCount(user.aiMicrotaskCount);
        }
      } catch (error) {
        console.error('Hydration error:', error);
      } finally {
        setHydrated(true);
        await SplashScreen.hideAsync();
      }
    }

    hydrate();
  }, [
    db,
    setHydrated,
    setUserId,
    setIsPremium,
    setDailyDrawCount,
    userSetDrawsSinceReward,
    setAIClarityCount,
    setAIMicrotaskCount,
  ]);

  if (!isHydrated) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.preventAutoHideAsync().catch(() => null);
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor="#141210" />
      <SQLiteProvider databaseName="adhd-quest.db" onInit={runMigrations}>
        <HydrationGate>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="dashboard" />
          </Stack>
        </HydrationGate>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#141210',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
