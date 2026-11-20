import React, { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';
import type { Movie } from '../types';
import { getEmbedUrl, extractYouTubeId, EMBED_SERVERS } from '../services/embedService';
import { resolveMovieStream, type ResolvedStream } from '../services/streamResolverService';
import { webTorrentService, type TorrentStatus } from '../services/webTorrentService';
import { YouTubePlayer } from './YouTubePlayer';
import { Play, ShieldCheck, ShieldAlert, Server, Sparkles, Loader2, Radio, Wifi, Subtitles } from 'lucide-react';

interface VideoPlayerProps {
  movie: Movie | null;
  activeServerId: string;
  countdown: number | null;
  isPlaying: boolean;
  currentTime: number;
  playbackRate?: number;
  onNativePlay?: () => void;
  onNativePause?: () => void;
  onNativeSeek?: (time: number) => void;
  onBufferingStart?: () => void;
  onBufferingEnd?: () => void;
  onSelectServer: (serverId: string) => void;
  onOpenMovieCatalog: () => void;
  onDirectStreamChange?: (hasDirectStream: boolean) => void;
  onSwitchToEmbed?: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  movie,
  activeServerId,
  countdown,
  isPlaying,
  currentTime,
  playbackRate = 1.0,
  onNativePlay,
  onNativePause,
  onNativeSeek,
  onBufferingStart,
  onBufferingEnd,
  onSelectServer,
  onOpenMovieCatalog,
  onDirectStreamChange,
  onSwitchToEmbed,
}) => {
  const [adShieldEnabled, setAdShieldEnabled] = useState<boolean>(false);
  const [resolvedStream, setResolvedStream] = useState<ResolvedStream | null>(null);
  const [isResolvingStream, setIsResolvingStream] = useState<boolean>(false);
  const [torrentStatus, setTorrentStatus] = useState<TorrentStatus | null>(null);
  const [isTorrentLoading, setIsTorrentLoading] = useState<boolean>(false);
  const [torrentConnectingSeconds, setTorrentConnectingSeconds] = useState<number>(0);
  const [hlsLevels, setHlsLevels] = useState<{ id: number; label: string }[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState<boolean>(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const isInternalSeeking = useRef<boolean>(false);

  // Attempt direct HLS stream extraction for catalog movies
  useEffect(() => {
    if (!movie || movie.streamType !== 'embed' || !movie.tmdbId) {
      setResolvedStream(null);
      setIsResolvingStream(false);
      onDirectStreamChange?.(false);
      return;
    }

    let isMounted = true;
    setIsResolvingStream(true);

    resolveMovieStream(movie.tmdbId, movie.imdbId)
      .then((res) => {
        if (!isMounted) return;
        setResolvedStream(res);
        setIsResolvingStream(false);
        onDirectStreamChange?.(Boolean(res.success && res.streamUrl));
      })
      .catch(() => {
        if (!isMounted) return;
        setResolvedStream(null);
        setIsResolvingStream(false);
        onDirectStreamChange?.(false);
      });

    return () => {
      isMounted = false;
    };
  }, [movie?.tmdbId, movie?.streamType]);

  const directStreamUrl =
    movie?.streamType === 'direct'
      ? movie.streamUrl
      : resolvedStream?.success && resolvedStream.streamUrl
      ? resolvedStream.streamUrl
      : null;

  const isNativeVideo = Boolean(directStreamUrl || movie?.streamType === 'webtorrent');

  // Setup WebTorrent P2P Streaming
  useEffect(() => {
    if (!movie || movie.streamType !== 'webtorrent' || !movie.streamUrl) {
      webTorrentService.stopCurrentTorrent();
      setTorrentStatus(null);
      setIsTorrentLoading(false);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    let isMounted = true;
    setIsTorrentLoading(true);

    webTorrentService
      .streamTorrent(movie.streamUrl, video, (status) => {
        if (!isMounted) return;
        setTorrentStatus(status);
        if (status.isReady) {
          setIsTorrentLoading(false);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('[WebTorrent] Streaming error:', err);
        setIsTorrentLoading(false);
      });

    return () => {
      isMounted = false;
      webTorrentService.stopCurrentTorrent();
    };
  }, [movie?.streamType, movie?.streamUrl]);

  // Track WebTorrent connecting duration
  useEffect(() => {
    if (movie?.streamType !== 'webtorrent' || !isTorrentLoading) {
      setTorrentConnectingSeconds(0);
      return;
    }
    const timer = setInterval(() => {
      setTorrentConnectingSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [movie?.streamType, isTorrentLoading]);

  // Setup HLS or direct native video playback
  useEffect(() => {
    if (!directStreamUrl) return;

    const video = videoRef.current;
    if (!video) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    setHlsLevels([]);
    setCurrentLevel(-1);

    const isHlsUrl = directStreamUrl.includes('.m3u8') || directStreamUrl.includes('/api/proxy') || directStreamUrl.includes('/pl/');

    if (isHlsUrl && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });
      hls.loadSource(directStreamUrl);
      hls.attachMedia(video);
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        if (data.levels && data.levels.length > 0) {
          const levels = data.levels.map((lvl, index) => ({
            id: index,
            label: lvl.height ? `${lvl.height}p` : `${Math.round(lvl.bitrate / 1000)}k`,
          }));
          setHlsLevels(levels);
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          console.warn('[HLS] Fatal stream error, falling back to embed:', data.type);
          setResolvedStream(null);
          onDirectStreamChange?.(false);
        }
      });
    } else {
      video.src = directStreamUrl;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [directStreamUrl]);

  // Handle HLS Quality switch
  const handleLevelChange = (levelId: number) => {
    setCurrentLevel(levelId);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelId;
    }
  };

  // Handle Subtitle toggle
  const toggleSubtitles = () => {
    const video = videoRef.current;
    if (!video || !video.textTracks) return;
    const nextState = !subtitlesEnabled;
    setSubtitlesEnabled(nextState);
    for (let i = 0; i < video.textTracks.length; i++) {
      video.textTracks[i].mode = nextState ? 'showing' : 'disabled';
    }
  };

  // Sync play/pause changes to native video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isNativeVideo) return;

    if (isPlaying && video.paused) {
      video.play().catch(() => {});
    } else if (!isPlaying && !video.paused) {
      video.pause();
    }
  }, [isPlaying, isNativeVideo]);

  // Sync external seek changes to native video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isNativeVideo) return;

    if (Math.abs(video.currentTime - currentTime) > 2) {
      isInternalSeeking.current = true;
      video.currentTime = currentTime;
      setTimeout(() => {
        isInternalSeeking.current = false;
      }, 300);
    }
  }, [currentTime, isNativeVideo]);

  // Sync playback rate to native video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isNativeVideo) return;
    video.playbackRate = playbackRate;
  }, [playbackRate, isNativeVideo]);

  // Listen to postMessage events from modern embed providers (e.g. vidlink.pro)
  useEffect(() => {
    const handleEmbedMessage = (event: MessageEvent) => {
      if (!event.origin.includes('vidlink.pro')) return;
      const data = event.data;
      if (!data) return;

      if (data.type === 'MEDIA_DATA' && data.data?.currentTime !== undefined) {
        const t = Math.floor(data.data.currentTime);
        if (Math.abs(t - currentTime) > 2) {
          onNativeSeek?.(t);
        }
      } else if (data.event === 'play' || data.event === 'playTriggered') {
        if (!isPlaying) onNativePlay?.();
      } else if (data.event === 'pause' || data.event === 'pauseTriggered') {
        if (isPlaying) onNativePause?.();
      } else if (data.event === 'timeupdate' && data.currentTime !== undefined) {
        const t = Math.floor(data.currentTime);
        if (Math.abs(t - currentTime) > 2) {
          onNativeSeek?.(t);
        }
      }
    };

    window.addEventListener('message', handleEmbedMessage);
    return () => window.removeEventListener('message', handleEmbedMessage);
  }, [isPlaying, currentTime, onNativePlay, onNativePause, onNativeSeek]);

  if (!movie) {
    return (
      <div className="video-responsive-wrapper rounded-xl border border-cinema-700/80 bg-cinema-800 flex items-center justify-center p-6 text-center">
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
          <div className="w-14 h-14 rounded-2xl bg-cinema-700 flex items-center justify-center text-cinema-accent mb-3 shadow-lg">
            <Play className="w-7 h-7 fill-cinema-accent translate-x-0.5" />
          </div>
          <h2 className="text-base sm:text-lg font-bold text-white mb-1">No Movie Selected</h2>
          <p className="text-xs sm:text-sm text-gray-400 max-w-sm mb-4">
            Pick a movie from the catalog, search TMDB, or paste a YouTube / video link to start watching together.
          </p>
          <button
            onClick={onOpenMovieCatalog}
            className="px-4 py-2 bg-cinema-accent hover:bg-cinema-accentHover text-white text-xs sm:text-sm font-semibold rounded-lg shadow-md transition active:scale-95"
          >
            Browse Movies & Videos
          </button>
        </div>
      </div>
    );
  }

  const youtubeId = movie.streamType === 'youtube' && movie.streamUrl ? extractYouTubeId(movie.streamUrl) : null;

  return (
    <div className="relative w-full overflow-hidden rounded-xl bg-black border border-cinema-700/80 shadow-2xl">
      {/* 16:9 Aspect Ratio Video Box */}
      <div className="video-responsive-wrapper">
        {/* Stream Resolver Loading Skeleton */}
        {isResolvingStream && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-4">
            <Loader2 className="w-8 h-8 text-cinema-accent animate-spin mb-2" />
            <p className="text-xs sm:text-sm font-bold text-white mb-1">
              Extracting Clean Stream for "{movie.title}"
            </p>
            <p className="text-[11px] text-gray-400">
              Bypassing ads & preparing frame-accurate sync...
            </p>
          </div>
        )}

        {/* WebTorrent P2P Connecting Skeleton */}
        {movie.streamType === 'webtorrent' && isTorrentLoading && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-4">
            <Radio className="w-9 h-9 text-violet-400 animate-pulse mb-3" />
            <p className="text-xs sm:text-sm font-bold text-white mb-1">
              Connecting to P2P WebTorrent Swarm
            </p>
            <p className="text-[11px] text-gray-400 max-w-sm text-center mb-3">
              Discovering WebRTC seeders & downloading initial video metadata...
            </p>
            {torrentStatus && (
              <div className="flex items-center gap-2 text-[10px] text-violet-300 bg-violet-950/60 border border-violet-800/60 px-3 py-1 rounded-full mb-3">
                <span>Peers: {torrentStatus.numPeers}</span>
                <span>•</span>
                <span>Speed: {(torrentStatus.downloadSpeed / 1024 / 1024).toFixed(1)} MB/s</span>
              </div>
            )}

            {/* Smart fallback notice after 8s of searching with 0 peers */}
            {torrentConnectingSeconds >= 8 && (!torrentStatus || torrentStatus.numPeers === 0) && (
              <div className="mt-2 p-3 bg-cinema-800/95 border border-cinema-700 rounded-xl text-center max-w-md animate-fadeIn space-y-2">
                <p className="text-[11px] text-amber-300 leading-relaxed">
                  Searching for in-browser WebRTC seeders ({torrentConnectingSeconds}s)...<br />
                  <span className="text-gray-400 text-[10px]">
                    Traditional torrents seed over TCP/UDP (desktop apps). If WebRTC seeders are offline right now, switch to Direct HLS / Server Embed to watch immediately!
                  </span>
                </p>
                {onSwitchToEmbed && (
                  <button
                    onClick={onSwitchToEmbed}
                    className="px-3.5 py-1.5 bg-cinema-accent hover:bg-cinema-accentHover text-white text-xs font-bold rounded-lg shadow transition active:scale-95 flex items-center justify-center gap-1.5 mx-auto"
                  >
                    <Server className="w-3.5 h-3.5" />
                    <span>Switch to Direct HLS (Play Instantly)</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Source 1: Clean Native HTML5 / HLS Direct Stream or WebTorrent */}
        {isNativeVideo && (
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            controls
            playsInline
            crossOrigin="anonymous"
            onPlay={() => onNativePlay?.()}
            onPause={() => onNativePause?.()}
            onSeeked={(e) => {
              if (!isInternalSeeking.current) {
                onNativeSeek?.((e.target as HTMLVideoElement).currentTime);
              }
            }}
          >
            {resolvedStream?.subtitles?.map((sub, idx) => (
              <track
                key={sub.url}
                kind="subtitles"
                src={sub.url}
                srcLang={sub.lang}
                label={sub.label}
                default={idx === 0 && subtitlesEnabled}
              />
            ))}
          </video>
        )}

        {/* Source 2: Fallback Movie Embed with Smart Ad-Shield (When direct stream unavailable) */}
        {!isNativeVideo && movie.streamType === 'embed' && movie.tmdbId && (
          <iframe
            key={`${movie.tmdbId}-${activeServerId}-${adShieldEnabled}`}
            src={getEmbedUrl(activeServerId, movie.tmdbId, movie.imdbId)}
            title={movie.title}
            className="w-full h-full"
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="no-referrer"
            sandbox={
              adShieldEnabled
                ? 'allow-scripts allow-same-origin allow-forms allow-presentation allow-top-navigation-by-user-activation'
                : undefined
            }
          />
        )}

        {/* Source 2B: Custom Embeds (Google Drive Preview, etc.) */}
        {!isNativeVideo && movie.streamType === 'embed' && !movie.tmdbId && movie.streamUrl && (
          <iframe
            key={movie.streamUrl}
            src={movie.streamUrl}
            title={movie.title}
            className="w-full h-full"
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="no-referrer"
          />
        )}

        {/* Source 3: Official YouTube IFrame API Player with Auto-Sync */}
        {movie.streamType === 'youtube' && youtubeId && (
          <YouTubePlayer
            key={youtubeId}
            videoId={youtubeId}
            isPlaying={isPlaying}
            targetTime={currentTime}
            playbackRate={playbackRate}
            onPlay={() => {
              if (!isPlaying && onNativePlay) onNativePlay();
            }}
            onPause={() => {
              if (isPlaying && onNativePause) onNativePause();
            }}
            onSeek={(t) => {
              if (onNativeSeek) onNativeSeek(t);
            }}
            onBufferingStart={onBufferingStart}
            onBufferingEnd={onBufferingEnd}
          />
        )}

        {/* Synchronized 3-2-1 Countdown Overlay (for fallback embed mode) */}
        {!isNativeVideo && countdown !== null && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center animate-fadeIn pointer-events-none">
            <div className="text-center">
              <span className="text-xs uppercase tracking-widest text-cinema-accent font-extrabold mb-1 block">
                Synchronizing Playback
              </span>
              <div className="text-7xl sm:text-8xl font-black text-white tracking-tighter animate-bounce drop-shadow-[0_10px_20px_rgba(229,9,20,0.5)]">
                {countdown > 0 ? countdown : 'START!'}
              </div>
              <p className="text-xs text-gray-300 mt-2 font-medium">
                {countdown > 0 ? 'Starting video in sync with your friend...' : 'Enjoy watching!'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Control Banner underneath the video */}
      <div className="px-3 py-2 bg-cinema-800 border-t border-cinema-700/80 flex flex-wrap items-center justify-between gap-2">
        <div className="truncate mr-2 max-w-[50%]">
          <h3 className="text-xs sm:text-sm font-bold text-white truncate">{movie.title}</h3>
          <p className="text-[10px] text-gray-400 truncate flex items-center gap-1.5">
            {movie.streamType === 'youtube' ? (
              <span className="text-emerald-400 font-semibold">YouTube Auto-Sync</span>
            ) : movie.streamType === 'webtorrent' ? (
              <span className="text-violet-400 font-semibold flex items-center gap-1.5">
                <Wifi className="w-3 h-3 text-violet-400" />
                <span>WebTorrent P2P Stream (100% Sync Control)</span>
                {torrentStatus && torrentStatus.numPeers > 0 && (
                  <span className="text-[10px] text-gray-300 bg-violet-500/20 px-1.5 py-0.5 rounded border border-violet-500/30">
                    {torrentStatus.numPeers} Peers • {(torrentStatus.downloadSpeed / 1024 / 1024).toFixed(1)} MB/s • {(torrentStatus.progress * 100).toFixed(0)}%
                  </span>
                )}
              </span>
            ) : directStreamUrl ? (
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span>Direct Ad-Free Stream (Full Sync)</span>
              </span>
            ) : (
              <span className="text-amber-400 font-semibold flex items-center gap-1">
                <Server className="w-3 h-3 text-amber-400" />
                <span>Embed Fallback (Countdown Sync)</span>
              </span>
            )}
            {movie.releaseDate ? ` • ${movie.releaseDate.split('-')[0]}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Direct HLS Quality Switcher */}
          {directStreamUrl && hlsLevels.length > 0 && (
            <div className="flex items-center gap-1">
              <select
                value={currentLevel}
                onChange={(e) => handleLevelChange(Number(e.target.value))}
                className="px-2 py-1 text-[11px] font-semibold bg-cinema-700 hover:bg-cinema-600 text-gray-200 border border-cinema-600 rounded-lg cursor-pointer focus:outline-none"
                title="Change Video Resolution"
              >
                <option value={-1}>Auto Quality</option>
                {hlsLevels.map((lvl) => (
                  <option key={lvl.id} value={lvl.id}>
                    {lvl.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Subtitles CC Toggle Button */}
          {resolvedStream?.subtitles && resolvedStream.subtitles.length > 0 && (
            <button
              onClick={toggleSubtitles}
              title={subtitlesEnabled ? 'Disable Subtitles' : 'Enable English Subtitles'}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition ${
                subtitlesEnabled
                  ? 'bg-cinema-accent text-white shadow'
                  : 'bg-cinema-700 hover:bg-cinema-600 text-gray-400'
              }`}
            >
              <Subtitles className="w-3.5 h-3.5" />
              <span>CC</span>
            </button>
          )}

          {/* Ad-Shield Toggle Button (only shown for fallback embed movies) */}
          {!isNativeVideo && movie.streamType === 'embed' && (
            <button
              onClick={() => setAdShieldEnabled(!adShieldEnabled)}
              title={
                adShieldEnabled
                  ? 'Ad-Shield is ON: Pop-up ads and redirects are blocked. Click to disable if server fails to load.'
                  : 'Ad-Shield is OFF: If popups appear, click to enable protection.'
              }
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition ${
                adShieldEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }`}
            >
              {adShieldEnabled ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Ad-Shield ON</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  <span>Ad-Shield OFF</span>
                </>
              )}
            </button>
          )}

          {/* Quick Server Switcher for Fallback Embeds */}
          {!isNativeVideo && movie.streamType === 'embed' && (
            <div className="flex items-center gap-1">
              <Server className="w-3.5 h-3.5 text-gray-400 hidden sm:inline" />
              <select
                value={activeServerId}
                onChange={(e) => onSelectServer(e.target.value)}
                className="px-2 py-1 text-[11px] bg-cinema-700 hover:bg-cinema-600 text-gray-200 border border-cinema-600 rounded-lg cursor-pointer focus:outline-none"
              >
                {EMBED_SERVERS.map((server) => (
                  <option key={server.id} value={server.id}>
                    {server.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={onOpenMovieCatalog}
            className="text-xs text-gray-300 hover:text-white bg-cinema-700 hover:bg-cinema-600 px-2.5 py-1 rounded-lg transition shrink-0 font-medium"
          >
            Change
          </button>
        </div>
      </div>
    </div>
  );
};
