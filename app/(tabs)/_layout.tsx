import React, { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Grid2x2 as Grid, Upload, Settings } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { Platform, StyleSheet, View } from 'react-native';
import { useVaultStore } from '@/stores/vaultStore';

export default function TabLayout() {
  const { loadVaultContents } = useVaultStore();
  
  useEffect(() => {
    // Load vault contents when tab layout mounts
    loadVaultContents();
  }, []);
  
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: '#ff2d55',
        tabBarInactiveTintColor: '#666',
        tabBarShowLabel: false,
        tabBarBackground: () => (
          Platform.OS === 'ios' ? (
            <BlurView
              tint="dark"
              intensity={100}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0, 0, 0, 0.9)' }]} />
          )
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Vault',
          tabBarIcon: ({ color, size }) => (
            <Grid size={size} color={color} />
          ),
          tabBarAccessibilityLabel: 'Vault',
        }}
        listeners={{
          tabPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          },
        }}
      />
      
      <Tabs.Screen
        name="upload"
        options={{
          title: 'Upload',
          tabBarIcon: ({ color, size }) => (
            <Upload size={size} color={color} />
          ),
          tabBarAccessibilityLabel: 'Upload',
        }}
        listeners={{
          tabPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          },
        }}
      />
      
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Settings size={size} color={color} />
          ),
          tabBarAccessibilityLabel: 'Settings',
        }}
        listeners={{
          tabPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          },
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    elevation: 0,
    height: 60,
  },
});