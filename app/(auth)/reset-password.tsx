import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { 
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  Shield,
} from 'lucide-react-native';
import authService from '../../services/auth';

export default function ResetPasswordScreen() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [email, setEmail] = useState('');
  const [oobCode, setOobCode] = useState('');
  const [codeValid, setCodeValid] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  
  const router = useRouter();
  const { code } = useLocalSearchParams();

  useEffect(() => {
    verifyResetCode();
  }, []);

  const verifyResetCode = async () => {
    try {
      const resetCode = code as string;
      if (!resetCode) {
        throw new Error('Invalid reset link. Missing verification code.');
      }

      setOobCode(resetCode);
      console.log('🔐 Verifying reset code:', resetCode);
      
      const verifiedEmail = await authService.verifyPasswordResetCode(resetCode);
      setEmail(verifiedEmail);
      setCodeValid(true);
      console.log('✅ Reset code verified for email:', verifiedEmail);
    } catch (error: any) {
      console.error('❌ Reset code verification failed:', error);
      
      Alert.alert(
        'Invalid Reset Link',
        error.message || 'This password reset link is invalid or has expired. Please request a new one.',
        [
          {
            text: 'Request New Link',
            onPress: () => router.replace('/forgot-password' as any)
          },
          {
            text: 'Go to Login',
            onPress: () => router.replace('/(auth)')
          }
        ]
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const validatePassword = () => {
    if (!newPassword) {
      Alert.alert('Error', 'Please enter a new password');
      return false;
    }
    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return false;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return false;
    }
    return true;
  };

  const handleResetPassword = async () => {
    if (!validatePassword()) return;

    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await authService.confirmPasswordReset(oobCode, newPassword);
      
      setResetComplete(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      Alert.alert(
        'Password Reset Successful! 🎉',
        'Your password has been successfully updated. You can now sign in with your new password.',
        [
          {
            text: 'Sign In Now',
            onPress: () => {
              setTimeout(() => {
                router.replace('/(auth)');
              }, 1000);
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('❌ Password reset failed:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      const message = error.message || 'Failed to reset password. Please try again.';
      Alert.alert('Reset Failed', message);
    } finally {
      setIsLoading(false);
    }
  };

  const goToLogin = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace('/(auth)');
  };

  // Loading state while verifying code
  if (isVerifying) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ec4899" />
            <Text style={styles.loadingText}>Verifying reset link...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // Success state after password reset
  if (resetComplete) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.successContainer}>
            <View style={styles.successIconContainer}>
              <CheckCircle color="#10b981" size={64} />
            </View>
            
            <Text style={styles.successTitle}>Password Reset Complete! 🎉</Text>
            <Text style={styles.successMessage}>
              Your password has been successfully updated. You can now sign in to VaultLove with your new password.
            </Text>

            <TouchableOpacity onPress={goToLogin} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Sign In Now</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // If code is invalid
  if (!codeValid) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Invalid Reset Link</Text>
            <Text style={styles.errorMessage}>
              This password reset link is invalid or has expired. Please request a new one.
            </Text>
            
            <TouchableOpacity 
              onPress={() => router.replace('/forgot-password' as any)} 
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Request New Link</Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={goToLogin} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Back to Login</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Create New Password</Text>
              <Text style={styles.subtitle}>
                Enter a new password for{'\n'}
                <Text style={styles.emailText}>{email}</Text>
              </Text>
            </View>

            {/* Icon */}
            <View style={styles.iconContainer}>
              <View style={styles.iconBackground}>
                <Shield color="#ec4899" size={32} />
              </View>
            </View>

            {/* Form */}
            <View style={styles.formContainer}>
              <View style={styles.inputContainer}>
                <View style={styles.inputWrapper}>
                  <Lock color="#9ca3af" size={20} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter new password"
                    placeholderTextColor="#9ca3af"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showNewPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    onPress={() => setShowNewPassword(!showNewPassword)}
                    style={styles.eyeIcon}
                  >
                    {showNewPassword ? (
                      <EyeOff color="#9ca3af" size={20} />
                    ) : (
                      <Eye color="#9ca3af" size={20} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputContainer}>
                <View style={styles.inputWrapper}>
                  <Lock color="#9ca3af" size={20} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm new password"
                    placeholderTextColor="#9ca3af"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeIcon}
                  >
                    {showConfirmPassword ? (
                      <EyeOff color="#9ca3af" size={20} />
                    ) : (
                      <Eye color="#9ca3af" size={20} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.passwordHints}>
                <Text style={styles.hintText}>• At least 6 characters</Text>
                <Text style={styles.hintText}>• Mix of letters and numbers recommended</Text>
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
                onPress={handleResetPassword}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Update Password</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={goToLogin} style={styles.loginButton}>
                <Text style={styles.loginButtonText}>Back to Login</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  safeArea: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  emailText: {
    fontWeight: '600',
    color: '#1f2937',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconBackground: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fdf2f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formContainer: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
    height: '100%',
  },
  eyeIcon: {
    padding: 4,
  },
  passwordHints: {
    marginBottom: 32,
    paddingLeft: 4,
  },
  hintText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  primaryButton: {
    backgroundColor: '#ec4899',
    borderRadius: 16,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ec4899',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: 24,
  },
  primaryButtonDisabled: {
    backgroundColor: '#d1d5db',
    shadowOpacity: 0,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  loginButton: {
    alignItems: 'center',
  },
  loginButtonText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 16,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  successIconContainer: {
    marginBottom: 32,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 16,
  },
  successMessage: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  errorMessage: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  secondaryButton: {
    alignItems: 'center',
    marginTop: 16,
  },
  secondaryButtonText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
}); 