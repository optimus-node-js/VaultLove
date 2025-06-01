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
import { CircleUser as UserCircle, Users, Fingerprint, Lock, Shield, LogOut, Trash2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { useVaultStore } from '@/stores/vaultStore';

export default function SettingsScreen() {
  const { 
    logout, 
    biometricsEnabled, 
    enableBiometrics, 
    username, 
    partnerUsername 
  } = useAuthStore();
  const { clearVault, mediaCount } = useVaultStore();
  const [isBiometricsAvailable, setIsBiometricsAvailable] = useState(false);
  
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
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verify identity to enable biometrics',
        disableDeviceFallback: false,
      });
      
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        enableBiometrics(true);
      }
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      enableBiometrics(false);
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
            logout();
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
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            try {
              await clearVault();
              Alert.alert("Success", "All memories have been deleted.");
            } catch (error) {
              Alert.alert("Error", "Failed to clear vault. Please try again.");
            }
          },
          style: "destructive"
        }
      ]
    );
  };
  
  return (
    <LinearGradient
      colors={['#0c0c0c', '#090909']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
        </View>
        
        <ScrollView style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}>
                <UserCircle color="#ff2d55" size={24} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Your Name</Text>
                <Text style={styles.settingValue}>{username}</Text>
              </View>
            </View>
            
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}>
                <Users color="#ff2d55" size={24} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Partner's Name</Text>
                <Text style={styles.settingValue}>{partnerUsername}</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Security</Text>
            
            {isBiometricsAvailable && (
              <View style={styles.settingItem}>
                <View style={styles.settingIcon}>
                  <Fingerprint color="#ff2d55" size={24} />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>Biometric Authentication</Text>
                  <Text style={styles.settingDescription}>
                    Unlock VaultLove using your fingerprint or Face ID
                  </Text>
                </View>
                <Switch
                  value={biometricsEnabled}
                  onValueChange={handleBiometricsToggle}
                  trackColor={{ false: '#3a3a3c', true: '#ff2d55' }}
                  thumbColor="#fff"
                />
              </View>
            )}
            
            <TouchableOpacity 
              style={styles.settingItem}
              onPress={() => router.push('/pin-setup')}
            >
              <View style={styles.settingIcon}>
                <Lock color="#ff2d55" size={24} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Change PIN</Text>
                <Text style={styles.settingDescription}>
                  Update your 6-digit security PIN
                </Text>
              </View>
            </TouchableOpacity>
          </View>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vault</Text>
            
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}>
                <Shield color="#ff2d55" size={24} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Total Memories</Text>
                <Text style={styles.settingValue}>{mediaCount}</Text>
              </View>
            </View>
            
            <TouchableOpacity 
              style={[styles.settingItem, styles.dangerItem]}
              onPress={handleClearVault}
            >
              <View style={styles.settingIcon}>
                <Trash2 color="#ff3b30" size={24} />
              </View>
              <View style={styles.settingContent}>
                <Text style={[styles.settingTitle, styles.dangerText]}>Clear Vault</Text>
                <Text style={styles.settingDescription}>
                  Delete all memories permanently
                </Text>
              </View>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity 
            style={[styles.settingItem, styles.logoutItem]}
            onPress={handleLogout}
          >
            <View style={styles.settingIcon}>
              <LogOut color="#ff3b30" size={24} />
            </View>
            <Text style={[styles.settingTitle, styles.dangerText]}>Logout</Text>
          </TouchableOpacity>
          
          <View style={styles.footer}>
            <Text style={styles.footerText}>VaultLove v1.0.0</Text>
            <Text style={styles.footerText}>
              End-to-end encrypted secure vault
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 28,
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    color: '#666',
    marginVertical: 12,
    paddingHorizontal: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c1e',
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 45, 85, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    color: '#fff',
  },
  settingDescription: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  settingValue: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  dangerItem: {
    borderBottomWidth: 0,
  },
  dangerText: {
    color: '#ff3b30',
  },
  logoutItem: {
    marginTop: 24,
    justifyContent: 'flex-start',
    borderBottomWidth: 0,
  },
  footer: {
    padding: 24,
    alignItems: 'center',
  },
  footerText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
});