export interface User {
  id: string;
  username: string;
}

export interface PeerConnection {
  id: string;
  username: string;
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
  connectedAt?: Date;
  dataChannelState?: 'open' | 'closing' | 'closed';
}

export interface FileTransfer {
  id: string;
  filename: string;
  size: number;
  progress: number;
  status: 'pending' | 'transferring' | 'completed' | 'error';
  error?: string;
  type: string;
  lastModified: Date;
  speed: number;
  remainingTime: number;
  chunks: {
    total: number;
    transferred: number;
  };
  hash: string;
}