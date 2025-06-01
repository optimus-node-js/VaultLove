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
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import { 
  Mail, 
  Lock, 
  User,
  Calendar,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Check,
  Users,
  Phone,
  UserPlus,
  AlertCircle,
} from 'lucide-react-native';
import authService from '../../services/auth';

interface SignupData {
  name: string;
  email: string;
  phoneNumber: string;
  gender: 'male' | 'female' | '';
  dateOfBirth: Date | null;
  partnerCode: string;
  password: string;
  confirmPassword: string;
}

interface EmailValidation {
  isChecking: boolean;
  exists: boolean;
  message: string;
}

export default function SignupScreen() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [emailValidation, setEmailValidation] = useState<EmailValidation>({
    isChecking: false,
    exists: false,
    message: ''
  });
  const router = useRouter();

  const [formData, setFormData] = useState<SignupData>({
    name: '',
    email: '',
    phoneNumber: '',
    gender: '',
    dateOfBirth: null,
    partnerCode: '',
    password: '',
    confirmPassword: '',
  });

  const updateFormData = (field: keyof SignupData, value: string | Date | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Real-time email validation
  useEffect(() => {
    const checkEmailExists = async () => {
      if (!formData.email || !/\S+@\S+\.\S+/.test(formData.email)) {
        setEmailValidation({ isChecking: false, exists: false, message: '' });
        return;
      }

      setEmailValidation(prev => ({ ...prev, isChecking: true }));

      // For now, we'll just validate email format
      // Email existence check will be done during actual signup
      setTimeout(() => {
        setEmailValidation({
          isChecking: false,
          exists: false,
          message: 'Email format is valid!'
        });
      }, 500);
    };

    const timeoutId = setTimeout(checkEmailExists, 1000); // Debounce by 1 second
    return () => clearTimeout(timeoutId);
  }, [formData.email]);

  const validatePhoneNumber = (number: string) => {
    const digits = number.replace(/\D/g, '');
    return digits.length === 10; // Indian mobile numbers are 10 digits
  };

  const validateStep1 = () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return false;
    }
    if (formData.name.trim().length < 2) {
      Alert.alert('Error', 'Name must be at least 2 characters long');
      return false;
    }
    if (!formData.email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return false;
    }
    if (emailValidation.exists) {
      Alert.alert('Error', 'This email is already registered. Please use a different email or try logging in.');
      return false;
    }
    if (!formData.phoneNumber.trim()) {
      Alert.alert('Error', 'Please enter your phone number');
      return false;
    }
    if (!validatePhoneNumber(formData.phoneNumber)) {
      Alert.alert('Error', 'Please enter a valid 10-digit phone number');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!formData.gender) {
      Alert.alert('Error', 'Please select your gender');
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (!formData.password) {
      Alert.alert('Error', 'Please enter a password');
      return false;
    }
    if (formData.password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return false;
    }
    return true;
  };

  const nextStep = () => {
    let isValid = false;
    
    switch (currentStep) {
      case 1:
        isValid = validateStep1();
        break;
      case 2:
        isValid = validateStep2();
        break;
      case 3:
        isValid = validateStep3();
        break;
    }

    if (isValid) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentStep(prev => prev - 1);
  };

  const handleSignup = async () => {
    if (!validateStep3()) return;

    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Create user with email and password
      const userCredential = await authService.signUp(formData.email, formData.password, {
        name: formData.name,
        gender: formData.gender as 'male' | 'female',
        dateOfBirth: formData.dateOfBirth ? formData.dateOfBirth.toISOString() : undefined,
        phoneNumber: formData.phoneNumber,
      });

      // If partner code is provided, try to connect
      if (formData.partnerCode.trim()) {
        try {
          await authService.connectWithPartner(formData.partnerCode.trim().toUpperCase());
          Alert.alert(
            'Account Created! 💖',
            'Your account has been created and you\'ve been connected with your partner! Welcome to VaultLove.',
            [{ 
              text: 'Start Your Journey', 
              onPress: () => {
                // Force navigation after a small delay to ensure auth state updates
                setTimeout(() => {
                  router.replace('/(tabs)');
                }, 500);
              }
            }]
          );
        } catch (partnerError) {
          console.log('Partner connection failed:', partnerError);
          Alert.alert(
            'Account Created! 💖',
            'Your account has been created successfully, but we couldn\'t connect with the partner code. You can try connecting later from your profile.',
            [{ 
              text: 'Continue', 
              onPress: () => {
                setTimeout(() => {
                  router.replace('/(tabs)');
                }, 500);
              }
            }]
          );
        }
      } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
      Alert.alert(
        'Welcome to VaultLove! 💖',
        'Your account has been created successfully. You can now start building your precious memories vault.',
          [{ 
            text: 'Get Started', 
            onPress: () => {
              // Force navigation after a small delay to ensure auth state updates
              setTimeout(() => {
                router.replace('/(tabs)');
              }, 500);
            }
          }]
        );
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      let message = 'Signup failed. Please try again.';
      if (error.code === 'auth/email-already-in-use') {
        message = 'An account with this email already exists. Please try logging in instead.';
      } else if (error.code === 'auth/weak-password') {
        message = 'Password is too weak. Please choose a stronger password.';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Please enter a valid email address.';
      } else if (error.code === 'auth/network-request-failed') {
        message = 'Network error. Please check your connection and try again.';
      }
      
      Alert.alert('Signup Failed', message);
    } finally {
      setIsLoading(false);
    }
  };

  const goToLogin = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      updateFormData('dateOfBirth', selectedDate);
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatPhoneInput = (text: string) => {
    // Remove all non-digits
    const digits = text.replace(/\D/g, '');
    // Limit to 10 digits
    return digits.slice(0, 10);
  };

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill, 
            { width: `${(currentStep / 3) * 100}%` }
          ]}
        />
      </View>
      <Text style={styles.progressText}>Step {currentStep} of 3</Text>
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <View style={styles.stepIconContainer}>
          <User color="#ec4899" size={28} />
        </View>
      <Text style={styles.stepTitle}>Let's get to know you</Text>
        <Text style={styles.stepSubtitle}>Tell us your basic information to get started</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <User color="#9ca3af" size={20} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
              placeholder="Full Name"
              placeholderTextColor="#9ca3af"
            value={formData.name}
            onChangeText={(value) => updateFormData('name', value)}
            autoCapitalize="words"
            autoCorrect={false}
          />
          </View>
        </View>

        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <Mail color="#9ca3af" size={20} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
              placeholder="Email Address"
              placeholderTextColor="#9ca3af"
            value={formData.email}
            onChangeText={(value) => updateFormData('email', value)}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
            {emailValidation.isChecking && (
              <ActivityIndicator color="#9ca3af" size="small" style={styles.validationIcon} />
            )}
          </View>
          {emailValidation.message && (
            <View style={[
              styles.validationMessage,
              emailValidation.exists ? styles.validationError : styles.validationSuccess
            ]}>
              <AlertCircle 
                color={emailValidation.exists ? "#ef4444" : "#10b981"} 
                size={16} 
                style={styles.validationIcon}
              />
              <Text style={[
                styles.validationText,
                emailValidation.exists ? styles.validationTextError : styles.validationTextSuccess
              ]}>
                {emailValidation.message}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <View style={styles.phonePrefix}>
              <Text style={styles.phonePrefixText}>🇮🇳 +91</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Enter your 10-digit mobile number"
              placeholderTextColor="#9ca3af"
              value={formData.phoneNumber}
              onChangeText={(text) => updateFormData('phoneNumber', formatPhoneInput(text))}
              keyboardType="phone-pad"
              maxLength={10}
            />
          </View>
        </View>
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <View style={styles.stepIconContainer}>
          <Users color="#ec4899" size={28} />
        </View>
        <Text style={styles.stepTitle}>Tell us about yourself</Text>
        <Text style={styles.stepSubtitle}>Help us personalize your experience</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.sectionTitle}>Gender</Text>
        <View style={styles.genderContainer}>
          {[
            { value: 'male', label: 'Male', emoji: '👨' },
            { value: 'female', label: 'Female', emoji: '👩' },
          ].map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.genderOption,
                formData.gender === option.value && styles.genderOptionSelected,
              ]}
              onPress={() => updateFormData('gender', option.value)}
            >
              <Text style={styles.genderEmoji}>{option.emoji}</Text>
              <Text
                style={[
                  styles.genderText,
                  formData.gender === option.value && styles.genderTextSelected,
                ]}
              >
                {option.label}
              </Text>
              {formData.gender === option.value && (
                <Check color="#ec4899" size={20} style={styles.checkIcon} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Date of Birth (Optional)</Text>
        <TouchableOpacity
          style={styles.inputContainer}
          onPress={() => setShowDatePicker(true)}
        >
          <View style={styles.inputWrapper}>
            <Calendar color="#9ca3af" size={20} style={styles.inputIcon} />
            <Text style={[
              styles.dateText,
              !formData.dateOfBirth && styles.placeholderText
            ]}>
              {formData.dateOfBirth ? formatDate(formData.dateOfBirth) : 'DD/MM/YYYY'}
            </Text>
          </View>
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={formData.dateOfBirth || new Date(2000, 0, 1)}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
            maximumDate={new Date()}
            minimumDate={new Date(1950, 0, 1)}
          />
        )}

        <Text style={styles.sectionTitle}>Partner Code (Optional)</Text>
        <Text style={styles.sectionSubtitle}>
          If your partner shared a code with you, enter it here to connect instantly
        </Text>
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <UserPlus color="#9ca3af" size={20} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Partner Code (Optional)"
              placeholderTextColor="#9ca3af"
              value={formData.partnerCode}
              onChangeText={(value) => updateFormData('partnerCode', value.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </View>
        </View>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <View style={styles.stepIconContainer}>
          <Lock color="#ec4899" size={28} />
        </View>
        <Text style={styles.stepTitle}>Secure your account</Text>
      <Text style={styles.stepSubtitle}>Create a strong password to protect your memories</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <Lock color="#9ca3af" size={20} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
              placeholder="Create a strong password"
              placeholderTextColor="#9ca3af"
            value={formData.password}
            onChangeText={(value) => updateFormData('password', value)}
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

        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <Lock color="#9ca3af" size={20} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Confirm password"
              placeholderTextColor="#9ca3af"
            value={formData.confirmPassword}
            onChangeText={(value) => updateFormData('confirmPassword', value)}
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
      </View>
    </View>
  );

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
              {currentStep > 1 && (
                <TouchableOpacity onPress={prevStep} style={styles.backButton}>
                  <ArrowLeft color="#374151" size={24} />
                </TouchableOpacity>
              )}
              <View style={styles.headerTitle}>
                <Text style={styles.title}>Create Account</Text>
                <Text style={styles.subtitle}>Join VaultLove and start your journey</Text>
              </View>
            </View>

            {/* Progress Bar */}
            {renderProgressBar()}

            {/* Step Content */}
            <View style={styles.content}>
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}
            </View>

            {/* Navigation Buttons */}
            <View style={styles.navigationContainer}>
              {currentStep < 3 ? (
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={nextStep}
                >
                  <Text style={styles.primaryButtonText}>Continue</Text>
                  <ArrowRight color="#ffffff" size={20} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
                  onPress={handleSignup}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <>
                      <Text style={styles.primaryButtonText}>Create Account</Text>
                      <Check color="#ffffff" size={20} />
                    </>
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity onPress={goToLogin} style={styles.signInButton}>
                <Text style={styles.signInButtonText}>
                  Already have an account? <Text style={styles.signInButtonHighlight}>Sign In</Text>
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
    marginBottom: 32,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  headerTitle: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  progressContainer: {
    marginBottom: 40,
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ec4899',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    marginBottom: 40,
  },
  stepContainer: {
    flex: 1,
  },
  stepHeader: {
    alignItems: 'center',
    marginBottom: 40,
  },
  stepIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fdf2f8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  form: {
    gap: 20,
  },
  inputContainer: {
    marginBottom: 4,
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
    marginTop: 8,
    paddingLeft: 4,
  },
  hintText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  genderContainer: {
    marginBottom: 20,
  },
  genderOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 12,
  },
  genderOptionSelected: {
    backgroundColor: '#fdf2f8',
    borderColor: '#ec4899',
  },
  genderEmoji: {
    fontSize: 20,
    marginRight: 12,
  },
  genderText: {
    flex: 1,
    fontSize: 16,
    color: '#6b7280',
  },
  genderTextSelected: {
    color: '#1f2937',
    fontWeight: '500',
  },
  checkIcon: {
    marginLeft: 8,
  },
  dateText: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
    height: '100%',
    textAlignVertical: 'center',
    paddingTop: Platform.OS === 'ios' ? 0 : 16,
  },
  placeholderText: {
    color: '#9ca3af',
  },
  navigationContainer: {
    gap: 16,
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
  signInButton: {
    alignItems: 'center',
  },
  signInButtonText: {
    fontSize: 16,
    color: '#6b7280',
  },
  signInButtonHighlight: {
    color: '#ec4899',
    fontWeight: '600',
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
  validationIcon: {
    marginLeft: 8,
  },
  validationMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
    marginTop: 8,
  },
  validationText: {
    fontSize: 14,
    marginLeft: 8,
  },
  validationError: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
  },
  validationSuccess: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
  },
  validationTextError: {
    color: '#ef4444',
  },
  validationTextSuccess: {
    color: '#10b981',
  },
}); 