import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StatusBar } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../config/firebase';
import authService, { UserProfile } from '../services/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

const STORAGE_KEYS = {
  USER_DATA: '@vaultlove_user_data',
  AUTH_TOKEN: '@vaultlove_auth_token',
  LAST_LOGIN: '@vaultlove_last_login'
};

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthStateKnown, setIsAuthStateKnown] = useState(false);
  const [initialAuthCheckComplete, setInitialAuthCheckComplete] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    async function prepare() {
      try {
        console.log('🚀 App initializing...');
        
        // Load fonts
        await Font.loadAsync({
          // Add any custom fonts here if needed
        });

        // Check for stored user data first
        const hasStoredAuth = await checkStoredAuthData();
        
        // If we have stored auth data, mark auth state as known immediately
        if (hasStoredAuth) {
          setIsAuthStateKnown(true);
          setInitialAuthCheckComplete(true);
          console.log('✅ Auth state restored from storage');
        }

        // Set up Firebase auth listener
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          console.log('🔐 Auth state changed:', firebaseUser ? 'logged in' : 'logged out');
          
          setUser(firebaseUser);
          
          if (firebaseUser) {
            try {
              // User is signed in
              
              // Load or create user profile with complete data
              let userProfile = await authService.getUserProfile();
              
              if (!userProfile) {
                console.log('Creating user profile for existing auth user...');
                // Create profile if it doesn't exist
                userProfile = await authService.createUserProfile({
                  uid: firebaseUser.uid,
                  email: firebaseUser.email || undefined,
                  phoneNumber: firebaseUser.phoneNumber || undefined,
                  displayName: firebaseUser.displayName || undefined,
                  photoURL: firebaseUser.photoURL || undefined,
                  partnerStatus: 'no_partner'
                });
              }
              
              setUserProfile(userProfile);
              
              // Store user data persistently
              const token = await firebaseUser.getIdToken();
              await AsyncStorage.multiSet([
                [STORAGE_KEYS.USER_DATA, JSON.stringify(userProfile)],
                [STORAGE_KEYS.AUTH_TOKEN, token],
                [STORAGE_KEYS.LAST_LOGIN, new Date().toISOString()]
              ]);
              
              console.log('💾 User data stored successfully');
              
            } catch (error) {
              console.error('❌ Error loading user profile:', error);
              // Clear stored data on error
              await clearStoredAuthData();
              setUserProfile(null);
            }
          } else {
            // User is signed out
            setUserProfile(null);
            await clearStoredAuthData();
          }
          
          // Mark auth state as known after first auth state change
          setIsAuthStateKnown(true);
          setInitialAuthCheckComplete(true);
          setIsLoading(false);
        });

        // Cleanup function
        return unsubscribe;
        
      } catch (error) {
        console.error('❌ App initialization error:', error);
        setIsLoading(false);
        setIsAuthStateKnown(true);
        setInitialAuthCheckComplete(true);
      } finally {
        setIsReady(true);
        await SplashScreen.hideAsync();
      }
    }

    prepare();
  }, []);

  // Check for stored authentication data
  const checkStoredAuthData = async (): Promise<boolean> => {
    try {
      const storedData = await AsyncStorage.multiGet([
        STORAGE_KEYS.USER_DATA,
        STORAGE_KEYS.AUTH_TOKEN,
        STORAGE_KEYS.LAST_LOGIN
      ]);

      const userData = storedData[0][1];
      const authToken = storedData[1][1];
      const lastLogin = storedData[2][1];

      if (userData && authToken) {
        console.log('📱 Found stored user data, checking validity...');
        
        // Check if login is recent (within 30 days)
        const loginDate = new Date(lastLogin || '');
        const now = new Date();
        const daysSinceLogin = (now.getTime() - loginDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceLogin <= 30) {
          const profile = JSON.parse(userData) as UserProfile;
          setUserProfile(profile);
          console.log('✅ Restored user session from storage');
          return true;
        } else {
          console.log('⏰ Stored session expired, requiring re-authentication');
          await clearStoredAuthData();
        }
      }
      return false;
    } catch (error) {
      console.error('❌ Error checking stored auth data:', error);
      await clearStoredAuthData();
      return false;
    }
  };

  // Clear stored authentication data
  const clearStoredAuthData = async () => {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.USER_DATA,
        STORAGE_KEYS.AUTH_TOKEN,
        STORAGE_KEYS.LAST_LOGIN
      ]);
      console.log('🗑️ Cleared stored auth data');
    } catch (error) {
      console.error('❌ Error clearing stored auth data:', error);
    }
  };

  // Handle navigation based on authentication state
  useEffect(() => {
    if (!isReady || !initialAuthCheckComplete || isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';

    console.log('🧭 Navigation check:', { 
      segments, 
      user: !!user, 
      userProfile: !!userProfile,
      inAuthGroup,
      inTabsGroup,
      isAuthStateKnown,
      initialAuthCheckComplete,
      isLoading
    });

    if (!user && !userProfile) {
      // User is not authenticated
      if (!inAuthGroup) {
        console.log('➡️ Redirecting to auth...');
        router.replace('/(auth)');
      }
    } else if (user || userProfile) {
      // User is authenticated
      if (inAuthGroup) {
        console.log('➡️ Redirecting to main app...');
        router.replace('/(tabs)');
      }
    }
  }, [user, userProfile, segments, isReady, isLoading, isAuthStateKnown, initialAuthCheckComplete]);

  // Show loading screen while initializing or waiting for auth state
  if (!isReady || !initialAuthCheckComplete || isLoading) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <View style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#ffffff'
        }}>
          <ActivityIndicator size="large" color="#ec4899" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <Stack 
        screenOptions={{
          headerShown: false,
          gestureEnabled: false,
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}