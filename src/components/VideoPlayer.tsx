import React, { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';
import type { Movie } from '../types';
import { resolveMovieStream, type ResolvedStream } from '../services/streamResolverService';
import { Play, Sparkles, Loader2, Subtitles, Film, AlertCircle } from 'lucide-react';

interface VideoPlayerProps {
  movie: Movie | null;
  isPlaying: boolean;
  currentTime: number;
  playbackRate?: number;
  activeServerId?: string;
  countdown?: number | null;
  onNativePlay?: () => void;
  onNativePause?: () => void;
  onNativeSeek?: (time: number) => void;
  onBufferingStart?: () => void;
  onBufferingEnd?: () => void;
  onSelectServer?: (serverId: string) => void;
  onOpenMovieCatalog: () => void;
  onDirectStreamChange?: (hasDirectStream: boolean) => void;
  onSwitchToEmbed?: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  movie,
  isPlaying,
  currentTime,
  playbackRate = 1.0,
  onNativePlay,
  onNativePause,
  onNativeSeek,
  onOpenMovieCatalog,
  onDirectStreamChange,
}) => {
  const [resolvedStream, setResolvedStream] = useState<ResolvedStream | null>(null);
  const [isResolvingStream, setIsResolvingStream] = useState<boolean>(false);
  const [hlsLevels, setHlsLevels] = useState<{ id: number; label: string }[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState<boolean>(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const isInternalSeeking = useRef<boolean>(false);

  // Extract clean HLS direct stream whenever a movie is selected
  useEffect(() => {
    if (!movie) {
      setResolvedStream(null);
      setIsResolvingStream(false);
      onDirectStreamChange?.(false);
      return;
    }

    // If direct stream URL was provided directly (e.g. custom direct mp4/m3u8 link)
    if (movie.streamType === 'direct' && movie.streamUrl) {
      setResolvedStream({
        success: true,
        streamUrl: movie.streamUrl,
        provider: 'Direct Stream',
      });
      setIsResolvingStream(false);
      onDirectStreamChange?.(true);
      return;
    }

    let isMounted = true;
    setIsResolvingStream(true);
    setResolvedStream(null);

    const year = movie.releaseDate ? movie.releaseDate.split('-')[0] : undefined;

    resolveMovieStream(movie.tmdbId || movie.id, movie.imdbId, movie.title, year)
      .then((res) => {
        if (!isMounted) return;
        setResolvedStream(res);
        setIsResolvingStream(false);
        onDirectStreamChange?.(Boolean(res.success && res.streamUrl));
      })
      .catch(() => {
        if (!isMounted) return;
        setResolvedStream({
          success: false,
          message: 'No stream found. This title is not yet available on host servers.',
        });
        setIsResolvingStream(false);
        onDirectStreamChange?.(false);
      });

    return () => {
      isMounted = false;
    };
  }, [movie?.id, movie?.tmdbId, movie?.streamUrl]);

  const directStreamUrl = resolvedStream?.success ? resolvedStream.streamUrl : null;

  // Setup HLS playback
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

    const isHlsUrl =
      directStreamUrl.includes('.m3u8') ||
      directStreamUrl.includes('/api/proxy') ||
      directStreamUrl.includes('/hls/');

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
          console.warn('[HLS] Fatal playback error:', data.type);
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

  // Handle HLS Quality selection
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

  // Sync Play/Pause to native video
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !directStreamUrl) return;

    if (isPlaying && video.paused) {
      video.play().catch(() => {});
    } else if (!isPlaying && !video.paused) {
      video.pause();
    }
  }, [isPlaying, directStreamUrl]);

  // Sync external seek changes to native video
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !directStreamUrl) return;

    if (Math.abs(video.currentTime - currentTime) > 1.5) {
      isInternalSeeking.current = true;
      video.currentTime = currentTime;
      setTimeout(() => {
        isInternalSeeking.current = false;
      }, 250);
    }
  }, [currentTime, directStreamUrl]);

  // Sync playback rate
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !directStreamUrl) return;
    video.playbackRate = playbackRate;
  }, [playbackRate, directStreamUrl]);

  // State 1: No movie selected
  if (!movie) {
    return (
      <div className="video-responsive-wrapper rounded-xl border border-cinema-700/80 bg-cinema-800 flex items-center justify-center p-6 text-center">
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
          <div className="w-14 h-14 rounded-2xl bg-cinema-700 flex items-center justify-center text-cinema-accent mb-3 shadow-lg">
            <Play className="w-7 h-7 fill-cinema-accent translate-x-0.5" />
          </div>
          <h2 className="text-base sm:text-lg font-bold text-white mb-1">No Movie Selected</h2>
          <p className="text-xs sm:text-sm text-gray-400 max-w-sm mb-4">
            Select any title from the catalog. CineParty will extract the clean direct stream and play it in sync.
          </p>
          <button
            onClick={onOpenMovieCatalog}
            className="px-4 py-2 bg-cinema-accent hover:bg-cinema-accentHover text-white text-xs sm:text-sm font-semibold rounded-lg shadow-md transition active:scale-95"
          >
            Browse Movies
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden rounded-xl bg-black border border-cinema-700/80 shadow-2xl">
      {/* 16:9 Aspect Ratio Video Box */}
      <div className="video-responsive-wrapper">
        {/* Stream Resolver Loading Skeleton */}
        {isResolvingStream && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-4">
            <Loader2 className="w-9 h-9 text-cinema-accent animate-spin mb-3" />
            <p className="text-sm font-bold text-white mb-1">
              Extracting Clean Stream for "{movie.title}"
            </p>
            <p className="text-xs text-gray-400">
              Scraping direct 1080p master playlist & English subtitles...
            </p>
          </div>
        )}

        {/* Not Found Screen (When a movie is so new that no host has uploaded it yet) */}
        {!isResolvingStream && resolvedStream && !resolvedStream.success && (
          <div className="absolute inset-0 bg-cinema-900 z-20 flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
            <div className="w-14 h-14 rounded-2xl bg-cinema-800 border border-cinema-700 flex items-center justify-center text-amber-400 mb-3 shadow-lg">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white mb-1">No Result Found</h3>
            <p className="text-xs sm:text-sm text-gray-400 max-w-md mb-4 leading-relaxed">
              This title is not yet available on host servers. Please select another movie from the catalog to watch!
            </p>
            <button
              onClick={onOpenMovieCatalog}
              className="px-4 py-2 bg-cinema-accent hover:bg-cinema-accentHover text-white text-xs sm:text-sm font-bold rounded-lg shadow-md transition active:scale-95 flex items-center gap-1.5"
            >
              <Film className="w-4 h-4" />
              <span>Browse Other Movies</span>
            </button>
          </div>
        )}

        {/* Clean Native HTML5 Video Element */}
        {directStreamUrl && (
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
      </div>

      {/* Control Banner underneath the video */}
      <div className="px-3 py-2 bg-cinema-800 border-t border-cinema-700/80 flex flex-wrap items-center justify-between gap-2">
        <div className="truncate mr-2 max-w-[50%]">
          <h3 className="text-xs sm:text-sm font-bold text-white truncate">{movie.title}</h3>
          <p className="text-[10px] text-gray-400 truncate flex items-center gap-1.5">
            {directStreamUrl ? (
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span>Direct Scraped Stream (100% Remote Sync)</span>
              </span>
            ) : isResolvingStream ? (
              <span className="text-cinema-accent font-medium">Resolving direct stream...</span>
            ) : (
              <span className="text-gray-400">Stream offline</span>
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

          <button
            onClick={onOpenMovieCatalog}
            className="text-xs text-gray-300 hover:text-white bg-cinema-700 hover:bg-cinema-600 px-2.5 py-1 rounded-lg transition shrink-0 font-medium"
          >
            Change Movie
          </button>
        </div>
      </div>
    </div>
  );
};
