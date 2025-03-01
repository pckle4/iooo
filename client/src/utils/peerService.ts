import { Peer, DataConnection } from 'peerjs';
import { v4 as uuidv4 } from 'uuid';
import { User, PeerConnection, FileTransfer } from '../types';

const CHUNK_SIZE = 512 * 1024; // 512KB chunks for optimal speed
const PRODUCTION_CONFIG = {
  host: 'p2p-transfer.repl.co', // This will be your Replit deployment URL
  secure: true,
  port: 443,
  path: '/peerjs', // Custom path to avoid conflicts
  debug: 1
};

class PeerService {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private fileTransferListeners: ((transfer: FileTransfer) => void)[] = [];
  private connectionListeners: ((peerId: string, username: string, connected: boolean, reason?: string) => void)[] = [];
  private peersUpdateListeners: ((peers: PeerConnection[]) => void)[] = [];
  private errorListeners: ((error: Error) => void)[] = [];
  private reconnectAttempts: Map<string, number> = new Map();
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private reconnectTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private connectionStates: Map<string, { isConnecting: boolean; lastError?: string }> = new Map();
  private fileData: Map<string, ArrayBuffer> = new Map(); // Store received file data

  private getPeerConfig() {
    const commonConfig = {
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
          { urls: 'stun:openrelay.metered.ca:80' },
          { urls: 'stun:stun.stunprotocol.org:3478' }
        ],
        iceCandidatePoolSize: 10,
        iceTransportPolicy: 'all',
        sdpSemantics: 'unified-plan'
      },
      debug: process.env.NODE_ENV === 'production' ? 1 : 3,
      retryTimer: 2000,
      pingInterval: 5000,
    };

    return process.env.NODE_ENV === 'production'
      ? { ...commonConfig, ...PRODUCTION_CONFIG }
      : commonConfig;
  }

  async initialize(): Promise<User> {
    return new Promise((resolve, reject) => {
      try {
        const username = this.generateUsername();
        this.peer = new Peer(uuidv4(), this.getPeerConfig());

        this.peer.on('open', (id) => {
          resolve({ id, username });
          this.setupNotifications();
          this.startHeartbeat();
          this.monitorNetworkStatus();
          this.setupAutoReconnect();
        });

        this.peer.on('connection', this.handleConnection.bind(this));
        this.peer.on('error', this.handlePeerError.bind(this));
        this.peer.on('disconnected', this.handleDisconnection.bind(this));
        this.peer.on('close', this.handleClose.bind(this));
      } catch (error) {
        reject(error);
      }
    });
  }

  private setupAutoReconnect() {
    if (this.peer) {
      this.peer.on('disconnected', () => {
        console.log('Peer disconnected, attempting reconnection...');
        setTimeout(() => {
          if (this.peer) {
            this.peer.reconnect();
          }
        }, 1000);
      });
    }
  }

  private handleDisconnection() {
    console.log('Disconnected from signaling server, attempting to reconnect...');
    this.reconnectToPeerServer();
  }

  private handleClose() {
    console.log('Peer connection closed, cleaning up...');
    this.connections.forEach((conn, peerId) => {
      this.notifyConnectionStatus(peerId, 'Unknown', false, 'Peer connection closed');
    });
    this.connections.clear();
  }

  private monitorNetworkStatus() {
    window.addEventListener('online', () => {
      console.log('Network is back online, reconnecting to peers...');
      this.reconnectAllPeers();
    });

    window.addEventListener('offline', () => {
      console.log('Network is offline, marking all connections as disconnected');
      this.handleNetworkOffline();
    });
  }

  private handleNetworkOffline() {
    this.connections.forEach((_, peerId) => {
      this.notifyConnectionStatus(peerId, 'Unknown', false, 'Network is offline');
    });
  }

  private async reconnectToPeerServer() {
    try {
      if (!this.peer) {
        console.log('Creating new peer connection...');
        await this.initialize();
      } else {
        console.log('Reconnecting existing peer...');
        await this.peer.reconnect();
      }
      this.reconnectAllPeers();
    } catch (error) {
      console.error('Failed to reconnect to peer server:', error);
      setTimeout(() => this.reconnectToPeerServer(), 2000);
    }
  }

  private async reconnectAllPeers() {
    const peerIds = Array.from(this.connections.keys());
    for (const peerId of peerIds) {
      if (!this.connectionStates.get(peerId)?.isConnecting) {
        await this.tryReconnect(peerId);
      }
    }
  }

  private startHeartbeat() {
    setInterval(() => {
      this.connections.forEach((conn, peerId) => {
        if (conn.open) {
          const startTime = Date.now();
          conn.send({
            type: 'heartbeat',
            timestamp: startTime,
          });

          // Set a timeout for heartbeat response
          setTimeout(() => {
            if (this.connections.has(peerId) && this.connectionStates.get(peerId)?.lastError !== 'heartbeat-timeout') {
              this.handleConnectionTimeout(peerId);
            }
          }, 5000);
        }
      });
    }, 10000);
  }

  private handleConnectionTimeout(peerId: string) {
    const state = this.connectionStates.get(peerId);
    if (state) {
      state.lastError = 'heartbeat-timeout';
      this.connectionStates.set(peerId, state);
    }
    this.notifyConnectionStatus(peerId, 'Unknown', false, 'Connection timeout');
    this.tryReconnect(peerId);
  }

  private handlePeerError(error: Error) {
    console.error('Peer error:', error);
    this.notifyError(error);

    if (error.message.includes('Could not connect to peer')) {
      this.reconnectToPeerServer();
    } else if (error.message.includes('ICE connection failed')) {
      this.reconnectAllPeers();
    } else if (error.message.includes('Lost connection to server')) {
      setTimeout(() => this.reconnectToPeerServer(), 1000);
    }
  }

  private setupNotifications() {
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
  }

  private showNotification(title: string, body: string) {
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
      new Notification(title, { body });
    }
  }

  async disconnect(peerId: string) {
    const conn = this.connections.get(peerId);
    if (conn) {
      conn.send({ type: 'disconnect', reason: 'User initiated disconnect' });
      conn.close();
      this.connections.delete(peerId);
      this.notifyConnectionStatus(peerId, 'Unknown', false, 'Disconnected by user');
      this.updatePeersList();
    }
  }

  private async tryReconnect(peerId: string) {
    // Clear any existing reconnection timeout
    const existingTimeout = this.reconnectTimeouts.get(peerId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.reconnectTimeouts.delete(peerId);
    }

    const state = this.connectionStates.get(peerId) || { isConnecting: false };
    if (state.isConnecting) return;

    const attempts = this.reconnectAttempts.get(peerId) || 0;
    if (attempts >= this.MAX_RECONNECT_ATTEMPTS) {
      this.notifyConnectionStatus(peerId, 'Unknown', false, 'Max reconnection attempts reached');
      return;
    }

    state.isConnecting = true;
    this.connectionStates.set(peerId, state);
    this.reconnectAttempts.set(peerId, attempts + 1);

    try {
      console.log(`Attempting to reconnect to peer ${peerId}, attempt ${attempts + 1}/${this.MAX_RECONNECT_ATTEMPTS}`);
      await this.connect(peerId);

      // Reset reconnection state on successful connection
      this.reconnectAttempts.delete(peerId);
      state.isConnecting = false;
      state.lastError = undefined;
      this.connectionStates.set(peerId, state);
    } catch (error) {
      console.error(`Reconnection attempt ${attempts + 1} failed:`, error);
      state.isConnecting = false;
      state.lastError = error.message;
      this.connectionStates.set(peerId, state);

      // Schedule next reconnection attempt with exponential backoff
      const timeout = setTimeout(
        () => this.tryReconnect(peerId),
        Math.min(1000 * Math.pow(2, attempts), 30000) // Cap at 30 seconds
      );
      this.reconnectTimeouts.set(peerId, timeout);
    }
  }

  private generateUsername(): string {
    const adjectives = ['Swift', 'Quick', 'Rapid', 'Fast', 'Sonic', 'Speedy', 'Lightning'];
    const nouns = ['Eagle', 'Falcon', 'Hawk', 'Phoenix', 'Dragon', 'Tiger', 'Wolf'];
    const number = Math.floor(Math.random() * 1000);
    return `${adjectives[Math.floor(Math.random() * adjectives.length)]}${
      nouns[Math.floor(Math.random() * nouns.length)]
    }${number}`;
  }

  async sendFile(file: File, peerId: string): Promise<void> {
    const conn = this.connections.get(peerId);
    if (!conn) throw new Error('No connection to peer');

    const fileId = await this.generateFileId();
    const fileHash = await this.calculateHash(await file.arrayBuffer());

    const transfer: FileTransfer = {
      id: fileId,
      filename: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      lastModified: new Date(file.lastModified),
      status: 'transferring',
      progress: 0,
      speed: 0,
      remainingTime: 0,
      chunks: {
        total: Math.ceil(file.size / CHUNK_SIZE),
        transferred: 0,
      },
      hash: fileHash,
    };

    // Store transfer in localStorage
    localStorage.setItem(`transfer_${fileId}`, JSON.stringify(transfer));

    // Send file metadata with hash
    conn.send({
      type: 'file-start',
      transfer,
    });

    // Read and send file in chunks
    const reader = new FileReader();
    let offset = 0;
    let lastUpdate = Date.now();
    let bytesTransferred = 0;

    const readNextChunk = () => {
      if (offset >= file.size) {
        conn.send({ type: 'file-end', fileId, hash: fileHash });
        return;
      }

      const chunk = file.slice(offset, offset + CHUNK_SIZE);
      reader.readAsArrayBuffer(chunk);
    };

    reader.onload = async (e) => {
      if (!e.target?.result) return;

      const chunkData = e.target.result as ArrayBuffer;
      const chunkHash = await this.calculateHash(chunkData);

      conn.send({
        type: 'file-chunk',
        fileId,
        data: chunkData,
        offset,
        hash: chunkHash,
      });

      offset += chunkData.byteLength;
      bytesTransferred += chunkData.byteLength;

      const now = Date.now();
      const timeDiff = (now - lastUpdate) / 1000;
      if (timeDiff >= 0.1) { // Update every 100ms
        const speed = bytesTransferred / timeDiff;
        const remainingBytes = file.size - offset;
        const remainingTime = remainingBytes / speed;

        const updatedTransfer = JSON.parse(localStorage.getItem(`transfer_${fileId}`) || '{}');
        updatedTransfer.progress = (offset / file.size) * 100;
        updatedTransfer.speed = speed;
        updatedTransfer.remainingTime = remainingTime;
        updatedTransfer.chunks.transferred = Math.ceil(offset / CHUNK_SIZE);

        localStorage.setItem(`transfer_${fileId}`, JSON.stringify(updatedTransfer));
        this.notifyFileTransfer(updatedTransfer);

        lastUpdate = now;
        bytesTransferred = 0;
      }

      readNextChunk();
    };

    readNextChunk();
  }

  private async generateFileId(): Promise<string> {
    const array = new Uint8Array(16);
    window.crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  private async calculateHash(data: ArrayBuffer): Promise<string> {
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async connect(remotePeerId: string): Promise<void> {
    if (!this.peer) throw new Error('Peer not initialized');

    const conn = this.peer.connect(remotePeerId, {
      reliable: true,
      serialization: 'binary',
    });

    return new Promise((resolve, reject) => {
      conn.on('open', () => {
        this.handleConnection(conn);
        resolve();
      });

      conn.on('error', (error) => {
        reject(error);
      });
    });
  }

  private handleConnection(conn: DataConnection) {
    this.connections.set(conn.peer, conn);

    conn.on('data', async (data: any) => {
      if (data.type === 'heartbeat') {
        conn.send({ type: 'heartbeat-ack', timestamp: data.timestamp });
      } else if (data.type === 'disconnect') {
        this.notifyConnectionStatus(conn.peer, 'Unknown', false, data.reason);
        conn.close();
      } else if (data.type === 'file-start') {
        this.handleFileStart(data.transfer);
        this.showNotification('New File Transfer', `Receiving: ${data.transfer.filename}`);
      } else if (data.type === 'file-chunk') {
        await this.handleFileChunk(data.fileId, data.data, data.hash);
      } else if (data.type === 'file-end') {
        await this.handleFileEnd(data.fileId, data.hash);
        this.showNotification('File Received', `${data.filename} has been received`);
      }
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      this.notifyConnectionStatus(conn.peer, 'Unknown', false, 'Connection closed');
      this.tryReconnect(conn.peer);
      this.updatePeersList();
    });

    conn.on('error', (error) => {
      console.error('Connection error:', error);
      this.notifyError(error);
      this.notifyConnectionStatus(conn.peer, 'Unknown', false, error.message);
    });

    this.notifyConnectionStatus(conn.peer, 'Unknown', true);
    this.updatePeersList();
  }

  private async handleFileStart(transfer: FileTransfer) {
    localStorage.setItem(`transfer_${transfer.id}`, JSON.stringify(transfer));
    this.notifyFileTransfer(transfer);
  }

  private async handleFileChunk(fileId: string, chunk: ArrayBuffer, chunkHash: string) {
    const calculatedHash = await this.calculateHash(chunk);
    if (calculatedHash !== chunkHash) {
      throw new Error('Chunk integrity check failed');
    }

    const transferStr = localStorage.getItem(`transfer_${fileId}`);
    if (!transferStr) return;

    const transfer: FileTransfer = JSON.parse(transferStr);

    // Store the chunk data
    const existingData = this.fileData.get(fileId) || new ArrayBuffer(0);
    const newData = new Uint8Array(existingData.byteLength + chunk.byteLength);
    newData.set(new Uint8Array(existingData), 0);
    newData.set(new Uint8Array(chunk), existingData.byteLength);
    this.fileData.set(fileId, newData.buffer);

    transfer.chunks.transferred++;
    transfer.progress = (transfer.chunks.transferred / transfer.chunks.total) * 100;

    localStorage.setItem(`transfer_${fileId}`, JSON.stringify(transfer));
    this.notifyFileTransfer(transfer);
  }

  private async handleFileEnd(fileId: string, fileHash: string) {
    const transferStr = localStorage.getItem(`transfer_${fileId}`);
    if (!transferStr) return;

    const transfer: FileTransfer = JSON.parse(transferStr);

    // Verify file integrity
    if (transfer.hash !== fileHash) {
      transfer.status = 'error';
      transfer.error = 'File integrity check failed';
    } else {
      transfer.status = 'completed';
      transfer.progress = 100;
    }

    localStorage.setItem(`transfer_${fileId}`, JSON.stringify(transfer));
    this.notifyFileTransfer(transfer);
  }

  onFileTransfer(callback: (transfer: FileTransfer) => void) {
    this.fileTransferListeners.push(callback);
  }

  private notifyFileTransfer(transfer: FileTransfer) {
    this.fileTransferListeners.forEach((listener) => listener(transfer));
  }

  private updatePeersList() {
    const peers: PeerConnection[] = Array.from(this.connections.entries()).map(([id, conn]) => ({
      id,
      username: `Peer-${id.slice(0, 4)}`,
      connectionStatus: conn.open ? 'connected' : 'disconnected',
      connectedAt: new Date(),
      dataChannelState: conn.dataChannel?.readyState as 'open' | 'closing' | 'closed' | undefined,
    }));

    this.peersUpdateListeners.forEach((listener) => listener(peers));
  }

  onConnection(callback: (peerId: string, username: string, connected: boolean, reason?: string) => void) {
    this.connectionListeners.push(callback);
  }

  onPeersUpdate(callback: (peers: PeerConnection[]) => void) {
    this.peersUpdateListeners.push(callback);
  }

  onError(callback: (error: Error) => void) {
    this.errorListeners.push(callback);
  }

  private notifyConnectionStatus(peerId: string, username: string, connected: boolean, reason?: string) {
    this.connectionListeners.forEach((listener) => listener(peerId, username, connected, reason));
  }

  private notifyError(error: Error) {
    this.errorListeners.forEach((listener) => listener(error));
  }

  closeConnections() {
    this.connections.forEach((conn) => conn.close());
    this.peer?.disconnect();
    this.peer = null;
  }

  async downloadFile(fileId: string): Promise<void> {
    const transferStr = localStorage.getItem(`transfer_${fileId}`);
    if (!transferStr) throw new Error('File not found');

    const transfer: FileTransfer = JSON.parse(transferStr);
    const fileData = this.fileData.get(fileId);
    if (!fileData) throw new Error('File data not found');

    const blob = new Blob([fileData], { type: transfer.type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = transfer.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  removeFile(fileId: string): void {
    localStorage.removeItem(`transfer_${fileId}`);
    this.fileData.delete(fileId);
    this.notifyFileTransfer({ id: fileId, status: 'removed' } as FileTransfer);
  }
}

export default new PeerService();