import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Camera, Image as ImageIcon, X, Upload as UploadIcon, Heart } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'react-native';

export default function UploadScreen() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  
  const pickImage = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      quality: 0.8,
    });
    
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setSelectedImage(result.assets[0].uri);
    }
  };
  
  const takePhoto = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    
    if (cameraPermission.granted) {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImage(result.assets[0].uri);
      }
    } else {
      Alert.alert("Camera Permission", "We need camera access to take photos for your vault.");
    }
  };
  
  const clearSelection = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedImage(null);
    setCaption('');
  };
  
  const handleUpload = async () => {
    if (!selectedImage) return;
    
    try {
      setIsUploading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Simulate upload delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success!", "Your memory has been securely saved to the vault.");
      
      // Clear form after successful upload
      setSelectedImage(null);
      setCaption('');
    } catch (error) {
      console.error('Upload failed:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Upload Failed", "Please try again later.");
    } finally {
      setIsUploading(false);
    }
  };
  
  return (
    <LinearGradient
      colors={['#0c0c0c', '#090909']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
        >
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
              <Heart color="#ff2d55" size={24} />
              <Text style={styles.title}>Upload Memory</Text>
              <Text style={styles.subtitle}>Preserve your precious moments</Text>
            </View>
            
            {selectedImage ? (
              <View style={styles.selectedImageContainer}>
                <View style={styles.imageWrapper}>
                  <Image 
                    source={{ uri: selectedImage }} 
                    style={styles.selectedImage}
                    resizeMode="cover"
                  />
                  
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={clearSelection}
                  >
                    <X color="#fff" size={20} />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.captionContainer}>
                  <Text style={styles.captionLabel}>Add a memory note</Text>
                  <TextInput
                    style={styles.captionInput}
                    placeholder="What makes this moment special?"
                    placeholderTextColor="#666"
                    value={caption}
                    onChangeText={setCaption}
                    multiline
                    maxLength={200}
                  />
                  <Text style={styles.characterCount}>{caption.length}/200</Text>
                </View>
                
                <TouchableOpacity
                  style={[
                    styles.uploadButton,
                    isUploading && styles.uploadButtonDisabled
                  ]}
                  onPress={handleUpload}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <UploadIcon color="#fff" size={20} />
                      <Text style={styles.uploadButtonText}>Save to Vault</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.selectContainer}>
                <Text style={styles.selectText}>Choose how to capture your memory</Text>
                
                <View style={styles.optionsContainer}>
                  <TouchableOpacity
                    style={styles.optionButton}
                    onPress={pickImage}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={['rgba(255, 45, 85, 0.1)', 'rgba(255, 45, 85, 0.05)']}
                      style={styles.optionGradient}
                    >
                      <View style={styles.optionIconContainer}>
                        <ImageIcon color="#ff2d55" size={28} />
                      </View>
                      <Text style={styles.optionText}>From Gallery</Text>
                      <Text style={styles.optionSubtext}>Choose existing photos</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.optionButton}
                    onPress={takePhoto}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={['rgba(255, 45, 85, 0.1)', 'rgba(255, 45, 85, 0.05)']}
                      style={styles.optionGradient}
                    >
                      <View style={styles.optionIconContainer}>
                        <Camera color="#ff2d55" size={28} />
                      </View>
                      <Text style={styles.optionText}>Take Photo</Text>
                      <Text style={styles.optionSubtext}>Capture new moments</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
                
                <View style={styles.securityContainer}>
                  <Text style={styles.securityNote}>
                    🔒 All files are encrypted and secured
                  </Text>
                  <Text style={styles.securitySubNote}>
                    Only you can access your precious memories
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
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
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    paddingTop: 20,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    color: '#fff',
    marginTop: 12,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  selectContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  selectText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 20,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 40,
  },
  optionsContainer: {
    gap: 20,
    marginBottom: 40,
  },
  optionButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  optionGradient: {
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 45, 85, 0.2)',
    borderRadius: 16,
  },
  optionIconContainer: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: 'rgba(255, 45, 85, 0.1)',
    borderRadius: 50,
  },
  optionText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: '#fff',
    marginBottom: 4,
  },
  optionSubtext: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#999',
  },
  securityContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(255, 45, 85, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 45, 85, 0.1)',
  },
  securityNote: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    color: '#ff2d55',
    textAlign: 'center',
    marginBottom: 4,
  },
  securitySubNote: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  selectedImageContainer: {
    flex: 1,
  },
  imageWrapper: {
    position: 'relative',
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
  },
  selectedImage: {
    width: '100%',
    height: 300,
    borderRadius: 16,
  },
  clearButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 20,
    padding: 8,
  },
  captionContainer: {
    marginBottom: 24,
  },
  captionLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    color: '#fff',
    marginBottom: 8,
  },
  captionInput: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: '#fff',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    minHeight: 80,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    textAlignVertical: 'top',
  },
  characterCount: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    marginTop: 4,
  },
  uploadButton: {
    backgroundColor: '#ff2d55',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  uploadButtonDisabled: {
    backgroundColor: '#666',
  },
  uploadButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: '#fff',
  },
});