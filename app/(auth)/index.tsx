import React, { useState, useRef, useEffect } from 'react';
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
  Image,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { 
  Phone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
} from 'lucide-react-native';
import authService, { UserProfile } from '../../services/auth';
import { auth } from '../../config/firebase';

// Only import recaptcha for mobile platforms
let FirebaseRecaptchaVerifierModal: any = null;
if (Platform.OS !== 'web') {
  try {
    FirebaseRecaptchaVerifierModal = require('expo-firebase-recaptcha').FirebaseRecaptchaVerifierModal;
  } catch (error) {
    console.log('Firebase Recaptcha not available:', error);
  }
}

export default function LoginScreen() {
  // Phone Auth (Primary)
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  
  // Email Auth (Secondary)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'phone' | 'email'>(Platform.OS === 'web' ? 'email' : 'phone');
  
  const [isLoading, setIsLoading] = useState(false);
  const recaptchaVerifier = useRef<any>(null);
  const router = useRouter();

  // Listen for auth state changes to handle automatic redirection
  useEffect(() => {
    const unsubscribe = authService.onAuthStateChange((user) => {
      if (user) {
        console.log('✅ User authenticated, redirecting to main app...');
        // Use replace to prevent going back to login
        router.replace('/(tabs)');
      }
    });

    return unsubscribe;
  }, [router]);

  const formatPhoneNumber = (number: string) => {
    // Remove all non-digits
    const digits = number.replace(/\D/g, '');
    
    // If starts with 91, keep as is, otherwise add 91
    if (digits.startsWith('91')) {
      return `+${digits}`;
    } else {
      return `+91${digits}`;
    }
  };

  const validatePhoneNumber = (number: string) => {
    const digits = number.replace(/\D/g, '');
    return digits.length === 10; // Indian mobile numbers are 10 digits
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSendOTP = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      Alert.alert('Error', 'Please enter a valid 10-digit phone number');
      return;
    }

    // For web platform, redirect to email login
    if (Platform.OS === 'web') {
      Alert.alert(
        'Phone Login on Web', 
        'Phone authentication is not available on web. Please use email login instead.',
        [
          { text: 'OK', onPress: () => setLoginMethod('email') }
        ]
      );
      return;
    }

    const formattedNumber = formatPhoneNumber(phoneNumber);

    try {
      setIsLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      console.log('📱 Sending OTP to:', formattedNumber);
      const success = await authService.sendPhoneVerification(formattedNumber);
      
      if (success) {
        setOtpSent(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
        Alert.alert(
          'OTP Sent! 📱',
          `Verification code sent to ${formattedNumber}. Please check your messages.`,
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error('Send OTP error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      let message = 'Failed to send OTP. Please try again.';
      if (error.code === 'auth/invalid-phone-number') {
        message = 'Please enter a valid phone number.';
      } else if (error.code === 'auth/too-many-requests') {
        message = 'Too many attempts. Please try again later.';
      } else if (error.code === 'auth/network-request-failed') {
        message = 'Network error. Please check your connection.';
      } else if (error.message?.includes('reCAPTCHA')) {
        message = 'reCAPTCHA verification failed. Please try again.';
      }
      
      Alert.alert('Failed to Send OTP', message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp.trim()) {
      Alert.alert('Error', 'Please enter the OTP');
      return;
    }

    if (otp.length !== 6) {
      Alert.alert('Error', 'Please enter a valid 6-digit OTP');
      return;
    }

    try {
      setIsLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      console.log('🔐 Verifying OTP...');
      const userProfile = await authService.verifyPhoneNumber(otp);
      
      console.log('✅ Phone login successful:', {
        uid: userProfile.uid,
        displayName: userProfile.displayName,
        phoneNumber: userProfile.phoneNumber,
        email: userProfile.email,
        partnerStatus: userProfile.partnerStatus
      });
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Show success message
      Alert.alert(
        'Welcome! 🎉',
        `Welcome ${userProfile.displayName || 'to VaultLove'}! You have successfully signed in.`,
        [{ text: 'Continue' }]
      );

      // The auth state listener will handle redirection automatically
      
    } catch (error: any) {
      console.error('Verify OTP error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      let message = 'Invalid OTP. Please try again.';
      if (error.code === 'auth/invalid-verification-code') {
        message = 'The verification code is invalid. Please check and try again.';
      } else if (error.code === 'auth/code-expired') {
        message = 'The verification code has expired. Please request a new one.';
      } else if (error.code === 'auth/network-request-failed') {
        message = 'Network error. Please check your connection.';
      }
      
      Alert.alert('Verification Failed', message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      console.log('📧 Email login attempt for:', email);
      const userProfile = await authService.signIn(email, password);
      
      console.log('✅ Email login successful:', {
        uid: userProfile.uid,
        displayName: userProfile.displayName,
        email: userProfile.email,
        phoneNumber: userProfile.phoneNumber,
        partnerStatus: userProfile.partnerStatus
      });
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Show success message
      Alert.alert(
        'Welcome Back! 🎉',
        `Welcome back ${userProfile.displayName || 'to VaultLove'}! You have successfully signed in.`,
        [{ text: 'Continue' }]
      );

      // The auth state listener will handle redirection automatically
      
    } catch (error: any) {
      console.error('Login error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      let message = 'Login failed. Please try again.';
      if (error.code === 'auth/user-not-found') {
        message = 'No account found with this email. Please sign up first.';
      } else if (error.code === 'auth/wrong-password') {
        message = 'Incorrect password. Please try again.';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Please enter a valid email address.';
      } else if (error.code === 'auth/user-disabled') {
        message = 'This account has been disabled. Please contact support.';
      } else if (error.code === 'auth/network-request-failed') {
        message = 'Network error. Please check your connection.';
      } else if (error.code === 'auth/too-many-requests') {
        message = 'Too many failed attempts. Please try again later.';
      }
      
      Alert.alert('Login Failed', message);
    } finally {
      setIsLoading(false);
    }
  };

  const resetPhoneAuth = () => {
    setOtpSent(false);
    setOtp('');
    setVerificationId('');
    setPhoneNumber('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const goToSignUp = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(auth)/signup');
  };

  const goToForgotPassword = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/forgot-password' as any);
  };

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
            {/* Beautiful Illustration */}
            <View style={styles.illustrationContainer}>
              <View style={styles.illustrationCard}>
                <View style={styles.illustrationBackground}>
                  <View style={styles.coupleIllustration}>
                    {/* Male figure */}
                    <View style={styles.maleFigure}>
                      <View style={styles.maleHair} />
                      <View style={styles.maleBody} />
                    </View>
                    {/* Female figure */}
                    <View style={styles.femaleFigure}>
                      <View style={styles.femaleHair} />
                      <View style={styles.femaleBody} />
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* Welcome Text */}
            <View style={styles.welcomeContainer}>
              <Text style={styles.welcomeTitle}>Welcome Back</Text>
              <Text style={styles.welcomeSubtitle}>
                Unlock your shared memories with your partner.
              </Text>
            </View>

            {/* Main Content */}
            <View style={styles.contentContainer}>
              {loginMethod === 'phone' && !otpSent && (
                <View style={styles.formContainer}>
                  <View style={styles.inputContainer}>
                    <View style={styles.inputWrapper}>
                      <View style={styles.phonePrefix}>
                        <Text style={styles.phonePrefixText}>🇮🇳 +91</Text>
                      </View>
                      <TextInput
                        style={styles.phoneInput}
                        placeholder="Enter your phone number"
                        placeholderTextColor="#9ca3af"
                        value={phoneNumber}
                        onChangeText={setPhoneNumber}
                        keyboardType="phone-pad"
                        maxLength={10}
                      />
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
                    onPress={handleSendOTP}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <>
                        <Text style={styles.primaryButtonText}>Send OTP</Text>
                        <ArrowRight color="#ffffff" size={20} />
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {loginMethod === 'phone' && otpSent && (
                <View style={styles.formContainer}>
                  <Text style={styles.otpTitle}>Verify Your Phone</Text>
                  <Text style={styles.otpSubtitle}>
                    Enter the 6-digit code sent to {formatPhoneNumber(phoneNumber)}
                  </Text>

                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Enter OTP"
                      placeholderTextColor="#9ca3af"
                      value={otp}
                      onChangeText={setOtp}
                      keyboardType="number-pad"
                      maxLength={6}
                      textAlign="center"
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
                    onPress={handleVerifyOTP}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <>
                        <Text style={styles.primaryButtonText}>Verify</Text>
                        <ArrowRight color="#ffffff" size={20} />
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity onPress={resetPhoneAuth} style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>Change Phone Number</Text>
                  </TouchableOpacity>
                </View>
              )}

              {loginMethod === 'email' && (
                <View style={styles.formContainer}>
                  <View style={styles.inputContainer}>
                    <View style={styles.inputWrapper}>
                      <Mail color="#9ca3af" size={20} style={styles.inputIcon} />
                      <TextInput
                        style={styles.textInput}
                        placeholder="Email address"
                        placeholderTextColor="#9ca3af"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                  </View>

                  <View style={styles.inputContainer}>
                    <View style={styles.inputWrapper}>
                      <Lock color="#9ca3af" size={20} style={styles.inputIcon} />
                      <TextInput
                        style={styles.textInput}
                        placeholder="Password"
                        placeholderTextColor="#9ca3af"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <TouchableOpacity
                        onPress={() => setShowPassword(!showPassword)}
                        style={styles.eyeIcon}
                      >
                        {showPassword ? (
                          <EyeOff color="#9ca3af" size={20} />
                        ) : (
                          <Eye color="#9ca3af" size={20} />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Forgot Password Link */}
                  <TouchableOpacity onPress={goToForgotPassword} style={styles.forgotPasswordButton}>
                    <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
                    onPress={handleEmailLogin}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <>
                        <Text style={styles.primaryButtonText}>Sign In</Text>
                        <ArrowRight color="#ffffff" size={20} />
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* Sign Up Button */}
              <TouchableOpacity onPress={goToSignUp} style={styles.signupButton}>
                <Text style={styles.signupButtonText}>
                  Don't have an account? <Text style={styles.signupButtonHighlight}>Sign Up</Text>
                </Text>
              </TouchableOpacity>

              {/* Login Method Toggle */}
              {!otpSent && (
                <TouchableOpacity
                  onPress={() => setLoginMethod(loginMethod === 'phone' ? 'email' : 'phone')}
                  style={styles.methodToggle}
                >
                  <Text style={styles.methodToggleText}>
                    {loginMethod === 'phone' ? 'Or login with email' : 'Or login with phone'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Recaptcha for mobile */}
            {Platform.OS !== 'web' && FirebaseRecaptchaVerifierModal && (
              <FirebaseRecaptchaVerifierModal
                ref={recaptchaVerifier}
                firebaseConfig={auth.app.options}
                attemptInvisibleVerification={true}
              />
            )}

            {/* Hidden reCAPTCHA container for web */}
            {Platform.OS === 'web' && (
              <div 
                id="recaptcha-container" 
                style={{ 
                  position: 'absolute', 
                  top: -1000, 
                  left: -1000, 
                  width: 1, 
                  height: 1,
                  opacity: 0,
                  pointerEvents: 'none'
                }} 
              />
            )}
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
  illustrationContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  illustrationCard: {
    width: 280,
    height: 200,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    padding: 20,
    borderWidth: 8,
    borderColor: '#f3e8e0',
  },
  illustrationBackground: {
    flex: 1,
    backgroundColor: '#f8e5d3',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  coupleIllustration: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  maleFigure: {
    alignItems: 'center',
    marginRight: 8,
  },
  maleHair: {
    width: 32,
    height: 28,
    backgroundColor: '#3d2914',
    borderRadius: 16,
    marginBottom: 2,
  },
  maleBody: {
    width: 40,
    height: 60,
    backgroundColor: '#8b6f47',
    borderRadius: 20,
  },
  femaleFigure: {
    alignItems: 'center',
    marginLeft: 8,
  },
  femaleHair: {
    width: 35,
    height: 35,
    backgroundColor: '#6b4423',
    borderRadius: 18,
    marginBottom: 2,
  },
  femaleBody: {
    width: 38,
    height: 55,
    backgroundColor: '#e8b4a6',
    borderRadius: 19,
  },
  welcomeContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  contentContainer: {
    flex: 1,
  },
  formContainer: {
    marginBottom: 32,
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
  phonePrefix: {
    paddingRight: 12,
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
    marginRight: 12,
  },
  phonePrefixText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
    height: '100%',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
    height: '100%',
  },
  eyeIcon: {
    padding: 4,
  },
  primaryButton: {
    backgroundColor: '#ec4899',
    borderRadius: 16,
    height: 56,
    flexDirection: 'row',
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
  },
  primaryButtonDisabled: {
    backgroundColor: '#d1d5db',
    shadowOpacity: 0,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  secondaryButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '500',
  },
  otpTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  otpSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  signupButton: {
    alignItems: 'center',
    marginBottom: 20,
  },
  signupButtonText: {
    fontSize: 16,
    color: '#6b7280',
  },
  signupButtonHighlight: {
    color: '#ec4899',
    fontWeight: '600',
  },
  methodToggle: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  methodToggleText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  forgotPasswordButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  forgotPasswordText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '500',
  },
});