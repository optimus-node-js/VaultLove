import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { router } from 'expo-router';
import { Lock, Key, Heart } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '@/stores/authStore';
import { initializeVault } from '@/utils/vaultUtils';

export default function SetupScreen() {
  const [username, setUsername] = useState('');
  const [partnerUsername, setPartnerUsername] = useState('');
  const [encryptionKey, setEncryptionKey] = useState('');
  const [step, setStep] = useState(1);
  const { setInitialized } = useAuthStore();
  
  const handleNext = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    if (step === 1) {
      if (!username || !partnerUsername) return;
      setStep(2);
    } else {
      if (!encryptionKey) return;
      
      // Initialize the vault with the provided details
      await initializeVault({
        username,
        partnerUsername,
        encryptionKey
      });
      
      // Mark app as initialized
      setInitialized(true);
      
      // Navigate to PIN setup
      router.replace('/pin-setup');
    }
  };
  
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <LinearGradient
        colors={['#0c0c0c', '#090909']}
        style={styles.container}
      >
        <View style={styles.content}>
          <Heart color="#ff2d55" size={48} />
          <Text style={styles.title}>VaultLove</Text>
          <Text style={styles.subtitle}>Your private space for memories</Text>
          
          {step === 1 ? (
            <>
              <Text style={styles.stepTitle}>Who's using this vault?</Text>
              
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Your name"
                  placeholderTextColor="#666"
                  value={username}
                  onChangeText={setUsername}
                />
                <Lock color="#666" size={20} style={styles.inputIcon} />
              </View>
              
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Partner's name"
                  placeholderTextColor="#666"
                  value={partnerUsername}
                  onChangeText={setPartnerUsername}
                />
                <Lock color="#666" size={20} style={styles.inputIcon} />
              </View>
            </>
          ) : (
            <>
              <Text style={styles.stepTitle}>Create encryption key</Text>
              <Text style={styles.infoText}>
                This key will encrypt all your memories. 
                Write it down and keep it safe. If lost, your memories cannot be recovered.
              </Text>
              
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Strong encryption passphrase"
                  placeholderTextColor="#666"
                  value={encryptionKey}
                  onChangeText={setEncryptionKey}
                  secureTextEntry
                />
                <Key color="#666" size={20} style={styles.inputIcon} />
              </View>
            </>
          )}
          
          <TouchableOpacity 
            style={[
              styles.button,
              (!username || !partnerUsername) && step === 1 && styles.buttonDisabled,
              !encryptionKey && step === 2 && styles.buttonDisabled
            ]}
            onPress={handleNext}
            disabled={(step === 1 && (!username || !partnerUsername)) || (step === 2 && !encryptionKey)}
          >
            <Text style={styles.buttonText}>{step === 1 ? 'Continue' : 'Create Vault'}</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 32,
    color: '#fff',
    marginTop: 16,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#999',
    marginBottom: 48,
  },
  stepTitle: {
    fontFamily: 'Inter-Medium',
    fontSize: 20,
    color: '#fff',
    marginBottom: 24,
    alignSelf: 'flex-start',
  },
  infoText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#999',
    marginBottom: 24,
    lineHeight: 20,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 16,
    position: 'relative',
  },
  inputIcon: {
    position: 'absolute',
    right: 16,
    top: 16,
  },
  input: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    paddingRight: 48,
    fontSize: 16,
    color: '#fff',
    width: '100%',
    fontFamily: 'Inter-Regular',
    borderWidth: 1,
    borderColor: '#333',
  },
  button: {
    backgroundColor: '#ff2d55',
    borderRadius: 12,
    paddingVertical: 16,
    width: '100%',
    alignItems: 'center',
    marginTop: 32,
  },
  buttonDisabled: {
    backgroundColor: '#3a3a3c',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-Medium',
  },
});