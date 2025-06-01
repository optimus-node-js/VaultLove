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
  ScrollView
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Camera, Image as ImageIcon, X, Upload as UploadIcon } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'react-native';
import { useVaultStore } from '@/stores/vaultStore';

export default function UploadScreen() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const { uploadMedia } = useVaultStore();
  
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
      
      await uploadMedia({
        uri: selectedImage,
        caption,
        timestamp: new Date().toISOString(),
      });
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Clear form after successful upload
      setSelectedImage(null);
      setCaption('');
    } catch (error) {
      console.error('Upload failed:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
              <Text style={styles.title}>Upload Memory</Text>
            </View>
            
            {selectedImage ? (
              <View style={styles.selectedImageContainer}>
                <Image 
                  source={{ uri: selectedImage }} 
                  style={styles.selectedImage}
                  resizeMode="cover"
                />
                
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={clearSelection}
                >
                  <X color="#fff" size={24} />
                </TouchableOpacity>
                
                <View style={styles.captionContainer}>
                  <TextInput
                    style={styles.captionInput}
                    placeholder="Add a caption..."
                    placeholderTextColor="#666"
                    value={caption}
                    onChangeText={setCaption}
                    multiline
                  />
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
                    <ActivityIndicator color="#fff\" size="small" />
                  ) : (
                    <>
                      <UploadIcon color="#fff\" size={20} />
                      <Text style={styles.uploadButtonText}>Save to Vault</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.selectContainer}>
                <Text style={styles.selectText}>Choose how to add your memory</Text>
                
                <View style={styles.optionsContainer}>
                  <TouchableOpacity
                    style={styles.optionButton}
                    onPress={pickImage}
                  >
                    <View style={styles.optionIconContainer}>
                      <ImageIcon color="#ff2d55" size={32} />
                    </View>
                    <Text style={styles.optionText}>Gallery</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.optionButton}
                    onPress={takePhoto}
                  >
                    <View style={styles.optionIconContainer}>
                      <Camera color="#ff2d55" size={32} />
                    </View>
                    <Text style={styles.optionText}>Camera</Text>
                  </TouchableOpacity>
                </View>
                
                <Text style={styles.securityNote}>
                  All files are encrypted before being uploaded.
                  Only you and your partner can access them.
                </Text>
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
  selectContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  selectText: {
    fontFamily: 'Inter-Medium',
    fontSize: 20,
    color: '#fff',
    marginBottom: 32,
    textAlign: 'center',
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 48,
  },
  optionButton: {
    alignItems: 'center',
  },
  optionIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 45, 85, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  optionText: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    color: '#fff',
  },
  securityNote: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  selectedImageContainer: {
    flex: 1,
    padding: 16,
  },
  selectedImage: {
    width: '100%',
    height: 300,
    borderRadius: 12,
  },
  clearButton: {
    position: 'absolute',
    top: 24,
    right: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
  },
  captionContainer: {
    marginTop: 16,
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  captionInput: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#fff',
    minHeight: 80,
  },
  uploadButton: {
    backgroundColor: '#ff2d55',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  uploadButtonDisabled: {
    backgroundColor: '#666',
  },
  uploadButtonText: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    color: '#fff',
    marginLeft: 8,
  },
});