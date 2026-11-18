import Peer, { type DataConnection, type MediaConnection } from 'peerjs';
import type { SyncMessage } from '../types';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

class PeerService {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private peerUserNames: Map<string, string> = new Map();
  private mediaConnections: Map<string, MediaConnection> = new Map();
  private myPeerId: string = '';
  private onMessageCallback: ((msg: SyncMessage) => void) | null = null;
  private onStateChangeCallback: ((state: ConnectionState, peerCount: number) => void) | null = null;
  private onPeerJoinedCallback: ((peerId: string, peerName?: string) => void) | null = null;
  private onPeerLeftCallback: ((peerId: string, peerName: string, wasHost: boolean) => void) | null = null;
  private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;
  private isHost: boolean = false;
  private localStream: MediaStream | null = null;
  private pingInterval: number | null = null;
  private userName: string = '';

  public init(
    roomId: string,
    userName: string,
    isHost: boolean,
    onMessage: (msg: SyncMessage) => void,
    onStateChange: (state: ConnectionState, peerCount: number) => void,
    onPeerJoined?: (peerId: string, peerName?: string) => void,
    onPeerLeft?: (peerId: string, peerName: string, wasHost: boolean) => void,
    onRemoteStream?: (stream: MediaStream) => void
  ) {
    this.cleanup();
    this.isHost = isHost;
    this.userName = userName;
    this.onMessageCallback = onMessage;
    this.onStateChangeCallback = onStateChange;
    if (onPeerJoined) this.onPeerJoinedCallback = onPeerJoined;
    if (onPeerLeft) this.onPeerLeftCallback = onPeerLeft;
    if (onRemoteStream) this.onRemoteStreamCallback = onRemoteStream;

    onStateChange('connecting', 0);

    const cleanRoom = roomId.toLowerCase().trim();
    const hostPeerId = `cineparty-${cleanRoom}-host`;
    const clientPeerId = isHost
      ? hostPeerId
      : `cineparty-${cleanRoom}-${Math.random().toString(36).substring(2, 7)}`;

    console.log(`[PeerJS] Initializing as ${isHost ? 'HOST' : 'GUEST'} with target ID: ${clientPeerId}`);

    try {
      this.peer = new Peer(clientPeerId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
          ],
        },
      });

      this.peer.on('open', (id) => {
        this.myPeerId = id;
        console.log(`[PeerJS] Connected to signaling with ID: ${id}`);

        if (isHost) {
          this.onStateChangeCallback?.('connected', this.connections.size);
        } else {
          this.connectToHost(hostPeerId, userName);
        }

        this.startHeartbeat();
      });

      // Handle incoming data connections
      this.peer.on('connection', (conn) => {
        console.log(`[PeerJS] Incoming connection from ${conn.peer}`);
        this.setupConnection(conn);
      });

      // Handle incoming media call
      this.peer.on('call', (call) => {
        if (this.localStream) {
          call.answer(this.localStream);
        } else {
          call.answer();
        }

        call.on('stream', (remoteStream) => {
          this.onRemoteStreamCallback?.(remoteStream);
        });

        this.mediaConnections.set(call.peer, call);
      });

      this.peer.on('error', (err) => {
        console.warn('[PeerJS] Peer error:', err.type, err.message);

        // If host ID was already taken, fall back automatically to joining as guest
        if (err.type === 'unavailable-id' && this.isHost) {
          console.warn('[PeerJS] Host ID taken, switching to guest mode');
          this.isHost = false;
          this.init(roomId, userName, false, onMessage, onStateChange, onPeerJoined, onPeerLeft, onRemoteStream);
          return;
        }

        // If peer-unavailable when guest tries to connect to host, retry
        if (err.type === 'peer-unavailable' && !this.isHost) {
          console.log('[PeerJS] Host peer not yet registered, retrying in 2 seconds...');
          setTimeout(() => {
            if (this.peer && !this.connections.has(hostPeerId)) {
              this.connectToHost(hostPeerId, userName);
            }
          }, 2000);
          return;
        }

        this.onStateChangeCallback?.(this.connections.size > 0 ? 'connected' : 'error', this.connections.size);
      });

      this.peer.on('close', () => {
        this.onStateChangeCallback?.('disconnected', 0);
      });

      // Handle window closing gracefully
      window.addEventListener('beforeunload', this.handleBeforeUnload);
    } catch (e) {
      console.error('[PeerJS] Init failed:', e);
      this.onStateChangeCallback?.('error', 0);
    }
  }

  private handleBeforeUnload = () => {
    this.broadcast({
      type: 'USER_LEFT',
      senderId: this.myPeerId,
      senderName: this.userName,
      timestamp: Date.now(),
      payload: {},
    });
  };

  private connectToHost(hostPeerId: string, userName: string) {
    if (!this.peer) return;
    console.log(`[PeerJS] Connecting to host: ${hostPeerId}`);
    const conn = this.peer.connect(hostPeerId, {
      reliable: true,
      metadata: { userName },
    });
    this.setupConnection(conn);
  }

  private setupConnection(conn: DataConnection) {
    const handleOpened = () => {
      console.log(`[PeerJS] Data channel opened with ${conn.peer}`);
      this.connections.set(conn.peer, conn);

      const peerName = (conn.metadata?.userName as string) || 'Friend';
      this.peerUserNames.set(conn.peer, peerName);

      this.onStateChangeCallback?.('connected', this.connections.size);
      this.onPeerJoinedCallback?.(conn.peer, peerName);

      // If active desktop media stream, call the new peer
      if (this.localStream && this.peer) {
        const call = this.peer.call(conn.peer, this.localStream);
        call.on('stream', (stream) => {
          this.onRemoteStreamCallback?.(stream);
        });
        this.mediaConnections.set(conn.peer, call);
      }
    };

    if (conn.open) {
      handleOpened();
    } else {
      conn.on('open', handleOpened);
    }

    conn.on('data', (data: any) => {
      try {
        const msg = data as SyncMessage;
        if (msg.type === 'SYNC_PING') {
          return; // Ignore internal ping
        }

        this.onMessageCallback?.(msg);

        // If host receives message from guest, forward to other peers
        if (this.isHost) {
          this.broadcast(msg, conn.peer);
        }
      } catch (e) {
        console.error('Failed to parse peer message:', e);
      }
    });

    conn.on('close', () => {
      const wasHost = conn.peer.endsWith('-host');
      const peerName = this.peerUserNames.get(conn.peer) || 'A participant';

      console.log(`[PeerJS] Connection closed with ${conn.peer} (${peerName})`);
      this.connections.delete(conn.peer);
      this.peerUserNames.delete(conn.peer);

      this.onPeerLeftCallback?.(conn.peer, peerName, wasHost);

      this.onStateChangeCallback?.(
        this.connections.size > 0 ? 'connected' : this.isHost ? 'connected' : 'disconnected',
        this.connections.size
      );
    });

    conn.on('error', (err) => {
      console.warn(`[PeerJS] Connection error with ${conn.peer}:`, err);
      this.connections.delete(conn.peer);
    });
  }

  public broadcast(message: SyncMessage, excludePeerId?: string) {
    this.connections.forEach((conn, peerId) => {
      if (peerId !== excludePeerId) {
        try {
          conn.send(message);
        } catch (e) {
          console.warn(`[PeerJS] Send error to ${peerId}:`, e);
        }
      }
    });
  }

  public sendToPeer(peerId: string, message: SyncMessage) {
    const conn = this.connections.get(peerId);
    if (conn) {
      try {
        conn.send(message);
      } catch (e) {
        console.warn(`[PeerJS] Direct send error to ${peerId}:`, e);
      }
    }
  }

  private startHeartbeat() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = window.setInterval(() => {
      this.broadcast({
        type: 'SYNC_PING',
        senderId: this.myPeerId,
        senderName: 'heartbeat',
        timestamp: Date.now(),
        payload: {},
      });
    }, 15000);
  }

  public startLocalMedia(video: boolean, audio: boolean): Promise<MediaStream | null> {
    return navigator.mediaDevices
      .getUserMedia({ video, audio })
      .then((stream) => {
        this.localStream = stream;
        this.connections.forEach((_conn, peerId) => {
          if (this.peer) {
            const call = this.peer.call(peerId, stream);
            call.on('stream', (remoteStream) => {
              this.onRemoteStreamCallback?.(remoteStream);
            });
            this.mediaConnections.set(peerId, call);
          }
        });
        return stream;
      })
      .catch((err) => {
        console.warn('Failed to get media devices:', err);
        return null;
      });
  }

  public stopLocalMedia() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    this.mediaConnections.forEach((call) => call.close());
    this.mediaConnections.clear();
  }

  public getPeerId(): string {
    return this.myPeerId;
  }

  public setIsHost(isHost: boolean) {
    this.isHost = isHost;
  }

  public cleanup() {
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    this.stopLocalMedia();
    this.connections.forEach((conn) => conn.close());
    this.connections.clear();
    this.peerUserNames.clear();
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }
}

export const peerService = new PeerService();
