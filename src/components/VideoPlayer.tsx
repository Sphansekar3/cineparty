import React, { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';
import type { Movie } from '../types';
import { getEmbedUrl, extractYouTubeId, EMBED_SERVERS } from '../services/embedService';
import { resolveMovieStream, type ResolvedStream } from '../services/streamResolverService';
import { YouTubePlayer } from './YouTubePlayer';
import { Play, ShieldCheck, ShieldAlert, Server, Sparkles, Loader2 } from 'lucide-react';

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
}) => {
  const [adShieldEnabled, setAdShieldEnabled] = useState<boolean>(true);
  const [resolvedStream, setResolvedStream] = useState<ResolvedStream | null>(null);
  const [isResolvingStream, setIsResolvingStream] = useState<boolean>(false);
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

  // Setup HLS or direct native video playback
  useEffect(() => {
    if (!directStreamUrl) return;

    const video = videoRef.current;
    if (!video) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isHlsUrl = directStreamUrl.includes('.m3u8') || directStreamUrl.includes('/api/proxy');

    if (isHlsUrl && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });
      hls.loadSource(directStreamUrl);
      hls.attachMedia(video);
      hlsRef.current = hls;

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

  // Sync play/pause changes to native video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !directStreamUrl) return;

    if (isPlaying && video.paused) {
      video.play().catch(() => {});
    } else if (!isPlaying && !video.paused) {
      video.pause();
    }
  }, [isPlaying, directStreamUrl]);

  // Sync external seek changes to native video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !directStreamUrl) return;

    if (Math.abs(video.currentTime - currentTime) > 2) {
      isInternalSeeking.current = true;
      video.currentTime = currentTime;
      setTimeout(() => {
        isInternalSeeking.current = false;
      }, 300);
    }
  }, [currentTime, directStreamUrl]);

  // Sync playback rate to native video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !directStreamUrl) return;
    video.playbackRate = playbackRate;
  }, [playbackRate, directStreamUrl]);

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

        {/* Source 1: Clean Native HTML5 / HLS Direct Stream (Scraped or Direct Link) */}
        {directStreamUrl && (
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            controls
            playsInline
            onPlay={() => onNativePlay?.()}
            onPause={() => onNativePause?.()}
            onSeeked={(e) => {
              if (!isInternalSeeking.current) {
                onNativeSeek?.((e.target as HTMLVideoElement).currentTime);
              }
            }}
          />
        )}

        {/* Source 2: Fallback Movie Embed with Smart Ad-Shield (When direct stream unavailable) */}
        {!directStreamUrl && movie.streamType === 'embed' && movie.tmdbId && (
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
                ? 'allow-scripts allow-same-origin allow-forms allow-presentation'
                : undefined
            }
          />
        )}

        {/* Source 2B: Custom Embeds (Google Drive Preview, etc.) */}
        {!directStreamUrl && movie.streamType === 'embed' && !movie.tmdbId && movie.streamUrl && (
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
        {!directStreamUrl && countdown !== null && (
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
        <div className="truncate mr-2 max-w-[55%]">
          <h3 className="text-xs sm:text-sm font-bold text-white truncate">{movie.title}</h3>
          <p className="text-[10px] text-gray-400 truncate flex items-center gap-1.5">
            {movie.streamType === 'youtube' ? (
              <span className="text-emerald-400 font-semibold">YouTube Auto-Sync</span>
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

        <div className="flex items-center gap-1.5">
          {/* Ad-Shield Toggle Button (only shown for fallback embed movies) */}
          {!directStreamUrl && movie.streamType === 'embed' && (
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
          {!directStreamUrl && movie.streamType === 'embed' && (
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
            className="text-xs text-gray-300 hover:text-white bg-cinema-700 hover:bg-cinema-600 px-2.5 py-1 rounded-lg transition shrink-0"
          >
            Change
          </button>
        </div>
      </div>
    </div>
  );
};
