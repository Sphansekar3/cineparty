import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { VideoPlayer } from './components/VideoPlayer';
import { SyncController } from './components/SyncController';
import { Chat } from './components/Chat';
import { MovieCatalog } from './components/MovieCatalog';
import { DesktopVideoChat } from './components/DesktopVideoChat';
import { RoomModal } from './components/RoomModal';
import { Lobby } from './components/Lobby';
import { ContentSelectorModal } from './components/ContentSelectorModal';
import type { Movie, ChatMessage, SyncMessage } from './types';
import { CURATED_MOVIES } from './services/tmdbService';
import { peerService, type ConnectionState } from './services/peerService';
import { generateRoomId, playNotificationTone } from './utils/helpers';
import { MessageSquare, Film, Share2, Info } from 'lucide-react';

// Extract query params safely before component state runs
const initialParams = new URLSearchParams(window.location.search);
const initialRoomParam = initialParams.get('room');

export const App: React.FC = () => {
  // Always start in the Lobby so the user can enter/confirm their display name (invited room is prefilled if present)
  const [isLobby, setIsLobby] = useState<boolean>(true);
  const [roomId, setRoomId] = useState<string>(initialRoomParam || '');
  const [isHost, setIsHost] = useState<boolean>(!initialRoomParam);

  const [userName, setUserName] = useState<string>(() => {
    const saved = localStorage.getItem('cineparty_username');
    if (saved) return saved;
    const names = ['Alex', 'Sam', 'Jordan', 'Taylor', 'Casey', 'Riley'];
    const assigned = `${names[Math.floor(Math.random() * names.length)]}_${Math.floor(10 + Math.random() * 90)}`;
    localStorage.setItem('cineparty_username', assigned);
    return assigned;
  });

  const handleUpdateUserName = (newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const clean = trimmed.substring(0, 24);
    setUserName(clean);
    localStorage.setItem('cineparty_username', clean);
  };

  // Modals for creation and invite
  const [isContentSelectorOpen, setIsContentSelectorOpen] = useState<boolean>(false);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState<boolean>(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState<boolean>(false);

  // Connection & Room state
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [peerCount, setPeerCount] = useState<number>(0);
  const [isHostLocked, setIsHostLocked] = useState<boolean>(false);
  const [activeServerId, setActiveServerId] = useState<string>('vidsrc-cc');

  // Media & Sync state
  const [currentMovie, setCurrentMovie] = useState<Movie | null>(CURATED_MOVIES[0]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);

  // Drift & Buffering states
  const [drift, setDrift] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [bufferingPeer, setBufferingPeer] = useState<{ id: string; name: string } | null>(null);
  const [bufferTimeoutSeconds, setBufferTimeoutSeconds] = useState<number>(60);
  const bufferCountdownRef = useRef<number | null>(null);
  const wasPlayingBeforeBuffer = useRef<boolean>(false);

  // Up-to-date references for callbacks
  const currentMovieRef = useRef(currentMovie);
  currentMovieRef.current = currentMovie;
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const isHostLockedRef = useRef(isHostLocked);
  isHostLockedRef.current = isHostLocked;
  const activeServerIdRef = useRef(activeServerId);
  activeServerIdRef.current = activeServerId;
  const isHostRef = useRef(isHost);
  isHostRef.current = isHost;

  // Communication & Media
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'sys-welcome',
      senderId: 'system',
      senderName: 'System',
      text: `Welcome to CineParty room! Share the invite link with your friend to watch together for free.`,
      timestamp: Date.now(),
      isSystem: true,
    },
  ]);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // Mobile navigation tabs (< 768px)
  const [mobileTab, setMobileTab] = useState<'chat' | 'catalog' | 'info'>('chat');

  // Master Clock ticker for synchronized timestamp
  useEffect(() => {
    let timer: number | null = null;
    if (!isLobby && isPlaying && countdown === null && !bufferingPeer) {
      timer = window.setInterval(() => {
        setCurrentTime((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isLobby, isPlaying, countdown, bufferingPeer]);

  // Host periodic heartbeat sync pulse (every 5 seconds)
  useEffect(() => {
    let pulseInterval: number | null = null;
    if (!isLobby && isHost && roomId) {
      pulseInterval = window.setInterval(() => {
        if (!bufferingPeer) {
          peerService.broadcast({
            type: 'SYNC_PULSE',
            senderId: peerService.getPeerId() || userName,
            senderName: userName,
            timestamp: Date.now(),
            payload: {
              hostTime: currentTimeRef.current,
              isPlaying: isPlayingRef.current,
            },
          });
        }
      }, 5000);
    }
    return () => {
      if (pulseInterval) clearInterval(pulseInterval);
    };
  }, [isLobby, isHost, roomId, userName, bufferingPeer]);

  // WebRTC PeerJS Connection setup (only when active in a room)
  useEffect(() => {
    if (isLobby || !roomId) return;

    peerService.init(
      roomId,
      userName,
      isHost,
      // 1. On incoming sync message
      (msg: SyncMessage) => {
        handleIncomingMessage(msg);
      },
      // 2. On connection state change
      (state, count) => {
        setConnectionState(state);
        setPeerCount(count);
      },
      // 3. On new peer joined (Host sends current room state to newly joined guest)
      (peerId: string) => {
        if (isHostRef.current) {
          console.log(`[Host] Sending initial room state to peer: ${peerId}`);
          peerService.sendToPeer(peerId, {
            type: 'ROOM_STATE',
            senderId: peerService.getPeerId() || userName,
            senderName: userName,
            timestamp: Date.now(),
            payload: {
              movie: currentMovieRef.current,
              currentTime: currentTimeRef.current,
              isPlaying: isPlayingRef.current,
              isHostLocked: isHostLockedRef.current,
              activeServerId: activeServerIdRef.current,
            },
          });
          addSystemNotice(`A friend connected to the room! 🎉`);
        }
      },
      // 4. On peer left
      (peerId: string, peerName: string, wasHost: boolean) => {
        addSystemNotice(`${peerName} left the room.`);

        // Clear buffer lock if this peer was buffering
        setBufferingPeer((current) => {
          if (current && current.id === peerId) {
            clearBufferCountdown();
            if (wasPlayingBeforeBuffer.current) {
              setIsPlaying(true);
            }
            return null;
          }
          return current;
        });

        // Host migration
        if (wasHost && !isHostRef.current) {
          console.log('[Failover] Host disconnected. Promoting self to active room host.');
          setIsHost(true);
          peerService.setIsHost(true);
          addSystemNotice(`Host disconnected. You are now the room host! Video continuing.`);
        }
      },
      // 5. Remote stream
      (stream) => {
        setRemoteStream(stream);
      }
    );

    return () => {
      clearBufferCountdown();
      peerService.cleanup();
    };
  }, [isLobby, roomId, userName, isHost]);

  // Buffer timer cleanup
  const clearBufferCountdown = () => {
    if (bufferCountdownRef.current) {
      clearInterval(bufferCountdownRef.current);
      bufferCountdownRef.current = null;
    }
  };

  // Start 60-second failsafe buffer countdown
  const startBufferTimeoutCountdown = (peerName: string) => {
    clearBufferCountdown();
    setBufferTimeoutSeconds(60);

    let secondsLeft = 60;
    bufferCountdownRef.current = window.setInterval(() => {
      secondsLeft -= 1;
      setBufferTimeoutSeconds(secondsLeft);

      if (secondsLeft <= 0) {
        clearBufferCountdown();
        setBufferingPeer(null);
        if (wasPlayingBeforeBuffer.current) {
          setIsPlaying(true);
        }
        addSystemNotice(`${peerName}'s buffer timed out after 60s. Auto-resuming playback!`);
      }
    }, 1000);
  };

  // Incoming sync message router
  const handleIncomingMessage = (msg: SyncMessage) => {
    console.log('[Sync] Received action:', msg.type, msg.payload);

    switch (msg.type) {
      case 'ROOM_STATE':
        if (msg.payload.movie) setCurrentMovie(msg.payload.movie);
        if (msg.payload.currentTime !== undefined) setCurrentTime(msg.payload.currentTime);
        if (msg.payload.isPlaying !== undefined) setIsPlaying(msg.payload.isPlaying);
        if (msg.payload.isHostLocked !== undefined) setIsHostLocked(msg.payload.isHostLocked);
        if (msg.payload.activeServerId) setActiveServerId(msg.payload.activeServerId);
        addSystemNotice(`Synchronized with room host (${msg.senderName})`);
        break;

      case 'MOVIE_CHANGE':
        setCurrentMovie(msg.payload.movie);
        setCurrentTime(0);
        setIsPlaying(false);
        addSystemNotice(`${msg.senderName} loaded "${msg.payload.movie.title}"`);
        break;

      case 'COUNTDOWN_START':
        triggerLocalCountdown(msg.senderName);
        break;

      case 'PLAY':
        setIsPlaying(true);
        break;

      case 'PAUSE':
        setIsPlaying(false);
        break;

      case 'SEEK':
        setCurrentTime(msg.payload.time);
        break;

      case 'SERVER_CHANGE':
        setActiveServerId(msg.payload.serverId);
        break;

      case 'HOST_LOCK_TOGGLE':
        setIsHostLocked(msg.payload.locked);
        addSystemNotice(
          msg.payload.locked
            ? `Host locked controls to host-only`
            : `Controls are now shared with everyone`
        );
        break;

      case 'CHAT_MESSAGE':
        setMessages((prev) => [...prev, msg.payload]);
        playNotificationTone('message');
        break;

      case 'BUFFERING_START':
        wasPlayingBeforeBuffer.current = isPlayingRef.current;
        setIsPlaying(false);
        setBufferingPeer({ id: msg.senderId, name: msg.senderName });
        startBufferTimeoutCountdown(msg.senderName);
        break;

      case 'BUFFERING_END':
        clearBufferCountdown();
        setBufferingPeer(null);
        if (wasPlayingBeforeBuffer.current) {
          setIsPlaying(true);
        }
        break;

      case 'SYNC_PULSE':
        if (!isHostRef.current && msg.payload.hostTime !== undefined) {
          const hostTime = msg.payload.hostTime;
          const myTime = currentTimeRef.current;
          const currentDiff = Math.abs(myTime - hostTime);
          setDrift(currentDiff);

          // Hard seek if drift exceeds 2.5s
          if (currentDiff > 2.5) {
            setCurrentTime(hostTime);
          } else if (currentDiff >= 0.8) {
            if (myTime < hostTime) {
              setPlaybackRate(1.05);
              setTimeout(() => setPlaybackRate(1.0), 3000);
            } else {
              setPlaybackRate(0.95);
              setTimeout(() => setPlaybackRate(1.0), 3000);
            }
          } else {
            setPlaybackRate(1.0);
          }
        }
        break;

      case 'USER_LEFT':
        addSystemNotice(`${msg.senderName} closed their tab.`);
        break;

      default:
        break;
    }
  };

  const addSystemNotice = (text: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `sys-${Date.now()}-${Math.random()}`,
        senderId: 'system',
        senderName: 'System',
        text,
        timestamp: Date.now(),
        isSystem: true,
      },
    ]);
  };

  const broadcastSync = (type: SyncMessage['type'], payload: any) => {
    const msg: SyncMessage = {
      type,
      senderId: peerService.getPeerId() || userName,
      senderName: userName,
      timestamp: Date.now(),
      payload,
    };
    peerService.broadcast(msg);
  };

  const triggerLocalCountdown = (triggererName: string) => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    setCountdown(3);
    playNotificationTone('countdown');

    let count = 3;
    countdownIntervalRef.current = window.setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdown(count);
        playNotificationTone('countdown');
      } else if (count === 0) {
        setCountdown(0);
        playNotificationTone('start');
        setIsPlaying(true);
      } else {
        clearInterval(countdownIntervalRef.current!);
        countdownIntervalRef.current = null;
        setCountdown(null);
      }
    }, 1000);

    addSystemNotice(`${triggererName} started sync countdown`);
  };

  // ONE UNIFIED Play/Pause Toggle Handler!
  const handleUnifiedPlayToggle = () => {
    if (isHostLocked && !isHost) return;

    if (isPlaying) {
      // Pause for everyone immediately
      setIsPlaying(false);
      broadcastSync('PAUSE', {});
    } else {
      // If embed mode, run 3s sync countdown so both viewers click play together
      if (currentMovie?.streamType === 'embed') {
        triggerLocalCountdown('You');
        broadcastSync('COUNTDOWN_START', {});
      } else {
        // YouTube & Direct streams: Instant synchronized Play!
        setIsPlaying(true);
        broadcastSync('PLAY', {});
      }
    }
  };

  const handleSeekRelative = (seconds: number) => {
    if (isHostLocked && !isHost) return;
    const next = Math.max(0, currentTime + seconds);
    setCurrentTime(next);
    broadcastSync('SEEK', { time: next });
  };

  const handleSelectMovie = (movie: Movie) => {
    if (isHostLocked && !isHost) return;
    setCurrentMovie(movie);
    setCurrentTime(0);
    setIsPlaying(false);
    broadcastSync('MOVIE_CHANGE', { movie });
    addSystemNotice(`You loaded "${movie.title}"`);
  };

  const handleSendMessage = (text: string) => {
    const newMsg: ChatMessage = {
      id: `chat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      senderId: peerService.getPeerId() || userName,
      senderName: userName,
      text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, newMsg]);
    broadcastSync('CHAT_MESSAGE', newMsg);
  };

  const handleToggleHostLock = () => {
    if (!isHost) return;
    const next = !isHostLocked;
    setIsHostLocked(next);
    broadcastSync('HOST_LOCK_TOGGLE', { locked: next });
    addSystemNotice(
      next
        ? `You locked playback controls to Host Only`
        : `You enabled Shared Collaborative Controls`
    );
  };

  const handleSelectServer = (serverId: string) => {
    setActiveServerId(serverId);
    broadcastSync('SERVER_CHANGE', { serverId });
  };

  const handleBufferingStart = () => {
    wasPlayingBeforeBuffer.current = isPlayingRef.current;
    setIsPlaying(false);
    broadcastSync('BUFFERING_START', {});
    setBufferingPeer({ id: peerService.getPeerId() || userName, name: 'You' });
    startBufferTimeoutCountdown('You');
  };

  const handleBufferingEnd = () => {
    clearBufferCountdown();
    setBufferingPeer(null);
    broadcastSync('BUFFERING_END', {});
    if (wasPlayingBeforeBuffer.current) {
      setIsPlaying(true);
    }
  };

  const handleForceResumeBuffer = () => {
    clearBufferCountdown();
    setBufferingPeer(null);
    if (wasPlayingBeforeBuffer.current) {
      setIsPlaying(true);
    }
    broadcastSync('BUFFERING_END', {});
  };

  // Lobby Flow Handlers
  const handleStartCreateFlow = () => {
    setIsContentSelectorOpen(true);
  };

  const handleFinishCreateFlow = (selectedMovie: Movie) => {
    const fresh = generateRoomId();
    setRoomId(fresh);
    window.history.replaceState(null, '', `?room=${fresh}`);
    setCurrentMovie(selectedMovie);
    setIsHost(true);
    setIsLobby(false);
    setIsContentSelectorOpen(false);
    setIsRoomModalOpen(true);
  };

  const handleJoinFromLobby = (targetRoomId: string) => {
    setRoomId(targetRoomId);
    window.history.replaceState(null, '', `?room=${targetRoomId}`);
    setIsHost(false);
    setIsLobby(false);
  };

  const canControl = !isHostLocked || isHost;

  // View 1: Lobby Screen
  if (isLobby) {
    return (
      <>
        <Lobby
          userName={userName}
          onUpdateUserName={handleUpdateUserName}
          onStartCreate={handleStartCreateFlow}
          onJoinRoom={handleJoinFromLobby}
          invitedRoomId={initialRoomParam || undefined}
        />
        <ContentSelectorModal
          isOpen={isContentSelectorOpen}
          onClose={() => setIsContentSelectorOpen(false)}
          onSelectMovie={handleFinishCreateFlow}
        />
      </>
    );
  }

  // View 2: Active Watch Party Cinema Theater
  return (
    <div className="min-h-screen bg-cinema-900 text-gray-100 flex flex-col">
      {/* Top Navigation */}
      <Navbar
        roomId={roomId}
        connectionState={connectionState}
        peerCount={peerCount}
        activeServerId={activeServerId}
        isHost={isHost}
        isHostLocked={isHostLocked}
        onToggleHostLock={handleToggleHostLock}
        onSelectServer={handleSelectServer}
        onOpenRoomModal={() => setIsRoomModalOpen(true)}
      />

      {/* Main Cinema Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-2 sm:p-4 md:p-6 flex flex-col md:grid md:grid-cols-12 gap-3 sm:gap-5">
        {/* Left Column (Desktop 8 cols) / Top Stack (Mobile): Video Cinema & Sync */}
        <div className="md:col-span-8 flex flex-col gap-2.5 sm:gap-3">
          {/* Pinned 16:9 Video Player */}
          <VideoPlayer
            movie={currentMovie}
            activeServerId={activeServerId}
            countdown={countdown}
            isPlaying={isPlaying}
            currentTime={currentTime}
            playbackRate={playbackRate}
            onNativePlay={() => {
              if (isHostLocked && !isHost) return;
              if (!isPlaying) {
                setIsPlaying(true);
                broadcastSync('PLAY', {});
              }
            }}
            onNativePause={() => {
              if (isHostLocked && !isHost) return;
              if (isPlaying) {
                setIsPlaying(false);
                broadcastSync('PAUSE', {});
              }
            }}
            onNativeSeek={(t) => {
              if (isHostLocked && !isHost) return;
              setCurrentTime(Math.floor(t));
              broadcastSync('SEEK', { time: Math.floor(t) });
            }}
            onBufferingStart={handleBufferingStart}
            onBufferingEnd={handleBufferingEnd}
            onSelectServer={handleSelectServer}
            onOpenMovieCatalog={() => setIsCatalogOpen(true)}
          />

          {/* Sync Controller Bar with ONE Unified Play/Pause Button */}
          <SyncController
            isPlaying={isPlaying}
            currentTime={currentTime}
            isHostLocked={isHostLocked}
            canControl={canControl}
            drift={drift}
            playbackRate={playbackRate}
            bufferingInfo={
              bufferingPeer
                ? { name: bufferingPeer.name, remainingSeconds: bufferTimeoutSeconds }
                : null
            }
            onTogglePlay={handleUnifiedPlayToggle}
            onSeekRelative={handleSeekRelative}
            onForceResumeBuffer={handleForceResumeBuffer}
            isEmbedMode={currentMovie?.streamType === 'embed'}
          />

          {/* Desktop-Only Movie Info Banner */}
          {currentMovie && (
            <div className="hidden md:block bg-cinema-800/80 border border-cinema-700/60 rounded-xl p-3 sm:p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                    {currentMovie.title}
                    {currentMovie.voteAverage && (
                      <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                        ⭐ {currentMovie.voteAverage.toFixed(1)}
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-gray-300 leading-relaxed max-w-3xl">
                    {currentMovie.overview || 'Enjoy streaming movies together in real-time.'}
                  </p>
                </div>
                <button
                  onClick={() => setIsCatalogOpen(true)}
                  className="px-3 py-1.5 bg-cinema-700 hover:bg-cinema-600 text-white rounded-lg text-xs font-semibold shrink-0 transition"
                >
                  Change Movie
                </button>
              </div>
            </div>
          )}

          {/* Mobile Bottom Tabs Navigation (< 768px) */}
          <div className="md:hidden flex border-b border-cinema-700 bg-cinema-800 rounded-xl overflow-hidden mt-1">
            <button
              onClick={() => setMobileTab('chat')}
              className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                mobileTab === 'chat'
                  ? 'bg-cinema-accent text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat ({messages.length})</span>
            </button>
            <button
              onClick={() => setIsCatalogOpen(true)}
              className="flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 text-gray-400 hover:text-gray-200 transition"
            >
              <Film className="w-3.5 h-3.5 text-cinema-accent" />
              <span>Movies</span>
            </button>
            <button
              onClick={() => setMobileTab('info')}
              className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                mobileTab === 'info'
                  ? 'bg-cinema-accent text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Info className="w-3.5 h-3.5" />
              <span>Details</span>
            </button>
          </div>

          {/* Mobile Tab Content: Movie Details */}
          {mobileTab === 'info' && currentMovie && (
            <div className="md:hidden bg-cinema-800 border border-cinema-700 rounded-xl p-3 text-xs text-gray-300 space-y-2">
              <h4 className="font-bold text-white text-sm">{currentMovie.title}</h4>
              <p className="leading-relaxed">{currentMovie.overview}</p>
              <button
                onClick={() => setIsRoomModalOpen(true)}
                className="w-full py-2 bg-cinema-700 hover:bg-cinema-600 text-white rounded-lg font-semibold flex items-center justify-center gap-1.5"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Invite Friend to Watch</span>
              </button>
            </div>
          )}

          {/* Mobile Tab Content: Chat Container */}
          <div className={`md:hidden ${mobileTab === 'chat' ? 'block' : 'hidden'} h-[360px]`}>
            <Chat
              messages={messages}
              currentUserId={peerService.getPeerId() || userName}
              onSendMessage={handleSendMessage}
            />
          </div>
        </div>

        {/* Right Column (Desktop 4 cols): Side Panel Chat + Desktop Video Chat */}
        <div className="hidden md:flex md:col-span-4 flex-col gap-3 min-h-[500px]">
          {/* Optional Webcam Video Chat (Desktop / Tablet only) */}
          <DesktopVideoChat remoteStream={remoteStream} />

          {/* Live Text Chat */}
          <div className="flex-1 flex flex-col">
            <Chat
              messages={messages}
              currentUserId={peerService.getPeerId() || userName}
              onSendMessage={handleSendMessage}
            />
          </div>
        </div>
      </main>

      {/* Change Movie Catalog Modal */}
      <MovieCatalog
        isOpen={isCatalogOpen}
        onClose={() => setIsCatalogOpen(false)}
        onSelectMovie={handleSelectMovie}
        canControl={canControl}
      />

      {/* Room & Invite QR Modal */}
      <RoomModal
        isOpen={isRoomModalOpen}
        onClose={() => setIsRoomModalOpen(false)}
        roomId={roomId}
      />
    </div>
  );
};

export default App;
