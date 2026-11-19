// WebTorrent Browser P2P Streaming Service
// Streams movies directly in-browser using WebRTC DataChannels with 100% native <video> control

declare global {
  interface Window {
    WebTorrent?: any;
  }
}

export interface TorrentStatus {
  name: string;
  progress: number; // 0 - 1
  downloadSpeed: number; // bytes/sec
  uploadSpeed: number; // bytes/sec
  numPeers: number;
  timeRemaining: number;
  isReady: boolean;
  error?: string;
}

class WebTorrentService {
  private client: any = null;
  private currentTorrent: any = null;
  private scriptLoadingPromise: Promise<void> | null = null;

  public async loadScript(): Promise<void> {
    if (window.WebTorrent) {
      return;
    }
    if (this.scriptLoadingPromise) {
      return this.scriptLoadingPromise;
    }

    this.scriptLoadingPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/webtorrent@latest/webtorrent.min.js';
      script.async = true;
      script.onload = () => {
        resolve();
      };
      script.onerror = () => {
        this.scriptLoadingPromise = null;
        reject(new Error('Failed to load WebTorrent engine from CDN'));
      };
      document.head.appendChild(script);
    });

    return this.scriptLoadingPromise;
  }

  public getClient(): any {
    if (!this.client && window.WebTorrent) {
      this.client = new window.WebTorrent({
        tracker: {
          rtcConfig: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:global.stun.twilio.com:3478' },
            ],
          },
        },
      });
    }
    return this.client;
  }

  // Stream torrent directly into HTML5 video element
  public async streamTorrent(
    torrentId: string,
    videoElement: HTMLVideoElement,
    onStatusUpdate?: (status: TorrentStatus) => void
  ): Promise<any> {
    await this.loadScript();
    const client = this.getClient();
    if (!client) throw new Error('WebTorrent engine is initializing...');

    // Clean up previous torrent if active
    if (this.currentTorrent) {
      try {
        this.currentTorrent.destroy();
      } catch (e) {}
      this.currentTorrent = null;
    }

    // Standard public WebRTC trackers for browser-to-browser P2P swarming
    const trackers = [
      'wss://tracker.openwebtorrent.com',
      'wss://tracker.webtorrent.dev',
      'wss://tracker.files.fm:7073/announce',
      'wss://tracker.btorrent.xyz',
    ];

    return new Promise((resolve, reject) => {
      // Check if already registered
      try {
        const existing = client.get(torrentId);
        if (existing) {
          existing.destroy();
        }
      } catch (e) {}

      client.add(
        torrentId,
        { announce: trackers },
        (torrent: any) => {
          this.currentTorrent = torrent;

          // Find video file
          const file =
            torrent.files.find((f: any) => {
              const ext = f.name.toLowerCase();
              return (
                ext.endsWith('.mp4') ||
                ext.endsWith('.mkv') ||
                ext.endsWith('.webm') ||
                ext.endsWith('.avi') ||
                ext.endsWith('.mov')
              );
            }) || torrent.files[0];

          if (!file) {
            reject(new Error('No video file found in this torrent.'));
            return;
          }

          // Render stream directly into CineParty's native <video> element
          file.renderTo(videoElement, { autoplay: false }, (err: any) => {
            if (err) {
              console.warn('[WebTorrent] renderTo notice:', err);
            }
          });

          // Send initial status
          onStatusUpdate?.({
            name: file.name,
            progress: torrent.progress,
            downloadSpeed: torrent.downloadSpeed,
            uploadSpeed: torrent.uploadSpeed,
            numPeers: torrent.numPeers,
            timeRemaining: torrent.timeRemaining,
            isReady: true,
          });

          // Interval progress updates
          const interval = setInterval(() => {
            if (!this.currentTorrent || this.currentTorrent.destroyed) {
              clearInterval(interval);
              return;
            }
            onStatusUpdate?.({
              name: file.name,
              progress: torrent.progress,
              downloadSpeed: torrent.downloadSpeed,
              uploadSpeed: torrent.uploadSpeed,
              numPeers: torrent.numPeers,
              timeRemaining: torrent.timeRemaining,
              isReady: true,
            });
          }, 1000);

          torrent.on('error', (err: any) => {
            onStatusUpdate?.({
              name: file?.name || 'Torrent',
              progress: torrent.progress,
              downloadSpeed: 0,
              uploadSpeed: 0,
              numPeers: torrent.numPeers,
              timeRemaining: 0,
              isReady: false,
              error: err?.message || 'Torrent download error',
            });
          });

          resolve(torrent);
        }
      );
    });
  }

  public stopCurrentTorrent() {
    if (this.currentTorrent) {
      try {
        this.currentTorrent.destroy();
      } catch (e) {}
      this.currentTorrent = null;
    }
  }
}

export const webTorrentService = new WebTorrentService();
