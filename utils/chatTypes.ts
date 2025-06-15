export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  coupleId: string;
  messageType: 'text' | 'image' | 'voice' | 'video' | 'document';
  content: string; // Encrypted content for text messages
  mediaUrl?: string; // Cloudinary URL for media messages
  thumbnailUrl?: string; // Thumbnail for images/videos
  voiceDuration?: number; // Duration in seconds for voice messages
  fileName?: string; // Original filename for documents
  fileSize?: number; // File size in bytes
  timestamp: number;
  status: 'sending' | 'sent' | 'delivered' | 'seen';
  isEdited?: boolean;
  editedAt?: number;
  replyTo?: string; // Reply to message ID
  reactions?: MessageReaction[];
  isDeleted?: boolean;
  deletedFor?: 'sender' | 'both';
}

export interface MessageReaction {
  userId: string;
  emoji: string;
  timestamp: number;
}

export interface TypingIndicator {
  userId: string;
  coupleId: string;
  isTyping: boolean;
  timestamp: number;
}

export interface ChatConversation {
  id: string; // Same as coupleId
  participants: string[]; // Array of user IDs
  lastMessage?: ChatMessage;
  lastMessageTime: number;
  unreadCount: { [userId: string]: number };
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface VoiceNote {
  id: string;
  uri: string;
  duration: number;
  waveform?: number[]; // For voice visualization
  isPlaying?: boolean;
  currentTime?: number;
}

export interface MediaMessage {
  id: string;
  type: 'image' | 'video' | 'document';
  uri: string;
  cloudinaryUrl: string;
  thumbnailUrl?: string;
  fileName: string;
  fileSize: number;
  dimensions?: { width: number; height: number };
  uploadProgress?: number;
}

export interface CallData {
  id: string;
  coupleId: string;
  callerId: string;
  receiverId: string;
  type: 'voice' | 'video';
  status: 'calling' | 'ringing' | 'connected' | 'ended' | 'declined' | 'missed';
  startTime?: number;
  endTime?: number;
  duration?: number; // in seconds
}

export interface ChatUser {
  uid: string;
  displayName: string;
  photoURL?: string;
  isOnline: boolean;
  lastSeen: number;
}

export interface MessageDeliveryReceipt {
  messageId: string;
  userId: string;
  status: 'delivered' | 'seen';
  timestamp: number;
}

// Local storage interfaces for offline functionality
export interface LocalChatMessage extends ChatMessage {
  isSynced: boolean;
  localId?: string; // For offline messages
  retryCount?: number;
}

export interface ChatPreferences {
  notifications: boolean;
  messagePreview: boolean;
  readReceipts: boolean;
  typingIndicators: boolean;
  autoDownloadMedia: boolean;
  chatBackup: boolean;
}

export interface MediaUploadProgress {
  messageId: string;
  progress: number;
  status: 'uploading' | 'completed' | 'failed';
  error?: string;
}