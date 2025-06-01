import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_700Bold } from '@expo-google-fonts/inter';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { useAuthStore } from '@/stores/authStore';
import { SplashScreen } from 'expo-splash-screen';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useFrameworkReady();
  const { isAuthenticated, isInitialized } = useAuthStore();
  
  const [fontsLoaded, fontError] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-Bold': Inter_700Bold,
  });
  
  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);
  
  // Return null to keep splash screen visible while fonts load
  if (!fontsLoaded && !fontError) {
    return null;
  }
  
  // Check if app is initialized
  if (!isInitialized) {
    return <Redirect href="/setup" />;
  }
  
  return (
    <>
      <Stack screenOptions={{ 
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: '#000' }
      }}>
        {!isAuthenticated ? (
          <Stack.Screen name="(auth)\" options={{ gestureEnabled: false }} />
        ) : (
          <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
        )}
      </Stack>
      <StatusBar style="light" />
    </>
  );
}