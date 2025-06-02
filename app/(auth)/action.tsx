import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function AuthActionHandler() {
  const router = useRouter();
  const { mode, oobCode, continueUrl } = useLocalSearchParams();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Wait for router to be ready before navigating
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isReady) return;

    console.log('🔗 Auth action handler triggered');
    console.log('Mode:', mode);
    console.log('OobCode:', oobCode);
    console.log('Continue URL:', continueUrl);

    const handleNavigation = () => {
      try {
        if (mode === 'resetPassword' && oobCode) {
          console.log('🔐 Redirecting to reset password page with code');
          // Redirect to your reset password page with the code
          router.replace(`/reset-password?code=${oobCode}` as any);
        } else if (mode === 'verifyEmail' && oobCode) {
          console.log('📧 Email verification requested');
          // Handle email verification if needed
          router.replace('/(auth)' as any);
        } else {
          console.log('❌ Unknown action or missing code, redirecting to login');
          // Fallback to login
          router.replace('/(auth)' as any);
        }
      } catch (error) {
        console.error('Navigation error:', error);
        // Fallback navigation after a delay
        setTimeout(() => {
          try {
            router.replace('/(auth)' as any);
          } catch (fallbackError) {
            console.error('Fallback navigation failed:', fallbackError);
          }
        }, 1000);
      }
    };

    // Small delay to ensure router is completely ready
    const navigationTimer = setTimeout(handleNavigation, 200);

    return () => clearTimeout(navigationTimer);
  }, [mode, oobCode, router, isReady]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#ec4899" />
      <Text style={styles.text}>Processing your request...</Text>
      <Text style={styles.subText}>Please wait while we redirect you...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
    textAlign: 'center',
  },
  subText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
}); 