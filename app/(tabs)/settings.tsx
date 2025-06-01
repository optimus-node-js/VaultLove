import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Switch, 
  Alert,
  ScrollView
} from 'react-native';
import { router } from 'expo-router';
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
  Bell
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const [biometricsEnabled, setBiometricsEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isBiometricsAvailable, setIsBiometricsAvailable] = useState(false);
  
  // Mock data for demo
  const username = "Alex";
  const partnerUsername = "Jordan";
  const mediaCount = 42;
  
  React.useEffect(() => {
    checkBiometricsAvailability();
  }, []);
  
  const checkBiometricsAvailability = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    setIsBiometricsAvailable(compatible && enrolled);
  };
  
  const handleBiometricsToggle = async (value: boolean) => {
    if (value) {
      // Verify identity before enabling biometrics
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Verify identity to enable biometrics',
          disableDeviceFallback: false,
        });
        
        if (result.success) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setBiometricsEnabled(true);
          Alert.alert("Success", "Biometric authentication enabled!");
        }
      } catch (error) {
        console.log('Biometric error:', error);
      }
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setBiometricsEnabled(false);
      Alert.alert("Disabled", "Biometric authentication disabled.");
    }
  };
  
  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Logout",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            router.replace('/(auth)');
          },
          style: "destructive"
        }
      ]
    );
  };
  
  const handleClearVault = () => {
    Alert.alert(
      "Clear Vault",
      "Are you sure you want to delete all memories? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
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
  
  return (
    <LinearGradient
      colors={['#0c0c0c', '#090909']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Heart color="#ff2d55" size={24} />
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Customize your VaultLove experience</Text>
        </View>
        
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>👤 Account</Text>
            
            <SettingItem
              icon={<UserCircle color="#ff2d55" size={24} />}
              title="Your Name"
              value={username}
            />
            
            <SettingItem
              icon={<Users color="#ff2d55" size={24} />}
              title="Partner's Name"
              value={partnerUsername}
              description="Share your vault with your loved one"
            />
          </View>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔒 Security</Text>
            
            {isBiometricsAvailable && (
              <SettingItem
                icon={<Fingerprint color="#ff2d55" size={24} />}
                title="Biometric Authentication"
                description="Unlock VaultLove using your fingerprint or Face ID"
                rightComponent={
                  <Switch
                    value={biometricsEnabled}
                    onValueChange={handleBiometricsToggle}
                    trackColor={{ false: '#3a3a3c', true: '#ff2d55' }}
                    thumbColor="#fff"
                  />
                }
              />
            )}
            
            <SettingItem
              icon={<Lock color="#ff2d55" size={24} />}
              title="Change PIN"
              description="Update your 6-digit security PIN"
              onPress={() => Alert.alert("Feature", "PIN change coming soon!")}
            />
          </View>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💝 Vault</Text>
            
            <SettingItem
              icon={<Shield color="#ff2d55" size={24} />}
              title="Total Memories"
              value={`${mediaCount} items`}
              description="Precious moments safely stored"
            />
            
            <SettingItem
              icon={<Bell color="#ff2d55" size={24} />}
              title="Memory Reminders"
              description="Get notified about special moments"
              rightComponent={
                <Switch
                  value={notificationsEnabled}
                  onValueChange={(value) => {
                    setNotificationsEnabled(value);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  trackColor={{ false: '#3a3a3c', true: '#ff2d55' }}
                  thumbColor="#fff"
                />
              }
            />
          </View>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚙️ App</Text>
            
            <SettingItem
              icon={<Palette color="#ff2d55" size={24} />}
              title="Theme"
              value="Dark"
              description="Customize your app appearance"
              onPress={() => Alert.alert("Feature", "Theme options coming soon!")}
            />
            
            <SettingItem
              icon={<Info color="#ff2d55" size={24} />}
              title="About VaultLove"
              description="Version 1.0.0 • Built with ❤️"
              onPress={() => Alert.alert("VaultLove", "A secure vault for your precious memories.\n\nBuilt with React Native & Expo")}
            />
          </View>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚠️ Danger Zone</Text>
            
            <SettingItem
              icon={<Trash2 color="#ff3b30" size={24} />}
              title="Clear All Memories"
              description="Permanently delete all stored content"
              onPress={handleClearVault}
              isDanger={true}
            />
            
            <SettingItem
              icon={<LogOut color="#ff3b30" size={24} />}
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
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    color: '#fff',
    marginTop: 8,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 32,
  },
  sectionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: '#fff',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  dangerItem: {
    backgroundColor: 'rgba(255, 59, 48, 0.05)',
    borderColor: 'rgba(255, 59, 48, 0.2)',
  },
  settingIcon: {
    marginRight: 16,
    padding: 8,
    backgroundColor: 'rgba(255, 45, 85, 0.1)',
    borderRadius: 8,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    color: '#fff',
    marginBottom: 2,
  },
  dangerText: {
    color: '#ff3b30',
  },
  settingDescription: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#999',
    lineHeight: 18,
  },
  settingValue: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: '#ff2d55',
    marginTop: 2,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  footerText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});