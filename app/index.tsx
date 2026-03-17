import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useAppStore } from '../src/store/useAppStore';
import { countTotalTasks } from '../src/db/tasks';
import { countTotalRewards } from '../src/db/rewards';

export default function Index() {
  const db = useSQLiteContext();
  const isHydrated = useAppStore((s) => s.isHydrated);

  useEffect(() => {
    if (!isHydrated) return;

    async function checkOnboarding() {
      try {
        const [totalTasks, totalRewards] = await Promise.all([
          countTotalTasks(db),
          countTotalRewards(db),
        ]);

        const onboardingComplete = totalTasks >= 3 && totalRewards >= 3;

        if (onboardingComplete) {
          router.replace('/dashboard');
        } else {
          router.replace('/onboarding/tasks');
        }
      } catch (error) {
        console.error('Error checking onboarding:', error);
        router.replace('/onboarding/tasks');
      }
    }

    checkOnboarding();
  }, [db, isHydrated]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#7C3AED" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#141210',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
