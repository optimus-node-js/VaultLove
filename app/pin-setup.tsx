import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import { Fingerprint, Lock } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '@/stores/authStore';

export default function PinSetupScreen() {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState(1);
  const [supportsBiometrics, setSupportsBiometrics] = useState(false);
  const { setupPin, enableBiometrics } = useAuthStore();
  
  useEffect(() => {
    checkBiometricsSupport();
  }, []);
  
  const checkBiometricsSupport = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    setSupportsBiometrics(compatible && enrolled);
  };
  
  const handleNumberPress = (number: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (step === 1) {
      if (pin.length < 6) {
        const newPin = pin + number;
        setPin(newPin);
        
        if (newPin.length === 6) {
          // Move to confirmation after small delay
          setTimeout(() => {
            setStep(2);
          }, 300);
        }
      }
    } else {
      if (confirmPin.length < 6) {
        const newConfirmPin = confirmPin + number;
        setConfirmPin(newConfirmPin);
        
        if (newConfirmPin.length === 6) {
          // Validate pins match after small delay
          setTimeout(() => {
            if (pin === newConfirmPin) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              // Save the PIN
              setupPin(pin);
              
              // Setup biometrics if supported
              if (supportsBiometrics) {
                setStep(3);
              } else {
                // Go directly to main app if biometrics not supported
                router.replace('/(auth)');
              }
            } else {
              // Pins don't match
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              setConfirmPin('');
            }
          }, 300);
        }
      }
    }
  };
  
  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (step === 1) {
      setPin(pin.slice(0, -1));
    } else if (step === 2) {
      setConfirmPin(confirmPin.slice(0, -1));
    }
  };
  
  const handleBiometricsSetup = async (enable: boolean) => {
    if (enable) {
      const auth = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verify identity to enable biometrics',
        disableDeviceFallback: false,
      });
      
      if (auth.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        enableBiometrics(true);
      }
    } else {
      enableBiometrics(false);
    }
    
    // Navigate to main app
    router.replace('/(auth)');
  };
  
  const renderPinDots = (currentPin: string) => {
    return (
      <View style={styles.dotsContainer}>
        {[...Array(6)].map((_, index) => (
          <View 
            key={index} 
            style={[
              styles.dot, 
              index < currentPin.length && styles.dotFilled
            ]} 
          />
        ))}
      </View>
    );
  };
  
  return (
    <LinearGradient
      colors={['#0c0c0c', '#090909']}
      style={styles.container}
    >
      {step === 3 ? (
        <View style={styles.biometricsContainer}>
          <Fingerprint color="#fff" size={64} />
          <Text style={styles.title}>Enable Biometrics?</Text>
          <Text style={styles.subtitle}>
            Use your fingerprint or Face ID to quickly unlock VaultLove
          </Text>
          
          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={[styles.button, styles.secondaryButton]} 
              onPress={() => handleBiometricsSetup(false)}
            >
              <Text style={[styles.buttonText, styles.secondaryButtonText]}>Skip</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.button} 
              onPress={() => handleBiometricsSetup(true)}
            >
              <Text style={styles.buttonText}>Enable</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <Lock color="#fff" size={32} />
            <Text style={styles.title}>
              {step === 1 ? 'Create PIN' : 'Confirm PIN'}
            </Text>
            <Text style={styles.subtitle}>
              {step === 1 
                ? 'Set a 6-digit PIN to secure your vault' 
                : 'Enter the same PIN again to confirm'}
            </Text>
            
            {renderPinDots(step === 1 ? pin : confirmPin)}
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
        </>
      )}
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
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 28,
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#999',
    marginBottom: 48,
    textAlign: 'center',
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
  biometricsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 48,
    width: '100%',
  },
  button: {
    flex: 1,
    backgroundColor: '#ff2d55',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#444',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-Medium',
  },
  secondaryButtonText: {
    color: '#fff',
  },
});