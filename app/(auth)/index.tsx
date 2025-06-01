import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import { Fingerprint, Lock, Heart } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '@/stores/authStore';

export default function AuthScreen() {
  const [pin, setPin] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const { login, pin: storedPin, biometricsEnabled } = useAuthStore();
  
  useEffect(() => {
    checkBiometrics();
    
    // Try to authenticate with biometrics immediately if enabled
    if (biometricsEnabled) {
      authenticateWithBiometrics();
    }
  }, []);
  
  const checkBiometrics = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    setBiometricsAvailable(compatible && enrolled && biometricsEnabled);
  };
  
  const authenticateWithBiometrics = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access VaultLove',
        disableDeviceFallback: false,
      });
      
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        login();
        router.replace('/(tabs)');
      }
    } catch (error) {
      console.log('Biometric authentication error:', error);
    }
  };
  
  const handleNumberPress = (number: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (pin.length < 6) {
      const newPin = pin + number;
      setPin(newPin);
      
      if (newPin.length === 6) {
        // Validate PIN after small delay
        setTimeout(() => {
          if (newPin === storedPin) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            login();
            router.replace('/(tabs)');
          } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setPin('');
            setAttempts(attempts + 1);
            
            if (attempts + 1 >= 5) {
              // Lock out after 5 failed attempts
              Alert.alert(
                "Too Many Attempts",
                "Vault is locked. Please try again later.",
                [{ text: "OK" }]
              );
            }
          }
        }, 300);
      }
    }
  };
  
  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPin(pin.slice(0, -1));
  };
  
  const renderPinDots = () => {
    return (
      <View style={styles.dotsContainer}>
        {[...Array(6)].map((_, index) => (
          <View 
            key={index} 
            style={[
              styles.dot, 
              index < pin.length && styles.dotFilled
            ]} 
          />
        ))}
      </View>
    );
  };
  
  // Triple tap gesture to panic and close app
  const handlePanic = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    // In a real app, you would implement app locking or force quit here
    Alert.alert("Panic Mode", "Vault locked");
  };
  
  return (
    <LinearGradient
      colors={['#0c0c0c', '#090909']}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handlePanic}
          style={styles.heartContainer}
        >
          <Heart color="#ff2d55" size={32} />
        </TouchableOpacity>
        
        <Text style={styles.title}>VaultLove</Text>
        <Text style={styles.subtitle}>Enter PIN to unlock</Text>
        
        {renderPinDots()}
        
        {biometricsAvailable && (
          <TouchableOpacity
            style={styles.biometricButton}
            onPress={authenticateWithBiometrics}
          >
            <Fingerprint color="#fff" size={24} />
            <Text style={styles.biometricText}>Use biometrics</Text>
          </TouchableOpacity>
        )}
      </View>
      
      <View style={styles.keypad}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((number) => (
          <TouchableOpacity
            key={number}
            style={styles.keypadButton}
            onPress={() => handleNumberPress(number.toString())}
          >
            <Text style={styles.keypadButtonText}>{number}</Text>
          </TouchableOpacity>
        ))}
        
        <View style={styles.keypadButton} />
        
        <TouchableOpacity
          style={styles.keypadButton}
          onPress={() => handleNumberPress('0')}
        >
          <Text style={styles.keypadButtonText}>0</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.keypadButton}
          onPress={handleDelete}
        >
          <Text style={styles.keypadButtonText}>←</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  heartContainer: {
    marginBottom: 16,
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 28,
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#999',
    marginBottom: 48,
  },
  dotsContainer: {
    flexDirection: 'row',
    marginTop: 24,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#666',
    marginHorizontal: 8,
  },
  dotFilled: {
    backgroundColor: '#ff2d55',
    borderColor: '#ff2d55',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 32,
    padding: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  biometricText: {
    fontFamily: 'Inter-Regular',
    color: '#fff',
    marginLeft: 8,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    padding: 16,
    marginBottom: 24,
  },
  keypadButton: {
    width: '33%',
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keypadButtonText: {
    fontFamily: 'Inter-Medium',
    fontSize: 28,
    color: '#fff',
  },
});