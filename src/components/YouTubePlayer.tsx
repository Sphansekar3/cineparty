import React, { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { formatTime } from '../utils/helpers';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface YouTubePlayerProps {
  videoId: string;
  isPlaying: boolean;
  targetTime: number;
  playbackRate?: number;
  onPlay: (time: number) => void;
  onPause: (time: number) => void;
  onSeek: (time: number) => void;
  onBufferingStart?: () => void;
  onBufferingEnd?: () => void;
}

export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  videoId,
  isPlaying,
  targetTime,
  playbackRate = 1.0,
  onPlay,
  onPause,
  onSeek,
  onBufferingStart,
  onBufferingEnd,
}) => {
  const containerId = useRef(`yt-player-${Math.random().toString(36).substring(2, 8)}`);
  const playerRef = useRef<any>(null);
  const isRemoteAction = useRef(false);
  const lastRecordedTime = useRef(0);
  const isReady = useRef(false);
  const bufferingTimer = useRef<number | null>(null);
  const isLongBuffering = useRef(false);

  // Keep fresh references for events that close over state
  const targetTimeRef = useRef(targetTime);
  targetTimeRef.current = targetTime;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  // Track if browser autoplay policy blocked audio/video playback
  const [isAutoplayBlocked, setIsAutoplayBlocked] = useState(false);

  // Load YouTube IFrame API script once
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    const initPlayer = () => {
      if (!window.YT || !window.YT.Player) return;

      playerRef.current = new window.YT.Player(containerId.current, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 0,
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
          controls: 1,
        },
        events: {
          onReady: (event: any) => {
            isReady.current = true;
            if (targetTimeRef.current > 0) {
              event.target.seekTo(targetTimeRef.current, true);
            }
            if (isPlayingRef.current) {
              try {
                event.target.playVideo();
                // Check if browser blocked unmuted autoplay in background
                setTimeout(() => {
                  if (playerRef.current) {
                    try {
                      const st = playerRef.current.getPlayerState();
                      if (st !== window.YT.PlayerState.PLAYING && st !== window.YT.PlayerState.BUFFERING) {
                        setIsAutoplayBlocked(true);
                      }
                    } catch {
                      setIsAutoplayBlocked(true);
                    }
                  }
                }, 800);
              } catch {
                setIsAutoplayBlocked(true);
              }
            }
          },
          onStateChange: (event: any) => {
            const player = event.target;
            const currentTime = Math.floor(player.getCurrentTime());

            // 3 = BUFFERING
            if (event.data === window.YT.PlayerState.BUFFERING) {
              if (!bufferingTimer.current && !isLongBuffering.current) {
                bufferingTimer.current = window.setTimeout(() => {
                  isLongBuffering.current = true;
                  onBufferingStart?.();
                }, 3000);
              }
            } else {
              if (bufferingTimer.current) {
                clearTimeout(bufferingTimer.current);
                bufferingTimer.current = null;
              }
              if (isLongBuffering.current) {
                isLongBuffering.current = false;
                onBufferingEnd?.();
              }
            }

            // 1 = PLAYING
            if (event.data === window.YT.PlayerState.PLAYING) {
              setIsAutoplayBlocked(false);

              // Safeguard: If user clicked YouTube's native play button from 0:00 while party is ahead
              const target = targetTimeRef.current;
              if (Math.abs(currentTime - target) > 2) {
                isRemoteAction.current = true;
                player.seekTo(target, true);
                setTimeout(() => {
                  isRemoteAction.current = false;
                }, 600);
                return;
              }

              if (!isRemoteAction.current) {
                onPlay(currentTime);
              }
            }
            // 2 = PAUSED
            else if (event.data === window.YT.PlayerState.PAUSED) {
              if (!isRemoteAction.current) {
                onPause(currentTime);
              }
            }
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      if (bufferingTimer.current) {
        clearTimeout(bufferingTimer.current);
        bufferingTimer.current = null;
      }
      if (playerRef.current && playerRef.current.destroy) {
        playerRef.current.destroy();
        playerRef.current = null;
        isReady.current = false;
      }
    };
  }, [videoId]);

  // Sync external isPlaying changes
  useEffect(() => {
    if (!isReady.current || !playerRef.current) return;

    isRemoteAction.current = true;
    try {
      const state = playerRef.current.getPlayerState();
      if (isPlaying) {
        if (state !== window.YT.PlayerState.PLAYING) {
          playerRef.current.playVideo();
          // Check if browser blocked unmuted autoplay
          setTimeout(() => {
            if (playerRef.current && isPlayingRef.current) {
              try {
                const st = playerRef.current.getPlayerState();
                if (st !== window.YT.PlayerState.PLAYING && st !== window.YT.PlayerState.BUFFERING) {
                  setIsAutoplayBlocked(true);
                }
              } catch {
                setIsAutoplayBlocked(true);
              }
            }
          }, 800);
        }
      } else {
        setIsAutoplayBlocked(false);
        if (state === window.YT.PlayerState.PLAYING) {
          playerRef.current.pauseVideo();
        }
      }
    } catch {
      // player might still be initializing
    }

    const timer = setTimeout(() => {
      isRemoteAction.current = false;
    }, 400);

    return () => clearTimeout(timer);
  }, [isPlaying]);

  // Sync external seek changes
  useEffect(() => {
    if (!isReady.current || !playerRef.current) return;

    try {
      const current = Math.floor(playerRef.current.getCurrentTime());
      if (Math.abs(current - targetTime) > 2) {
        isRemoteAction.current = true;
        playerRef.current.seekTo(targetTime, true);
        setTimeout(() => {
          isRemoteAction.current = false;
        }, 400);
      }
    } catch {
      // ignore
    }
  }, [targetTime]);

  // Soft catch-up playback rate adjustment
  useEffect(() => {
    if (!isReady.current || !playerRef.current) return;
    try {
      if (playerRef.current.setPlaybackRate) {
        playerRef.current.setPlaybackRate(playbackRate);
      }
    } catch {
      // ignore
    }
  }, [playbackRate]);

  // Detect user manual seek on the YouTube player bar
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isReady.current || !playerRef.current || isRemoteAction.current) return;

      try {
        const current = Math.floor(playerRef.current.getCurrentTime());
        if (Math.abs(current - lastRecordedTime.current) > 2.5) {
          onSeek(current);
        }
        lastRecordedTime.current = current;
      } catch {
        // ignore
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [onSeek]);

  // User click action to unlock browser audio & start playback in sync
  const handleUserStartSync = () => {
    if (!playerRef.current) return;
    setIsAutoplayBlocked(false);
    isRemoteAction.current = true;

    try {
      if (targetTimeRef.current > 0) {
        playerRef.current.seekTo(targetTimeRef.current, true);
      }
      playerRef.current.playVideo();
    } catch (err) {
      console.error('[YouTube] Failed to start synced playback:', err);
    }

    setTimeout(() => {
      isRemoteAction.current = false;
    }, 600);
  };

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden">
      <div id={containerId.current} className="w-full h-full" />

      {/* High-visibility Autoplay Unlock Overlay when browser blocks audio */}
      {isAutoplayBlocked && (
        <div
          onClick={handleUserStartSync}
          className="absolute inset-0 bg-black/75 backdrop-blur-[2px] z-30 flex flex-col items-center justify-center p-4 cursor-pointer select-none group transition-all"
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-cinema-accent group-hover:scale-105 active:scale-95 flex items-center justify-center shadow-[0_0_35px_rgba(229,9,20,0.7)] transition-transform duration-200">
            <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-white text-white translate-x-0.5" />
          </div>
          <span className="text-white font-bold text-sm sm:text-base mt-4 mb-1">
            Click to Watch in Sync
          </span>
          <span className="text-xs text-gray-300 text-center max-w-xs">
            Browser audio security requires a quick tap to play with sound at {formatTime(targetTimeRef.current)}
          </span>
        </div>
      )}
    </div>
  );
};
