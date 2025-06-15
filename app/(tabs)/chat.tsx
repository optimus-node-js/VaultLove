import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Dimensions,
  Keyboard,
  Modal,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import {
  Send,
  Mic,
  Camera,
  Image as ImageIcon,
  Paperclip,
  Phone,
  Video,
  ArrowLeft,
  MoreVertical
} from 'lucide-react-native';
import { useRouter } from 'expo-router';

import authService, { UserProfile } from '../../services/auth';
import chatService from '../../services/chat';
import MessageBubble from '../../components/chat/MessageBubble';
import VoiceRecorder from '../../components/chat/VoiceRecorder';
import { ChatMessage, ChatUser, TypingIndicator } from '../../utils/chatTypes';

const { height: screenHeight } = Dimensions.get('window');

export default function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState<TypingIndicator[]>([]);
  const [partner, setPartner] = useState<ChatUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [imagePreviewModal, setImagePreviewModal] = useState({ visible: false, uri: '' });
  const [isLoading, setIsLoading] = useState(true);
  
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();
  
  useEffect(() => {
    // Subscribe to user profile changes
    const unsubscribeProfile = authService.onProfileChange((profile) => {
      setUserProfile(profile);
      
      if (profile?.partnerStatus === 'connected' && profile.partnerId) {
        // Setup chat with partner
        initializeChat(profile.partnerId);
      } else {
        setIsLoading(false);
      }
    });

    return unsubscribeProfile;
  }, []);

  const initializeChat = async (partnerId: string) => {
    try {
      console.log('💑 Initializing chat with partner:', partnerId);
      
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        router.push('/(auth)/signin');
        return;
      }

      // Initialize chat conversation
      const coupleId = await chatService.initializeChatForCouple(currentUser.uid, partnerId);
      
      // Subscribe to messages
      const unsubscribeMessages = chatService.subscribeToMessages(
        coupleId,
        (newMessages) => {
          setMessages(newMessages);
          // Mark messages as read
          const unreadMessages = newMessages
            .filter(msg => msg.senderId !== currentUser.uid && msg.status !== 'seen')
            .map(msg => msg.id);
          
          if (unreadMessages.length > 0) {
            chatService.markMessagesAsRead(unreadMessages);
          }
        }
      );

      // Subscribe to typing indicators
      const unsubscribeTyping = chatService.subscribeToTypingIndicators(
        coupleId,
        setPartnerTyping
      );

      // Subscribe to partner online status
      const unsubscribeStatus = chatService.subscribeToPartnerOnlineStatus(
        partnerId,
        setPartner
      );

      setIsLoading(false);

      return () => {
        unsubscribeMessages();
        unsubscribeTyping();
        unsubscribeStatus();
      };
    } catch (error) {
      console.error('❌ Failed to initialize chat:', error);
      Alert.alert('Error', 'Failed to load chat. Please try again.');
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!messageText.trim() || isSending || !userProfile?.partnerId) return;

    const text = messageText.trim();

    try {
      setIsSending(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      setMessageText('');
      
      // Stop typing indicator
      handleTypingEnd();

      await chatService.sendMessage(
        userProfile.partnerId,
        'text',
        text
      );

      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

      console.log('✅ Text message sent');
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
      setMessageText(text); // Restore message text
    } finally {
      setIsSending(false);
    }
  };

  const sendVoiceMessage = async (voiceUri: string, duration: number) => {
    try {
      if (!userProfile?.partnerId) return;

      console.log('🎤 Sending voice message:', { duration });
      
      await chatService.sendVoiceNote(
        userProfile.partnerId,
        voiceUri,
        duration
      );

      setShowVoiceRecorder(false);
      
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

      console.log('✅ Voice message sent');
    } catch (error) {
      console.error('❌ Failed to send voice message:', error);
      Alert.alert('Error', 'Failed to send voice message. Please try again.');
    }
  };

  const sendImage = async () => {
    try {
      if (!userProfile?.partnerId) return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        
        console.log('📷 Sending image:', asset.fileName);

        await chatService.sendMediaMessage(
          userProfile.partnerId,
          'image',
          asset.uri,
          asset.fileName || `image_${Date.now()}.jpg`
        );

        // Scroll to bottom
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error) {
      console.error('❌ Failed to send image:', error);
      Alert.alert('Error', 'Failed to send image. Please try again.');
    }
  };

  const takePhoto = async () => {
    try {
      if (!userProfile?.partnerId) return;

      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      if (cameraPermission.status !== 'granted') {
        Alert.alert('Camera Permission', 'Camera access is required to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        
        console.log('📸 Sending camera photo:', asset.fileName);

        await chatService.sendMediaMessage(
          userProfile.partnerId,
          'image',
          asset.uri,
          asset.fileName || `photo_${Date.now()}.jpg`
        );

        // Scroll to bottom
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error) {
      console.error('❌ Failed to take photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const handleTyping = (text: string) => {
    setMessageText(text);
    
    const coupleId = chatService.getCurrentCoupleId();
    if (!coupleId) return;

    if (text.trim().length > 0 && !isTyping) {
      setIsTyping(true);
      chatService.setTypingStatus(coupleId, true);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      handleTypingEnd();
    }, 1000);
  };

  const handleTypingEnd = () => {
    if (isTyping) {
      setIsTyping(false);
      const coupleId = chatService.getCurrentCoupleId();
      if (coupleId) {
        chatService.setTypingStatus(coupleId, false);
      }
    }
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  };

  const openImagePreview = (imageUrl: string) => {
    setImagePreviewModal({ visible: true, uri: imageUrl });
  };

  const closeImagePreview = () => {
    setImagePreviewModal({ visible: false, uri: '' });
  };

  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
    const currentUser = authService.getCurrentUser();
    const isOwn = item.senderId === currentUser?.uid;
    
    return (
      <MessageBubble
        message={item}
        isOwn={isOwn}
        onImagePress={openImagePreview}
        onVideoPress={(videoUrl) => {
          console.log('🎬 Video pressed:', videoUrl);
          // TODO: Implement video player
        }}
        onDocumentPress={(docUrl, fileName) => {
          console.log('📄 Document pressed:', fileName);
          // TODO: Implement document viewer
        }}
      />
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.push('/(tabs)')}>
        <ArrowLeft size={24} color="#1f2937" />
      </TouchableOpacity>
      
      <View style={styles.partnerInfo}>
        <View style={styles.partnerDetails}>
          <Text style={styles.partnerName}>
            {partner?.displayName || userProfile?.partnerId?.substring(0, 8) || 'Partner'}
          </Text>
          <Text style={styles.partnerStatus}>
            {partner?.isOnline ? 'Online' : 'Last seen recently'}
          </Text>
        </View>
      </View>

      <View style={styles.headerActions}>
        <TouchableOpacity style={styles.actionButton} onPress={() => {
          console.log('📞 Voice call initiated');
          // TODO: Implement voice call
        }}>
          <Phone size={22} color="#1f2937" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton} onPress={() => {
          console.log('📹 Video call initiated');
          // TODO: Implement video call
        }}>
          <Video size={22} color="#1f2937" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton}>
          <MoreVertical size={22} color="#1f2937" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderTypingIndicator = () => {
    if (partnerTyping.length === 0) return null;

    return (
      <View style={styles.typingContainer}>
        <View style={styles.typingBubble}>
          <View style={styles.typingDots}>
            <View style={[styles.typingDot, styles.typingDot1]} />
            <View style={[styles.typingDot, styles.typingDot2]} />
            <View style={[styles.typingDot, styles.typingDot3]} />
          </View>
        </View>
      </View>
    );
  };

  const renderInputArea = () => (
    <View style={styles.inputContainer}>
      <View style={styles.inputRow}>
        {/* Media buttons */}
        <TouchableOpacity style={styles.mediaButton} onPress={takePhoto}>
          <Camera size={24} color="#6b7280" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.mediaButton} onPress={sendImage}>
          <ImageIcon size={24} color="#6b7280" />
        </TouchableOpacity>

        {/* Text input */}
        <View style={styles.textInputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="Type a message..."
            placeholderTextColor="#9ca3af"
            value={messageText}
            onChangeText={handleTyping}
            onSubmitEditing={sendMessage}
            multiline
            maxLength={1000}
            onFocus={() => {
              setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
              }, 300);
            }}
          />
        </View>

        {/* Send/Voice button */}
        {messageText.trim().length > 0 ? (
          <TouchableOpacity 
            style={[styles.sendButton, isSending && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Send size={20} color="#ffffff" />
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={styles.voiceButton}
            onPress={() => setShowVoiceRecorder(true)}
          >
            <Mic size={24} color="#ec4899" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderNoPartnerState = () => (
    <View style={styles.noPartnerContainer}>
      <Text style={styles.noPartnerTitle}>No Partner Connected</Text>
      <Text style={styles.noPartnerText}>
        Connect with your partner to start chatting securely together.
      </Text>
      <TouchableOpacity 
        style={styles.connectButton}
        onPress={() => router.push('/(tabs)/settings')}
      >
        <Text style={styles.connectButtonText}>Connect Partner</Text>
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ec4899" />
        <Text style={styles.loadingText}>Loading chat...</Text>
      </View>
    );
  }

  if (!userProfile || userProfile.partnerStatus !== 'connected') {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          {renderHeader()}
          {renderNoPartnerState()}
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {renderHeader()}
        
        <KeyboardAvoidingView
          style={styles.chatContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContent}
            onContentSizeChange={() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }}
            showsVerticalScrollIndicator={false}
          />
          
          {renderTypingIndicator()}
          {renderInputArea()}
        </KeyboardAvoidingView>

        {/* Voice recorder */}
        <VoiceRecorder
          isVisible={showVoiceRecorder}
          onSendVoice={sendVoiceMessage}
          onCancel={() => setShowVoiceRecorder(false)}
          disabled={!userProfile?.partnerId}
        />

        {/* Image preview modal */}
        <Modal
          visible={imagePreviewModal.visible}
          transparent
          animationType="fade"
          onRequestClose={closeImagePreview}
        >
          <View style={styles.imagePreviewContainer}>
            <TouchableOpacity style={styles.imagePreviewOverlay} onPress={closeImagePreview} />
            <View style={styles.imagePreviewContent}>
              <TouchableOpacity style={styles.imagePreviewClose} onPress={closeImagePreview}>
                <Text style={styles.imagePreviewCloseText}>✕</Text>
              </TouchableOpacity>
              <Image
                source={{ uri: imagePreviewModal.uri }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            </View>
          </View>
        </Modal>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    backgroundColor: '#ffffff',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  partnerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  partnerDetails: {
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
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  chatContainer: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  messagesContent: {
    paddingVertical: 16,
  },
  typingContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f9fafb',
  },
  typingBubble: {
    backgroundColor: '#f3f4f6',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignSelf: 'flex-start',
    maxWidth: '75%',
  },
  typingDots: {
    flexDirection: 'row',
    gap: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9ca3af',
  },
  typingDot1: {
    // Animation handled by React Native Animated API, not CSS
  },
  typingDot2: {
    // Animation handled by React Native Animated API, not CSS
  },
  typingDot3: {
    // Animation handled by React Native Animated API, not CSS
  },
  inputContainer: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingBottom: Platform.OS === 'ios' ? 0 : 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  mediaButton: {
    padding: 8,
  },
  textInputContainer: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
  },
  textInput: {
    fontSize: 16,
    color: '#1f2937',
    lineHeight: 22,
    maxHeight: 80,
  },
  sendButton: {
    backgroundColor: '#ec4899',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  voiceButton: {
    padding: 8,
  },
  noPartnerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 24,
  },
  noPartnerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
  },
  noPartnerText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  connectButton: {
    backgroundColor: '#ec4899',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  connectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  imagePreviewContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePreviewOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  imagePreviewContent: {
    width: '90%',
    height: '80%',
    position: 'relative',
  },
  imagePreviewClose: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  imagePreviewCloseText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  previewImage: {
    width: '100%' as any,
    height: '100%' as any,
  },
});