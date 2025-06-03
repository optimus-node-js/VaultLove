import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authService from '../services/auth';
import { router } from 'expo-router';

/**
 * Comprehensive logout utility that handles the complete logout process
 * including user confirmation, session clearing, and user feedback
 */
export const performLogout = async (options?: {
  showConfirmation?: boolean;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  showSuccessAlert?: boolean;
}): Promise<void> => {
  const { 
    showConfirmation = true, 
    onSuccess,
    onError,
    showSuccessAlert = true
  } = options || {};

  const executeLogout = async () => {
    try {
      console.log('🚪 Starting comprehensive logout process...');
      
      // Warning haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      
      // Execute logout which clears everything
      await authService.signOutUser();
      
      console.log('✅ Auth service logout completed');
      
      // Success haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Force navigation with multiple attempts using the correct route paths
      console.log('🧭 Forcing navigation to login...');
      
      const navigateToAuth = () => {
        try {
          // Try different navigation approaches based on Expo Router best practices
          router.replace('/'); // Navigate to root auth screen
          console.log('✅ Navigation to root successful');
          return true;
        } catch (error) {
          console.error('❌ Navigation to root failed:', error);
          try {
            router.replace('/(auth)'); // Fallback to auth group
            console.log('✅ Navigation to auth group successful');
            return true;
          } catch (error2) {
            console.error('❌ Navigation to auth group failed:', error2);
            return false;
          }
        }
      };
      
      // Immediate attempt
      if (!navigateToAuth()) {
        // Retry after short delay
        setTimeout(() => {
          if (!navigateToAuth()) {
            // Final attempt with push and different paths
            setTimeout(() => {
              try {
                router.push('/');
                console.log('✅ Push navigation to root successful');
              } catch (error) {
                console.error('❌ All navigation attempts failed:', error);
                // Emergency: try to force a complete app restart navigation
                try {
                  router.dismissAll();
                  router.replace('/');
                } catch (emergencyError) {
                  console.error('❌ Emergency navigation failed:', emergencyError);
                }
              }
            }, 100);
          }
        }, 200);
      }
      
      // Show success message if requested
      if (showSuccessAlert) {
        setTimeout(() => {
          Alert.alert(
            'Logged Out Successfully! 👋',
            'You have been securely logged out. All data cleared from this device.',
            [
              {
                text: 'OK',
                onPress: () => {
                  console.log('💝 User acknowledged logout');
                  navigateToAuth(); // Additional navigation attempt
                  onSuccess?.();
                }
              }
            ],
            { cancelable: false }
          );
        }, 800);
      } else {
        setTimeout(() => onSuccess?.(), 200);
      }
      
    } catch (error) {
      console.error('❌ Logout error:', error);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      // Emergency navigation - try multiple approaches
      try {
        router.replace('/');
      } catch (navError) {
        try {
          router.replace('/(auth)');
        } catch (navError2) {
          console.error('❌ All emergency navigation attempts failed:', navError2);
        }
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      Alert.alert(
        'Logout Error', 
        `Logout failed: ${errorMessage}\n\nYou have been redirected to login.`,
        [{ 
          text: 'OK', 
          onPress: () => {
            try {
              router.replace('/');
            } catch (e) {
              console.error('Error recovery navigation failed:', e);
            }
            onError?.(error as Error);
          }
        }]
      );
    }
  };

  if (showConfirmation) {
    Alert.alert(
      "Logout Confirmation 🚪",
      "Are you sure you want to logout?\n\n• This will clear your session\n• All local data will be removed\n• You'll be redirected to login screen\n\nYour memories are safely stored in the cloud.",
      [
        { 
          text: "Cancel", 
          style: "cancel",
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        },
        {
          text: "Yes, Logout",
          style: "destructive",
          onPress: executeLogout
        }
      ]
    );
  } else {
    await executeLogout();
  }
};

/**
 * Quick logout without confirmation - for emergency situations
 */
export const emergencyLogout = async (): Promise<void> => {
  try {
    console.log('🚨 Emergency logout initiated');
    await authService.signOutUser();
    
    // Force immediate navigation
    try {
      router.dismissAll();
      router.replace('/');
    } catch (navError) {
      router.replace('/(auth)');
    }
    
    console.log('✅ Emergency logout completed');
  } catch (error) {
    console.error('❌ Emergency logout failed:', error);
    // In emergency cases, try to clear everything manually
    try {
      await AsyncStorage.clear();
      console.log('🚨 Emergency: Cleared all AsyncStorage');
      
      // Force navigation even if auth failed
      try {
        router.dismissAll();
        router.replace('/');
      } catch (navError) {
        router.replace('/(auth)');
      }
    } catch (clearError) {
      console.error('❌ Emergency storage clear failed:', clearError);
    }
  }
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  return authService.isAuthenticated();
};

/**
 * Get current user profile
 */
export const getCurrentUserProfile = () => {
  return authService.getUserProfile();
};

/**
 * Test signup functionality for debugging
 */
export const testSignup = async (testData: {
  email: string;
  password: string;
  displayName: string;
}) => {
  try {
    console.log('🧪 Testing signup with:', testData.email);
    
    const signupData = {
      displayName: testData.displayName,
      email: testData.email,
      password: testData.password,
      partnerStatus: 'no_partner' as const
    };
    
    const result = await authService.signUp(signupData);
    console.log('✅ Test signup successful:', result);
    return result;
  } catch (error) {
    console.error('❌ Test signup failed:', error);
    throw error;
  }
}; 