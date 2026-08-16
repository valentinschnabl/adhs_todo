import { Tabs } from 'expo-router';
import React from 'react';
import { Feather } from '@expo/vector-icons';
import { AppTheme } from '@/constants/app-theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: AppTheme.colors.ember,
        tabBarInactiveTintColor: AppTheme.colors.clay,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: AppTheme.colors.parchment,
          borderTopColor: 'rgba(0,0,0,0.06)',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Draw',
          tabBarIcon: ({ color, size }) => <Feather name="shuffle" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color, size }) => <Feather name="check-square" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="rewards"
        options={{
          title: 'Rewards',
          tabBarIcon: ({ color, size }) => <Feather name="gift" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Feather name="sliders" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
