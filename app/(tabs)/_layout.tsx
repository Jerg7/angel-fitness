import React from 'react';
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primaryContainer,
        tabBarInactiveTintColor: Colors.onSurfaceVariant,
        tabBarStyle: {
          backgroundColor: Colors.surfaceContainerLow,
          borderTopColor: Colors.borderTranslucent,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
          elevation: 10,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}>
      <Tabs.Screen
        name="exercises"
        options={{
          title: 'Ejercicios',
          tabBarIcon: ({ color, size }: { color: any; size: number }) => (
            <MaterialCommunityIcons name="dumbbell" size={size || 24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          title: 'Entreno',
          tabBarIcon: ({ color, size }: { color: any; size: number }) => (
            <MaterialCommunityIcons name="fire" size={size || 24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="running"
        options={{
          title: 'Running',
          tabBarIcon: ({ color, size }: { color: any; size: number }) => (
            <MaterialCommunityIcons name="run-fast" size={size || 24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }: { color: any; size: number }) => (
            <MaterialCommunityIcons name="account" size={size || 24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
