import React, { useState } from 'react';
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
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { 
  Mail,
  ArrowLeft,
  Send,
  CheckCircle,
} from 'lucide-react-native';
import authService from '../../services/auth';
import { auth } from '../../config/firebase';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const router = useRouter();

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSendResetEmail = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      console.log('🔄 Attempting to send password reset email to:', email.trim().toLowerCase());
      
      const result = await authService.sendPasswordResetEmail(email.trim().toLowerCase());
      
      console.log('✅ Password reset email sent successfully');
      setEmailSent(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Show success alert with the Firebase-appropriate message
      Alert.alert(
        'Reset Link Sent! 📧',
        result.message,
        [
          {
            text: 'OK',
            onPress: () => {
              console.log('📧 User acknowledged email sent message');
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('❌ Send reset email error:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      let title = 'Reset Failed';
      let message = 'Failed to send reset email. Please try again.';
      
      if (error.message) {
        message = error.message;
      }
      
      // Log the exact error for debugging
      console.log('📝 Showing error alert:', { title, message });
      
      Alert.alert(title, message);
    } finally {
      setIsLoading(false);
    }
  };

  const goBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const goToLogin = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace('/(auth)');
  };

  if (emailSent) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.successContainer}>
            <View style={styles.successIconContainer}>
              <View style={styles.iconRipple}>
                <CheckCircle color="#10b981" size={48} />
              </View>
            </View>
            
            <Text style={styles.successTitle}>Check Your Email! 📧</Text>
            <Text style={styles.successMessage}>
              If an account with this email exists, you should receive a password reset link shortly.
            </Text>
            
            <View style={styles.emailCard}>
              <Mail color="#ec4899" size={20} style={styles.emailCardIcon} />
              <Text style={styles.emailText}>{email}</Text>
            </View>
            
            <Text style={styles.instructionText}>
              Please check your email and click the reset link to create a new password. If you don't see the email, check your spam folder. If you don't receive anything within a few minutes, the email may not be registered with us.
            </Text>

            <TouchableOpacity onPress={goToLogin} style={styles.primarySuccessButton}>
              <ArrowLeft color="#ffffff" size={20} style={styles.buttonIcon} />
              <Text style={styles.primarySuccessButtonText}>Back to Login</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setEmailSent(false)} style={styles.secondarySuccessButton}>
              <Mail color="#6b7280" size={18} style={styles.secondaryButtonIcon} />
              <Text style={styles.secondarySuccessButtonText}>Try Different Email</Text>
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
              <TouchableOpacity onPress={goBack} style={styles.backButton}>
                <ArrowLeft color="#374151" size={24} />
              </TouchableOpacity>
              <View style={styles.headerTitle}>
                <Text style={styles.title}>Forgot Password?</Text>
                <Text style={styles.subtitle}>No worries, we'll help you reset it</Text>
              </View>
            </View>

            {/* Icon */}
            <View style={styles.iconContainer}>
              <View style={styles.iconBackground}>
                <Mail color="#ec4899" size={32} />
              </View>
            </View>

            {/* Form */}
            <View style={styles.formContainer}>
              <Text style={styles.instructionTitle}>Enter your email address</Text>
              <Text style={styles.instructionSubtitle}>
                We'll send you a link to reset your password
              </Text>

              <View style={styles.inputContainer}>
                <View style={styles.inputWrapper}>
                  <Mail color="#9ca3af" size={20} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your email address"
                    placeholderTextColor="#9ca3af"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus={true}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
                onPress={handleSendResetEmail}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <>
                    <Send color="#ffffff" size={20} style={styles.buttonIcon} />
                    <Text style={styles.primaryButtonText}>Send Reset Link</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={goToLogin} style={styles.loginButton}>
                <Text style={styles.loginButtonText}>
                  Remember your password? <Text style={styles.loginButtonHighlight}>Sign In</Text>
                </Text>
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
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 48,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  headerTitle: {
    flex: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 6,
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    lineHeight: 22,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  iconBackground: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#fdf2f8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#f9a8d4',
  },
  formContainer: {
    flex: 1,
  },
  instructionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 28,
  },
  instructionSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
    paddingHorizontal: 12,
  },
  inputContainer: {
    marginBottom: 32,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    paddingHorizontal: 20,
    height: 64,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  inputIcon: {
    marginRight: 14,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
    height: '100%',
    fontWeight: '500',
  },
  primaryButton: {
    backgroundColor: '#ec4899',
    borderRadius: 20,
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ec4899',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
    marginBottom: 32,
    marginHorizontal: 4,
  },
  primaryButtonDisabled: {
    backgroundColor: '#d1d5db',
    shadowOpacity: 0,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  buttonIcon: {
    marginRight: 12,
  },
  loginButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  loginButtonText: {
    fontSize: 16,
    color: '#6b7280',
    lineHeight: 22,
  },
  loginButtonHighlight: {
    color: '#ec4899',
    fontWeight: '700',
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  successIconContainer: {
    marginBottom: 48,
    position: 'relative',
  },
  successTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 38,
  },
  successMessage: {
    fontSize: 18,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 26,
    paddingHorizontal: 8,
    fontWeight: '500',
  },
  emailText: {
    fontWeight: '700',
    color: '#1f2937',
    fontSize: 16,
    flex: 1,
  },
  instructionText: {
    fontSize: 15,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 48,
    marginTop: 32,
    paddingHorizontal: 12,
    fontWeight: '400',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    height: 56,
    paddingHorizontal: 24,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  secondarySuccessButtonText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '600',
  },
  secondaryButtonIcon: {
    marginRight: 8,
  },
  emailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    paddingHorizontal: 20,
    height: 64,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
    marginBottom: 8,
  },
  emailCardIcon: {
    marginRight: 16,
  },
  iconRipple: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#86efac',
    shadowColor: '#10b981',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  primarySuccessButton: {
    backgroundColor: '#ec4899',
    borderRadius: 20,
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
    shadowColor: '#ec4899',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
    marginBottom: 24,
    marginHorizontal: 8,
  },
  primarySuccessButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginLeft: 2,
  },
  secondarySuccessButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    height: 56,
    paddingHorizontal: 24,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
}); 