import { 
  getDatabase, 
  ref, 
  push, 
  set, 
  get, 
  onValue, 
  off, 
  update, 
  remove,
  serverTimestamp,
  query,
  orderByChild,
  limitToLast,
  startAfter,
  Database
} from 'firebase/database';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { nanoid } from 'nanoid';
import authService, { UserProfile } from './auth';
import storageService from './storage';
import { encryptText, decryptText } from '../utils/encryption';
import { 
  ChatMessage, 
  ChatConversation, 
  TypingIndicator, 
  VoiceNote, 
  MediaMessage,
  LocalChatMessage,
  ChatUser,
  MessageDeliveryReceipt,
  MediaUploadProgress,
  CallData
} from '../utils/chatTypes';

// Get Firebase app instance
const getFirebaseApp = (): FirebaseApp => {
  if (getApps().length === 0) {
    throw new Error('Firebase not initialized. Please initialize Firebase first.');
  }
  return getApp();
};

class ChatService {
  private database: Database = getDatabase(getFirebaseApp());
  private messageListeners: Map<string, any> = new Map();
  private typingListeners: Map<string, any> = new Map();
  private onlineStatusListeners: Map<string, any> = new Map();
  private currentUserId: string | null = null;
  private currentCoupleId: string | null = null;
  
  // Local storage keys
  private readonly MESSAGES_CACHE_KEY = 'chat_messages_cache';
  private readonly CONVERSATIONS_CACHE_KEY = 'chat_conversations_cache';
  private readonly CHAT_PREFERENCES_KEY = 'chat_preferences';

  constructor() {
    this.initializeChatService();
  }

  private async initializeChatService() {
    try {
      console.log('🗣️ Initializing chat service...');
      
      // Listen for auth state changes
      authService.onAuthStateChange((user) => {
        if (user) {
          this.currentUserId = user.uid;
          this.setupUserPresence(user.uid);
        } else {
          this.currentUserId = null;
          this.currentCoupleId = null;
          this.cleanup();
        }
      });

      // Listen for profile changes to get couple ID
      authService.onProfileChange((profile) => {
        if (profile && profile.partnerStatus === 'connected' && profile.partnerId) {
          this.currentCoupleId = this.generateCoupleId(profile.uid, profile.partnerId);
          console.log('💑 Couple ID established:', this.currentCoupleId);
        } else {
          this.currentCoupleId = null;
        }
      });

      console.log('✅ Chat service initialized');
    } catch (error) {
      console.error('❌ Chat service initialization failed:', error);
    }
  }

  // Generate consistent couple ID for both partners
  private generateCoupleId(userId1: string, userId2: string): string {
    return [userId1, userId2].sort().join('_');
  }

  // User presence management
  private async setupUserPresence(userId: string) {
    try {
      const userStatusRef = ref(this.database, `presence/${userId}`);
      const userRef = ref(this.database, `users/${userId}`);
      
      // Set user as online
      await set(userStatusRef, {
        isOnline: true,
        lastSeen: serverTimestamp()
      });

      await update(userRef, {
        isOnline: true,
        lastSeen: serverTimestamp()
      });

      // Set up disconnect handler
      const disconnectRef = ref(this.database, `presence/${userId}`);
      await set(disconnectRef, {
        isOnline: false,
        lastSeen: serverTimestamp()
      });

      console.log('👥 User presence set up for:', userId);
    } catch (error) {
      console.error('❌ Failed to setup user presence:', error);
    }
  }

  // Message Operations
  async sendMessage(
    receiverId: string,
    messageType: ChatMessage['messageType'],
    content: string,
    mediaUrl?: string,
    fileName?: string,
    fileSize?: number,
    voiceDuration?: number
  ): Promise<string> {
    try {
      if (!this.currentUserId || !this.currentCoupleId) {
        throw new Error('User not authenticated or no active couple');
      }

      console.log('📤 Sending message:', { messageType, content: content.substring(0, 50) });

      // Encrypt text content
      const encryptedContent = messageType === 'text' ? await encryptText(content) : content;

      const messageId = nanoid();
      const message: ChatMessage = {
        id: messageId,
        senderId: this.currentUserId,
        receiverId,
        coupleId: this.currentCoupleId,
        messageType,
        content: encryptedContent,
        mediaUrl,
        fileName,
        fileSize,
        voiceDuration,
        timestamp: Date.now(),
        status: 'sending'
      };

      // Save to local storage first for immediate UI update
      await this.saveMessageLocally(message);

      // Save to Firebase Realtime Database
      const messagesRef = ref(this.database, `couples/${this.currentCoupleId}/messages`);
      const messageRef = push(messagesRef);
      await set(messageRef, {
        ...message,
        id: messageRef.key,
        timestamp: serverTimestamp()
      });

      // Update conversation last message
      await this.updateConversationLastMessage(this.currentCoupleId, message);

      // Update message status to sent
      await this.updateMessageStatus(messageRef.key!, 'sent');

      console.log('✅ Message sent successfully:', messageRef.key);
      return messageRef.key!;
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      throw error;
    }
  }

  async sendMediaMessage(
    receiverId: string,
    mediaType: 'image' | 'video' | 'document',
    fileUri: string,
    fileName: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    try {
      if (!this.currentUserId || !this.currentCoupleId) {
        throw new Error('User not authenticated or no active couple');
      }

      console.log('📷 Sending media message:', { mediaType, fileName });

      // Upload media to Cloudinary via storage service
      const mediaFile = await storageService.uploadFile(
        fileUri,
        fileName,
        this.getMimeType(mediaType, fileName),
        undefined, // No caption for chat media
        onProgress
      );

      // Send message with media URL
      return await this.sendMessage(
        receiverId,
        mediaType,
        '', // No text content for media messages
        mediaFile.downloadURL,
        fileName,
        mediaFile.fileSize
      );
    } catch (error) {
      console.error('❌ Failed to send media message:', error);
      throw error;
    }
  }

  async sendVoiceNote(
    receiverId: string,
    voiceUri: string,
    duration: number,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    try {
      if (!this.currentUserId || !this.currentCoupleId) {
        throw new Error('User not authenticated or no active couple');
      }

      console.log('🎤 Sending voice note:', { duration });

      const fileName = `voice_${Date.now()}.m4a`;
      
      // Upload voice note to Cloudinary
      const voiceFile = await storageService.uploadFile(
        voiceUri,
        fileName,
        'audio/mp4',
        undefined,
        onProgress
      );

      // Send message with voice URL
      return await this.sendMessage(
        receiverId,
        'voice',
        '', // No text content for voice messages
        voiceFile.downloadURL,
        fileName,
        voiceFile.fileSize,
        duration
      );
    } catch (error) {
      console.error('❌ Failed to send voice note:', error);
      throw error;
    }
  }

  // Message status updates
  async updateMessageStatus(messageId: string, status: ChatMessage['status']) {
    try {
      if (!this.currentCoupleId) return;

      const messageRef = ref(this.database, `couples/${this.currentCoupleId}/messages/${messageId}`);
      await update(messageRef, { status });

      // Update local cache
      await this.updateLocalMessageStatus(messageId, status);
      
      console.log('📋 Message status updated:', { messageId, status });
    } catch (error) {
      console.error('❌ Failed to update message status:', error);
    }
  }

  async markMessageAsRead(messageId: string) {
    await this.updateMessageStatus(messageId, 'seen');
  }

  async markMessagesAsRead(messageIds: string[]) {
    const promises = messageIds.map(id => this.markMessageAsRead(id));
    await Promise.all(promises);
  }

  // Real-time message listening
  subscribeToMessages(
    coupleId: string,
    onMessagesUpdate: (messages: ChatMessage[]) => void,
    limit: number = 50
  ): () => void {
    try {
      console.log('👂 Subscribing to messages for couple:', coupleId);

      const messagesRef = ref(this.database, `couples/${coupleId}/messages`);
      const messagesQuery = query(
        messagesRef,
        orderByChild('timestamp'),
        limitToLast(limit)
      );

      const unsubscribe = onValue(messagesQuery, async (snapshot) => {
        const messagesData = snapshot.val();
        if (!messagesData) {
          onMessagesUpdate([]);
          return;
        }

        const messages: ChatMessage[] = [];
        for (const [key, messageData] of Object.entries(messagesData)) {
          const message = messageData as ChatMessage;
          message.id = key;
          
          // Decrypt text messages
          if (message.messageType === 'text' && message.content) {
            try {
              message.content = await decryptText(message.content);
            } catch (decryptError) {
              console.warn('⚠️ Failed to decrypt message:', key);
              message.content = '[Message could not be decrypted]';
            }
          }
          
          messages.push(message);
        }

        // Sort by timestamp
        messages.sort((a, b) => a.timestamp - b.timestamp);

        // Cache messages locally
        await this.cacheMessages(coupleId, messages);

        onMessagesUpdate(messages);
      });

      this.messageListeners.set(coupleId, unsubscribe);
      return () => {
        unsubscribe();
        this.messageListeners.delete(coupleId);
      };
    } catch (error) {
      console.error('❌ Failed to subscribe to messages:', error);
      return () => {};
    }
  }

  // Typing indicators
  async setTypingStatus(coupleId: string, isTyping: boolean) {
    try {
      if (!this.currentUserId) return;

      const typingRef = ref(this.database, `couples/${coupleId}/typing/${this.currentUserId}`);
      
      if (isTyping) {
        await set(typingRef, {
          userId: this.currentUserId,
          isTyping: true,
          timestamp: serverTimestamp()
        });
      } else {
        await remove(typingRef);
      }
      
      console.log('⌨️ Typing status updated:', { coupleId, isTyping });
    } catch (error) {
      console.error('❌ Failed to update typing status:', error);
    }
  }

  subscribeToTypingIndicators(
    coupleId: string,
    onTypingUpdate: (typingUsers: TypingIndicator[]) => void
  ): () => void {
    try {
      const typingRef = ref(this.database, `couples/${coupleId}/typing`);
      
      const unsubscribe = onValue(typingRef, (snapshot) => {
        const typingData = snapshot.val();
        if (!typingData) {
          onTypingUpdate([]);
          return;
        }

        const typingUsers: TypingIndicator[] = Object.values(typingData)
          .filter((indicator: any) => indicator.userId !== this.currentUserId)
          .map((indicator: any) => indicator as TypingIndicator);

        onTypingUpdate(typingUsers);
      });

      this.typingListeners.set(coupleId, unsubscribe);
      return () => {
        unsubscribe();
        this.typingListeners.delete(coupleId);
      };
    } catch (error) {
      console.error('❌ Failed to subscribe to typing indicators:', error);
      return () => {};
    }
  }

  // Online status
  subscribeToPartnerOnlineStatus(
    partnerId: string,
    onStatusUpdate: (user: ChatUser) => void
  ): () => void {
    try {
      const userRef = ref(this.database, `users/${partnerId}`);
      
      const unsubscribe = onValue(userRef, (snapshot) => {
        const userData = snapshot.val();
        if (userData) {
          const chatUser: ChatUser = {
            uid: partnerId,
            displayName: userData.displayName || 'Partner',
            photoURL: userData.photoURL,
            isOnline: userData.isOnline || false,
            lastSeen: userData.lastSeen || Date.now()
          };
          onStatusUpdate(chatUser);
        }
      });

      this.onlineStatusListeners.set(partnerId, unsubscribe);
      return () => {
        unsubscribe();
        this.onlineStatusListeners.delete(partnerId);
      };
    } catch (error) {
      console.error('❌ Failed to subscribe to partner online status:', error);
      return () => {};
    }
  }

  // Local storage operations
  private async saveMessageLocally(message: ChatMessage) {
    try {
      const localMessage: LocalChatMessage = {
        ...message,
        isSynced: false,
        localId: nanoid()
      };

      const existingMessages = await this.getLocalMessages(message.coupleId);
      existingMessages.push(localMessage);

      await AsyncStorage.setItem(
        `${this.MESSAGES_CACHE_KEY}_${message.coupleId}`,
        JSON.stringify(existingMessages)
      );
    } catch (error) {
      console.error('❌ Failed to save message locally:', error);
    }
  }

  private async getLocalMessages(coupleId: string): Promise<LocalChatMessage[]> {
    try {
      const cached = await AsyncStorage.getItem(`${this.MESSAGES_CACHE_KEY}_${coupleId}`);
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      console.error('❌ Failed to get local messages:', error);
      return [];
    }
  }

  private async cacheMessages(coupleId: string, messages: ChatMessage[]) {
    try {
      const localMessages: LocalChatMessage[] = messages.map(msg => ({
        ...msg,
        isSynced: true
      }));

      await AsyncStorage.setItem(
        `${this.MESSAGES_CACHE_KEY}_${coupleId}`,
        JSON.stringify(localMessages)
      );
    } catch (error) {
      console.error('❌ Failed to cache messages:', error);
    }
  }

  private async updateLocalMessageStatus(messageId: string, status: ChatMessage['status']) {
    try {
      if (!this.currentCoupleId) return;

      const messages = await this.getLocalMessages(this.currentCoupleId);
      const messageIndex = messages.findIndex(m => m.id === messageId);
      
      if (messageIndex !== -1) {
        messages[messageIndex].status = status;
        await AsyncStorage.setItem(
          `${this.MESSAGES_CACHE_KEY}_${this.currentCoupleId}`,
          JSON.stringify(messages)
        );
      }
    } catch (error) {
      console.error('❌ Failed to update local message status:', error);
    }
  }

  // Conversation management
  private async updateConversationLastMessage(coupleId: string, message: ChatMessage) {
    try {
      const conversationRef = ref(this.database, `conversations/${coupleId}`);
      await update(conversationRef, {
        lastMessage: message,
        lastMessageTime: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('❌ Failed to update conversation:', error);
    }
  }

  // Message deletion
  async deleteMessage(messageId: string, deleteFor: 'sender' | 'both' = 'sender') {
    try {
      if (!this.currentCoupleId) return;

      const messageRef = ref(this.database, `couples/${this.currentCoupleId}/messages/${messageId}`);
      
      if (deleteFor === 'both') {
        // Delete completely
        await remove(messageRef);
      } else {
        // Mark as deleted for sender only
        await update(messageRef, {
          isDeleted: true,
          deletedFor: deleteFor
        });
      }

      console.log('🗑️ Message deleted:', { messageId, deleteFor });
    } catch (error) {
      console.error('❌ Failed to delete message:', error);
    }
  }

  // Utility methods
  private getMimeType(mediaType: string, fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    switch (mediaType) {
      case 'image':
        return extension === 'png' ? 'image/png' : 'image/jpeg';
      case 'video':
        return 'video/mp4';
      case 'document':
        switch (extension) {
          case 'pdf': return 'application/pdf';
          case 'doc': return 'application/msword';
          case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          default: return 'application/octet-stream';
        }
      default:
        return 'application/octet-stream';
    }
  }

  // Partner connection methods
  async initializeChatForCouple(userId: string, partnerId: string) {
    try {
      const coupleId = this.generateCoupleId(userId, partnerId);
      
      const conversationRef = ref(this.database, `conversations/${coupleId}`);
      const conversationSnapshot = await get(conversationRef);
      
      if (!conversationSnapshot.exists()) {
        // Create new conversation
        const conversation: ChatConversation = {
          id: coupleId,
          participants: [userId, partnerId],
          lastMessageTime: Date.now(),
          unreadCount: { [userId]: 0, [partnerId]: 0 },
          isActive: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        await set(conversationRef, conversation);
        console.log('💑 Chat initialized for couple:', coupleId);
      }

      return coupleId;
    } catch (error) {
      console.error('❌ Failed to initialize chat for couple:', error);
      throw error;
    }
  }

  // Get current couple ID
  getCurrentCoupleId(): string | null {
    return this.currentCoupleId;
  }

  // Cleanup
  cleanup() {
    console.log('🧹 Cleaning up chat service...');
    
    // Remove all listeners
    this.messageListeners.forEach((unsubscribe) => {
      if (typeof unsubscribe === 'function') unsubscribe();
    });
    this.messageListeners.clear();

    this.typingListeners.forEach((unsubscribe) => {
      if (typeof unsubscribe === 'function') unsubscribe();
    });
    this.typingListeners.clear();

    this.onlineStatusListeners.forEach((unsubscribe) => {
      if (typeof unsubscribe === 'function') unsubscribe();
    });
    this.onlineStatusListeners.clear();
  }
}

export const chatService = new ChatService();
export default chatService;