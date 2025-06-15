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
  Clipboard,
  Modal,
  Share
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import { 
  CircleUser as UserCircle, 
  Users, 
  User,
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
  XCircle,
  X,
  Link,
  Unlink,
  AlertCircle
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import authService, { UserProfile } from '../../services/auth';
import biometricAuthService from '../../services/biometricAuth';
import storageService from '../../services/storage';
import { performLogout } from '../../utils/authUtils';
import { StatusBar } from 'expo-status-bar';

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
  const [partnerInfo, setPartnerInfo] = useState<{
    partnerId?: string;
    partnerName?: string;
    partnerPhotoURL?: string;
    status: string;
  } | null>(null);

  // Modal states
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  // Form states
  const [generatedCode, setGeneratedCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Settings states
  const [autoSync, setAutoSync] = useState(true);
  const [shareLocation, setShareLocation] = useState(false);
  const router = useRouter();
  
  useEffect(() => {
    let mounted = true;
    
    // Subscribe to user profile changes
    const unsubscribeProfile = authService.onProfileChange((profile) => {
      if (mounted) {
        setUserProfile(profile);
      }
    });

    // Subscribe to partner status changes
    const unsubscribePartner = authService.onPartnerStatusChange((info) => {
      if (mounted) {
        setPartnerInfo(info);
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
      unsubscribeProfile();
      unsubscribePartner();
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

  const handleGenerateCode = async () => {
    try {
      setIsGenerating(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const code = await authService.generatePartnerConnection();
      setGeneratedCode(code);
      setShowGenerateModal(true);

      console.log('✅ Partner code generated:', code);
    } catch (error) {
      console.error('❌ Generate code error:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to generate partner code');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConnectWithCode = async () => {
    if (!partnerCode.trim()) {
      Alert.alert('Error', 'Please enter a partner code');
      return;
    }

    try {
      setIsConnecting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // First run the test to see what's happening
      console.log('🔍 Running connection test first...');
      await authService.testPartnerConnection(partnerCode.trim().toUpperCase());

      console.log('🔍 Now attempting actual connection...');
      await authService.connectWithPartner(partnerCode.trim().toUpperCase());
      
      setShowConnectModal(false);
      setPartnerCode('');
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Connected! 💕',
        'You are now connected to your partner. All your memories will be shared automatically.',
        [{ text: 'Awesome!', onPress: () => {} }]
      );
      
      console.log('✅ Successfully connected to partner');
    } catch (error) {
      console.error('❌ Connect error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Connection Failed', error instanceof Error ? error.message : 'Failed to connect with partner');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectPartner = async () => {
    Alert.alert(
      'Disconnect Partner',
      'Are you sure you want to disconnect from your partner? This will stop sharing memories and you will only see your own content.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDisconnecting(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

              await authService.disconnectPartner();
              
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Disconnected', 'You have been disconnected from your partner.');
              
              console.log('✅ Successfully disconnected from partner');
            } catch (error) {
              console.error('❌ Disconnect error:', error);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', 'Failed to disconnect from partner');
            } finally {
              setIsDisconnecting(false);
            }
          },
        },
      ]
    );
  };

  const copyToClipboard = async (text: string) => {
    try {
      await Clipboard.setString(text);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Alert.alert('Copied!', 'Partner code copied to clipboard');
    } catch (error) {
      console.error('Copy error:', error);
    }
  };

  const sharePartnerCode = async (code: string) => {
    try {
      await Share.share({
        message: `Hi! Use this code to connect with me on VaultLove and share our precious memories: ${code}`,
        title: 'VaultLove Partner Code',
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const formatStorageDisplay = (stats: { totalSize: number; fileCount: number }) => {
    const size = stats.totalSize;
    const units = ['B', 'KB', 'MB', 'GB'];
    let unitIndex = 0;
    let sizeValue = size;
    
    while (sizeValue >= 1024 && unitIndex < units.length - 1) {
      sizeValue /= 1024;
      unitIndex++;
    }
    
    return `${sizeValue.toFixed(1)} ${units[unitIndex]}`;
  };

  const handleClearVault = async () => {
    Alert.alert(
      'Clear All Memories',
      'This will permanently delete all your memories and cannot be undone. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Feature Coming Soon', 'Clear vault functionality will be available in a future update.');
          }
        }
      ]
    );
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              await performLogout();
              // Navigation will be handled by auth state change
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  // SettingItem Component
  interface SettingItemProps {
    icon: React.ReactNode;
    title: string;
    description?: string;
    value?: string;
    onPress?: () => void;
    rightComponent?: React.ReactNode;
    isDanger?: boolean;
  }

  const SettingItem: React.FC<SettingItemProps> = ({
    icon,
    title,
    description,
    value,
    onPress,
    rightComponent,
    isDanger = false
  }) => (
    <TouchableOpacity
      style={[styles.settingItem, isDanger && styles.settingItemDanger]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.settingItemIcon}>
        {icon}
      </View>
      <View style={styles.settingItemContent}>
        <Text style={[styles.settingItemTitle, isDanger && styles.settingItemTitleDanger]}>
          {title}
        </Text>
        {description && (
          <Text style={styles.settingItemDescription}>
            {description}
          </Text>
        )}
        {value && (
          <Text style={styles.settingItemValue}>
            {value}
          </Text>
        )}
      </View>
      {rightComponent && (
        <View style={styles.settingItemRight}>
          {rightComponent}
        </View>
      )}
      {onPress && !rightComponent && (
        <View style={styles.settingItemArrow}>
          <Text style={styles.settingArrowText}>›</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const getPartnerStatusInfo = () => {
    if (!userProfile) return null;

    switch (userProfile.partnerStatus) {
      case 'connected':
        return {
          icon: CheckCircle,
          color: '#10b981',
          text: 'Connected',
          description: `Connected to ${partnerInfo?.partnerName || 'Partner'}`,
        };
      case 'pending':
        return {
          icon: Clock,
          color: '#f59e0b',
          text: 'Pending',
          description: 'Waiting for partner to connect',
        };
      case 'no_partner':
      default:
        return {
          icon: AlertCircle,
          color: '#6b7280',
          text: 'Not Connected',
          description: 'Connect with your partner to share memories',
        };
    }
  };

  const statusInfo = getPartnerStatusInfo();

  const renderPartnerSection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Heart color="#ec4899" size={24} />
        <Text style={styles.sectionTitle}>Partner Connection</Text>
      </View>

      {statusInfo && (
        <View style={styles.statusContainer}>
          <View style={styles.statusRow}>
            <View style={styles.statusIconContainer}>
              <statusInfo.icon color={statusInfo.color} size={20} />
            </View>
            <View style={styles.statusText}>
              <Text style={styles.statusTitle}>{statusInfo.text}</Text>
              <Text style={styles.statusDescription}>{statusInfo.description}</Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.partnerActions}>
        {userProfile?.partnerStatus === 'connected' ? (
          <>
            <TouchableOpacity
              style={styles.partnerButton}
              onPress={() => setShowPartnerModal(true)}
            >
              <Users color="#ec4899" size={20} />
              <Text style={styles.partnerButtonText}>Manage Partnership</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={styles.partnerButton}
              onPress={() => setShowConnectModal(true)}
            >
              <Link color="#ec4899" size={20} />
              <Text style={styles.partnerButtonText}>Connect with Partner</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.partnerButton, styles.generateButton]}
              onPress={handleGenerateCode}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Copy color="#ffffff" size={20} />
              )}
              <Text style={styles.generateButtonText}>
                {isGenerating ? 'Generating...' : 'Generate Code to Share'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );

  const renderSettingsSection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Info color="#6b7280" size={24} />
        <Text style={styles.sectionTitle}>App Settings</Text>
      </View>

      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Bell color="#6b7280" size={20} />
          <View style={styles.settingText}>
            <Text style={styles.settingTitle}>Push Notifications</Text>
            <Text style={styles.settingDescription}>Get notified of partner activity</Text>
          </View>
        </View>
        <Switch
          value={notificationsEnabled}
          onValueChange={(value) => {
            setNotificationsEnabled(value);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          trackColor={{ false: '#e5e7eb', true: '#ec4899' }}
          thumbColor="#ffffff"
        />
      </View>

      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Clock color="#6b7280" size={20} />
          <View style={styles.settingText}>
            <Text style={styles.settingTitle}>Auto Sync</Text>
            <Text style={styles.settingDescription}>Automatically sync with partner</Text>
          </View>
        </View>
        <Switch
          value={autoSync}
          onValueChange={setAutoSync}
          trackColor={{ false: '#e5e7eb', true: '#ec4899' }}
          thumbColor="#ffffff"
        />
      </View>

      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Shield color="#6b7280" size={20} />
          <View style={styles.settingText}>
            <Text style={styles.settingTitle}>Privacy & Security</Text>
            <Text style={styles.settingDescription}>Manage your data protection</Text>
          </View>
        </View>
        <View style={styles.settingArrow}>
          <Text style={styles.settingArrowText}>›</Text>
        </View>
      </View>
    </View>
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
      <StatusBar style="dark" />
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
              title={userProfile?.email ||"Your Name"}
              value={userProfile?.displayName || 'Not set'}
              
            />

            {renderPartnerSection()}
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
          
          {renderSettingsSection()}
          
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Made with 💖 for couples who cherish their memories
            </Text>
          </View>
        </ScrollView>

        {/* Connect with Code Modal */}
        <Modal
          visible={showConnectModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowConnectModal(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Connect with Partner</Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setShowConnectModal(false)}
                >
                  <X color="#6b7280" size={24} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalDescription}>
                Enter the 6-character code your partner shared with you
              </Text>

              <TextInput
                style={styles.codeInput}
                value={partnerCode}
                onChangeText={(text) => setPartnerCode(text.toUpperCase())}
                placeholder="ABCD12"
                placeholderTextColor="#9ca3af"
                maxLength={6}
                autoCapitalize="characters"
                autoCorrect={false}
              />

              <TouchableOpacity
                style={[styles.connectButton, !partnerCode.trim() && styles.connectButtonDisabled]}
                onPress={handleConnectWithCode}
                disabled={isConnecting || !partnerCode.trim()}
              >
                {isConnecting ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.connectButtonText}>Connect</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Generated Code Modal */}
        <Modal
          visible={showGenerateModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowGenerateModal(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Partner Code Generated!</Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setShowGenerateModal(false)}
                >
                  <X color="#6b7280" size={24} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalDescription}>
                Share this code with your partner to connect your accounts
              </Text>

              <View style={styles.generatedCodeContainer}>
                <Text style={styles.generatedCode}>{generatedCode}</Text>
              </View>

              <Text style={styles.codeNote}>
                This code will expire in 24 hours
              </Text>

              <View style={styles.shareActions}>
                <TouchableOpacity
                  style={styles.shareButton}
                  onPress={() => copyToClipboard(generatedCode)}
                >
                  <Copy color="#ec4899" size={20} />
                  <Text style={styles.shareButtonText}>Copy</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.shareButton, styles.shareButtonPrimary]}
                  onPress={() => sharePartnerCode(generatedCode)}
                >
                  <Copy color="#ffffff" size={20} />
                  <Text style={styles.shareButtonPrimaryText}>Share</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Partner Management Modal */}
        <Modal
          visible={showPartnerModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowPartnerModal(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Partner Management</Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setShowPartnerModal(false)}
                >
                  <X color="#6b7280" size={24} />
                </TouchableOpacity>
              </View>

              {partnerInfo && (
                <View style={styles.partnerInfoContainer}>
                  <View style={styles.partnerDetails}>
                    <View style={styles.partnerAvatar}>
                      <User color="#6b7280" size={24} />
                    </View>
                    <View style={styles.partnerText}>
                      <Text style={styles.partnerName}>{partnerInfo.partnerName}</Text>
                      <Text style={styles.partnerStatus}>Connected Partner</Text>
                    </View>
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={styles.disconnectButton}
                onPress={handleDisconnectPartner}
                disabled={isDisconnecting}
              >
                {isDisconnecting ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <>
                    <Unlink color="#ffffff" size={20} />
                    <Text style={styles.disconnectButtonText}>Disconnect Partner</Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={styles.disconnectNote}>
                Disconnecting will stop sharing memories with your partner. You can reconnect anytime.
              </Text>
            </View>
          </View>
        </Modal>

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
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalDescription: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 24,
    textAlign: 'center',
  },
  codeInput: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  connectButton: {
    backgroundColor: '#ec4899',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  connectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  generatedCodeContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  generatedCode: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ec4899',
    letterSpacing: 8,
  },
  codeNote: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  shareActions: {
    flexDirection: 'row',
    gap: 12,
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  shareButtonPrimary: {
    backgroundColor: '#ec4899',
    borderColor: '#ec4899',
  },
  shareButtonPrimaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
  partnerInfoContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  partnerDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  partnerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  partnerText: {
    flex: 1,
  },
  partnerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  partnerStatus: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  disconnectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  disconnectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
  disconnectNote: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIconContainer: {
    marginRight: 12,
  },
  statusText: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  statusDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  partnerActions: {
    gap: 12,
  },
  partnerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fdf2f8',
    borderWidth: 1,
    borderColor: '#f3e8ff',
  },
  partnerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ec4899',
    marginLeft: 8,
  },
  generateButton: {
    backgroundColor: '#ec4899',
    borderColor: '#ec4899',
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    marginLeft: 12,
    flex: 1,
  },
  settingArrow: {
    marginLeft: 8,
  },
  settingArrowText: {
    fontSize: 20,
    color: '#9ca3af',
  },
  settingItemDanger: {
    borderBottomColor: '#fecaca',
  },
  settingItemIcon: {
    marginRight: 12,
  },
  settingItemContent: {
    flex: 1,
  },
  settingItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  settingItemTitleDanger: {
    color: '#ef4444',
  },
  settingItemDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  settingItemValue: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 2,
  },
  settingItemRight: {
    marginLeft: 12,
  },
  settingItemArrow: {
    marginLeft: 8,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
    marginLeft: 8,
  },
});