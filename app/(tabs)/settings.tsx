import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Switch, 
  Alert,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Clipboard
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import { 
  CircleUser as UserCircle, 
  Users, 
  Fingerprint, 
  Lock, 
  Shield, 
  LogOut, 
  Trash2,
  Heart,
  Info,
  Palette,
  Bell,
  Copy,
  UserPlus,
  CheckCircle,
  Clock,
  XCircle
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import authService, { UserProfile } from '../../services/auth';
import biometricAuthService from '../../services/biometricAuth';
import storageService from '../../services/storage';
import { performLogout } from '../../utils/authUtils';

export default function SettingsScreen() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isBiometricsAvailable, setIsBiometricsAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('Biometric Authentication');
  const [isLoading, setIsLoading] = useState(false);
  const [showPartnerDialog, setShowPartnerDialog] = useState(false);
  const [partnerCode, setPartnerCode] = useState('');
  const [storageStats, setStorageStats] = useState<{
    totalSize: number;
    fileCount: number;
    mediaByType: Record<string, number>;
  } | null>(null);
  const router = useRouter();
  
  useEffect(() => {
    let mounted = true;
    
    // Subscribe to user profile changes
    const unsubscribe = authService.onProfileChange((profile) => {
      if (mounted) {
        setUserProfile(profile);
      }
    });

    // Initialize biometric settings
    const initializeBiometrics = async () => {
      try {
        const isAvailable = await biometricAuthService.isBiometricAvailable();
        const isEnabled = await biometricAuthService.isBiometricEnabled();
        const supportedTypes = await biometricAuthService.getSupportedBiometrics();
        const typeName = biometricAuthService.getBiometricTypeName(supportedTypes);
        
        if (mounted) {
          setIsBiometricsAvailable(isAvailable);
          setBiometricsEnabled(isEnabled);
          setBiometricType(typeName);
        }
        
        console.log('🔐 Biometric settings initialized:', {
          available: isAvailable,
          enabled: isEnabled,
          type: typeName
        });
      } catch (error) {
        console.error('Error initializing biometrics:', error);
        if (mounted) {
          setIsBiometricsAvailable(false);
          setBiometricsEnabled(false);
        }
      }
    };

    initializeBiometrics();

    loadStorageStats();

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);
  
  const loadStorageStats = async () => {
    try {
      // Only load storage stats if user is authenticated
      if (!userProfile) {
        console.log('Skipping storage stats - user not authenticated');
        return;
      }
      
      const stats = await storageService.getStorageStats();
      setStorageStats(stats);
    } catch (error) {
      console.error('Storage stats error:', error);
      // Don't show error to user, just log it
      setStorageStats(null);
    }
  };
  
  const toggleBiometrics = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      if (!isBiometricsAvailable) {
        Alert.alert(
          'Biometric Authentication Unavailable', 
          'Your device does not support biometric authentication or you haven\'t set up biometrics yet.'
        );
        return;
      }

      if (biometricsEnabled) {
        // Disable biometrics
        Alert.alert(
          'Disable Biometric Login',
          `Are you sure you want to disable ${biometricType}? You'll need to enter your email and password to login.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Disable',
              style: 'destructive',
              onPress: async () => {
                try {
                  await biometricAuthService.disableBiometricAuth();
                  setBiometricsEnabled(false);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  console.log('🔐 Biometric authentication disabled');
                } catch (error) {
                  console.error('Error disabling biometrics:', error);
                  Alert.alert('Error', 'Failed to disable biometric authentication');
                }
              }
            }
          ]
        );
      } else {
        // Enable biometrics
        Alert.alert(
          `Enable ${biometricType}`,
          `Would you like to enable ${biometricType} for quick and secure login to VaultLove?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Enable',
              onPress: async () => {
                try {
                  const currentUser = authService.getCurrentUser();
                  if (!currentUser?.email) {
                    Alert.alert('Error', 'Unable to get current user email');
                    return;
                  }

                  // For security, we need to ask for the current password
                  Alert.prompt(
                    'Confirm Password',
                    'Please enter your current password to enable biometric authentication:',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Enable',
                        onPress: async (password) => {
                          if (!password) {
                            Alert.alert('Error', 'Password is required');
                            return;
                          }

                          try {
                            // Verify the password first
                            await authService.signIn(currentUser.email!, password);
                            
                            // Enable biometric authentication
                            const success = await biometricAuthService.enableBiometricAuth(currentUser.email!, password);
                            
                            if (success) {
                              setBiometricsEnabled(true);
                              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                              // Don't show success message as requested by user
                              console.log('✅ Biometric authentication enabled successfully');
                            } else {
                              Alert.alert('Setup Failed', 'Failed to enable biometric authentication. Please try again.');
                            }
                          } catch (error) {
                            console.error('Error enabling biometrics:', error);
                            Alert.alert('Error', 'Invalid password or failed to enable biometric authentication');
                          }
                        }
                      }
                    ],
                    'secure-text'
                  );
                } catch (error) {
                  console.error('Error in biometric setup:', error);
                  Alert.alert('Error', 'Failed to enable biometric authentication');
                }
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Biometrics toggle error:', error);
      Alert.alert('Error', 'Failed to toggle biometric authentication');
    }
  };

  const generatePartnerCode = async () => {
    if (!userProfile) return;

    try {
      setIsLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const code = await authService.generatePartnerConnection();
      
      Alert.alert(
        'Partner Code Generated! 💕',
        `Your partner code is: ${code}\n\nShare this code with your partner to connect your vaults. The code will expire in 24 hours.`,
        [
          {
            text: 'Copy Code',
            onPress: () => {
              Clipboard.setString(code);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Copied!', 'Partner code copied to clipboard');
            }
          },
          { text: 'OK' }
        ]
      );
    } catch (error) {
      console.error('Generate partner code error:', error);
      Alert.alert('Error', 'Failed to generate partner code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const connectWithPartner = async () => {
    if (!partnerCode.trim()) {
      Alert.alert('Error', 'Please enter a partner code');
      return;
    }

    try {
      setIsLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      await authService.connectWithPartner(partnerCode.trim().toUpperCase());
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Connected! 💖',
        'You are now connected with your partner. You can now share your vault and create memories together!',
        [{ text: 'Amazing!', onPress: () => setShowPartnerDialog(false) }]
      );
      setPartnerCode('');
    } catch (error: any) {
      console.error('Connect partner error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Connection Failed', error.message || 'Please check the code and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectPartner = async () => {
    Alert.alert(
      'Disconnect Partner',
      'Are you sure you want to disconnect from your partner? You will no longer share your vault.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              await authService.disconnectPartner();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Disconnected', 'You have been disconnected from your partner.');
            } catch (error) {
              console.error('Disconnect error:', error);
              Alert.alert('Error', 'Failed to disconnect. Please try again.');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };
  
  const handleLogout = async () => {
    console.log('🎯 Logout button pressed - starting logout process...');
    
    // Show confirmation first
    Alert.alert(
      "Logout Confirmation 🚪",
      "Are you sure you want to logout?\n\n• This will clear your session\n• All local data will be removed\n• You'll be redirected to login screen\n\nYour memories are safely stored in the cloud.",
      [
        { 
          text: "Cancel", 
          style: "cancel",
          onPress: () => {
            console.log('❌ User cancelled logout');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        },
        {
          text: "Yes, Logout",
          style: "destructive",
          onPress: async () => {
            console.log('✅ User confirmed logout - proceeding...');
            
            try {
              // Warning haptic
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              
              console.log('🔥 Calling authService.signOutUser()...');
              
              // Call the auth service logout which handles everything
              await authService.signOutUser();
              
              console.log('✅ AuthService logout completed successfully');
              
              // Success haptic
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              
              // Force navigation immediately - this is the key fix for logout
              console.log('🧭 Force navigating to auth after logout...');
              
              // Simple navigation approach for logout (avoid dismissAll which causes POP_TO_TOP error)
              try {
                router.replace('/(auth)');
                console.log('✅ Primary logout navigation successful');
              } catch (navError1) {
                console.error('❌ Primary navigation failed:', navError1);
                
                // Emergency navigation even if logout fails
                try {
                  router.replace('/(auth)');
                  console.log('✅ Emergency navigation successful');
                } catch (emergencyNavError) {
                  console.error('❌ Emergency navigation failed:', emergencyNavError);
                  try {
                    router.replace('/');
                    console.log('✅ Emergency fallback navigation successful');
                  } catch (finalError) {
                    console.error('❌ All emergency navigation failed:', finalError);
                  }
                }
              }
              
              // Show success message after navigation attempts
              setTimeout(() => {
                Alert.alert(
                  'Logged Out Successfully! 👋',
                  'You have been securely logged out. All data cleared from this device.',
                  [{ text: 'OK' }],
                  { cancelable: false }
                );
              }, 500);
              
            } catch (error) {
              console.error('❌ Logout error:', error);
              
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              
              // Emergency navigation even if logout fails
              try {
                router.replace('/(auth)');
                console.log('✅ Emergency navigation successful');
              } catch (emergencyNavError) {
                console.error('❌ Emergency navigation failed:', emergencyNavError);
                try {
                  router.replace('/');
                  console.log('✅ Emergency fallback navigation successful');
                } catch (finalError) {
                  console.error('❌ All emergency navigation failed:', finalError);
                }
              }
              
              Alert.alert(
                'Logout Error',
                `Logout failed: ${error instanceof Error ? error.message : 'Unknown error'}\n\nYou have been redirected to login.`,
                [{ text: 'OK' }]
              );
            }
          }
        }
      ]
    );
  };
  
  const handleClearVault = () => {
    Alert.alert(
      "Clear Vault",
      "Are you sure you want to delete all memories? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete All",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert("Success", "All memories have been deleted.");
          },
          style: "destructive"
        }
      ]
    );
  };

  const formatStorageDisplay = (stats: { totalSize: number; fileCount: number } | null): string => {
    if (!stats) return 'Loading...';
    const totalAvailable = 5 * 1024 * 1024 * 1024; // 5GB limit
    const used = formatFileSize(stats.totalSize);
    const total = formatFileSize(totalAvailable);
    const percentage = Math.round((stats.totalSize / totalAvailable) * 100);
    return `${used} / ${total} (${percentage}% used)`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getPartnerStatusIcon = () => {
    switch (userProfile?.partnerStatus) {
      case 'connected':
        return <CheckCircle color="#10b981" size={20} />;
      case 'pending':
        return <Clock color="#f59e0b" size={20} />;
      default:
        return <XCircle color="#6b7280" size={20} />;
    }
  };

  const getPartnerStatusText = () => {
    switch (userProfile?.partnerStatus) {
      case 'connected':
        return 'Connected';
      case 'pending':
        return 'Code Generated (Pending)';
      default:
        return 'Not Connected';
    }
  };
  
  const SettingItem = ({ 
    icon, 
    title, 
    description, 
    value, 
    onPress, 
    isDanger = false,
    rightComponent 
  }: {
    icon: React.ReactNode;
    title: string;
    description?: string;
    value?: string;
    onPress?: () => void;
    isDanger?: boolean;
    rightComponent?: React.ReactNode;
  }) => (
    <TouchableOpacity 
      style={[styles.settingItem, isDanger && styles.dangerItem]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.settingIcon}>
        {icon}
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, isDanger && styles.dangerText]}>
          {title}
        </Text>
        {description && (
          <Text style={styles.settingDescription}>{description}</Text>
        )}
        {value && (
          <Text style={styles.settingValue}>{value}</Text>
        )}
      </View>
      {rightComponent}
    </TouchableOpacity>
  );

  // Show loading if no user profile
  if (!userProfile) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#ec4899" />
        <Text style={{ marginTop: 16, color: '#6b7280' }}>Loading settings...</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Heart color="#ec4899" size={24} />
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Customize your VaultLove experience</Text>
        </View>
        
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>👤 Account</Text>
            
            <SettingItem
              icon={<UserCircle color="#ec4899" size={24} />}
              title="Your Name"
              value={userProfile?.displayName || 'Not set'}
              description={userProfile?.email || 'No email'}
            />

            <SettingItem
              icon={getPartnerStatusIcon()}
              title="Partner Connection"
              value={getPartnerStatusText()}
              description={
                userProfile?.partnerStatus === 'connected' 
                  ? 'Sharing vault with your partner'
                  : userProfile?.partnerStatus === 'pending'
                  ? 'Partner code active - waiting for connection'
                  : 'Connect with your partner to share memories'
              }
              onPress={() => {
                if (!userProfile) return;
                
                if (userProfile.partnerStatus === 'connected') {
                  // Show disconnect option
                  Alert.alert(
                    'Partner Connected',
                    'You are connected with your partner. What would you like to do?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Disconnect', onPress: disconnectPartner, style: 'destructive' }
                    ]
                  );
                } else if (userProfile.partnerStatus === 'pending') {
                  // Show code again
                  Alert.alert(
                    'Partner Code Active',
                    `Your partner code: ${userProfile.partnerCode}\n\nShare this with your partner to connect.`,
                    [
                      {
                        text: 'Copy Code',
                        onPress: () => {
                          if (userProfile.partnerCode) {
                            Clipboard.setString(userProfile.partnerCode);
                            Alert.alert('Copied!', 'Partner code copied to clipboard');
                          }
                        }
                      },
                      { text: 'OK' }
                    ]
                  );
                } else {
                  // Show connection options
                  Alert.alert(
                    'Connect with Partner',
                    'Choose how to connect with your partner',
                    [
                      { text: 'Generate Code', onPress: generatePartnerCode },
                      { text: 'Enter Code', onPress: () => setShowPartnerDialog(true) },
                      { text: 'Cancel', style: 'cancel' }
                    ]
                  );
                }
              }}
            />
          </View>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔒 Security</Text>
            
            {isBiometricsAvailable && (
              <SettingItem
                icon={<Fingerprint color="#ec4899" size={24} />}
                title="Biometric Authentication"
                description="Unlock VaultLove using your fingerprint or Face ID"
                rightComponent={
                <Switch
                  value={biometricsEnabled}
                  onValueChange={toggleBiometrics}
                  trackColor={{ false: '#e5e7eb', true: '#ec4899' }}
                  thumbColor="#ffffff"
                />
                }
              />
            )}
            
            <SettingItem
              icon={<Lock color="#ec4899" size={24} />}
              title="Change Password"
              description="Update your account password"
              onPress={() => Alert.alert("Feature", "Password change coming soon!")}
            />
          </View>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💝 Vault</Text>
            
            <SettingItem
              icon={<Shield color="#ec4899" size={24} />}
              title="Storage Usage"
              value={storageStats ? formatStorageDisplay(storageStats) : 'Loading...'}
              description={storageStats ? `${storageStats.fileCount} files stored` : 'Calculating...'}
              onPress={loadStorageStats}
            />
            
            <SettingItem
              icon={<Bell color="#ec4899" size={24} />}
              title="Memory Reminders"
              description="Get notified about special moments"
              rightComponent={
                <Switch
                  value={notificationsEnabled}
                  onValueChange={(value) => {
                    setNotificationsEnabled(value);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  trackColor={{ false: '#e5e7eb', true: '#ec4899' }}
                  thumbColor="#ffffff"
                />
              }
            />
          </View>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚙️ App</Text>
            
            <SettingItem
              icon={<Palette color="#ec4899" size={24} />}
              title="Theme"
              value="Light"
              description="Customize your app appearance"
              onPress={() => Alert.alert("Feature", "Theme options coming soon!")}
            />
            
            <SettingItem
              icon={<Info color="#ec4899" size={24} />}
              title="About VaultLove"
              description="Version 1.0.0 • Built with ❤️"
              onPress={() => Alert.alert("VaultLove", "A secure vault for your precious memories.\n\nBuilt with React Native & Expo\nPowered by Firebase")}
            />
          </View>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚠️ Danger Zone</Text>
            
            <SettingItem
              icon={<Trash2 color="#ef4444" size={24} />}
              title="Clear All Memories"
              description="Permanently delete all stored content"
              onPress={handleClearVault}
              isDanger={true}
            />
            
            <SettingItem
              icon={<LogOut color="#ef4444" size={24} />}
              title="Logout"
              description="Sign out of your account"
              onPress={handleLogout}
              isDanger={true}
            />
          </View>
          
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Made with 💖 for couples who cherish their memories
            </Text>
          </View>
        </ScrollView>

        {/* Partner Code Input Dialog */}
        {showPartnerDialog && (
          <View style={styles.dialogOverlay}>
            <View style={styles.dialogContainer}>
              <Text style={styles.dialogTitle}>Connect with Partner</Text>
              <Text style={styles.dialogSubtitle}>
                Enter the partner code shared by your loved one
              </Text>
              
              <TextInput
                style={styles.dialogInput}
                placeholder="Enter partner code (e.g. ALEX-1234)"
                placeholderTextColor="#9ca3af"
                value={partnerCode}
                onChangeText={setPartnerCode}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              
              <View style={styles.dialogButtons}>
                <TouchableOpacity
                  style={styles.dialogCancelButton}
                  onPress={() => {
                    setShowPartnerDialog(false);
                    setPartnerCode('');
                  }}
                >
                  <Text style={styles.dialogCancelText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.dialogConnectButton, isLoading && styles.dialogButtonDisabled]}
                  onPress={connectWithPartner}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.dialogConnectText}>Connect</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#ec4899" />
          </View>
        )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 8,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  section: {
    marginTop: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  dangerItem: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  settingIcon: {
    marginRight: 16,
    padding: 8,
    backgroundColor: '#fdf2f8',
    borderRadius: 8,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 2,
  },
  dangerText: {
    color: '#ef4444',
  },
  settingDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 18,
  },
  settingValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ec4899',
    marginTop: 2,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  footerText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
  },
  dialogOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialogContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 25,
    elevation: 25,
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  dialogSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  dialogInput: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    color: '#1f2937',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 24,
    textAlign: 'center',
  },
  dialogButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  dialogCancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  dialogCancelText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6b7280',
    textAlign: 'center',
  },
  dialogConnectButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#ec4899',
  },
  dialogButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  dialogConnectText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});