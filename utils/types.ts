export interface MediaItem {
  id: string;
  url: string;
  thumbnailUrl: string;
  caption: string;
  timestamp: string;
  isFavorite: boolean;
}

export interface MediaUpload {
  uri: string;
  caption?: string;
  timestamp: string;
  encrypted?: boolean;
}

export interface VaultConfig {
  username: string;
  partnerUsername: string;
  encryptionKey: string;
}