import React from 'react';
import { Play, Pause, RotateCcw, RotateCw, Timer, Zap, Loader2, Gauge } from 'lucide-react';
import { formatTime } from '../utils/helpers';

interface SyncControllerProps {
  isPlaying: boolean;
  currentTime: number;
  isHostLocked: boolean;
  canControl: boolean;
  drift: number;
  playbackRate: number;
  bufferingInfo: { name: string; remainingSeconds: number } | null;
  onTogglePlay: () => void;
  onSeekRelative: (seconds: number) => void;
  onForceResumeBuffer?: () => void;
  isEmbedMode: boolean;
}

export const SyncController: React.FC<SyncControllerProps> = ({
  isPlaying,
  currentTime,
  isHostLocked,
  canControl,
  drift,
  playbackRate,
  bufferingInfo,
  onTogglePlay,
  onSeekRelative,
  onForceResumeBuffer,
  isEmbedMode,
}) => {
  return (
    <div className="bg-cinema-800/95 border border-cinema-700/80 rounded-xl p-2.5 sm:p-3 shadow-lg flex flex-col gap-2">
      {/* Top Bar: Timecode & Real-Time Sync Status */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Master Clock */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-cinema-900 border border-cinema-700 rounded-lg">
            <Timer className="w-3.5 h-3.5 text-cinema-accent" />
            <span className="text-xs font-mono font-bold tracking-wider text-gray-200">
              {formatTime(currentTime)}
            </span>
          </div>

          {/* Live Drift Status Badge */}
          {!bufferingInfo && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cinema-900 border border-cinema-700">
              {playbackRate !== 1.0 ? (
                <>
                  <Gauge className="w-3 h-3 text-amber-400 animate-spin" />
                  <span className="text-amber-300">Catching up ({playbackRate}x)</span>
                </>
              ) : drift < 0.5 ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-emerald-300">In Sync ({drift.toFixed(1)}s)</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-amber-300">Drift {drift.toFixed(1)}s</span>
                </>
              )}
            </div>
          )}

          {isEmbedMode && (
            <span className="hidden sm:inline-block text-[11px] text-gray-400">
              Embed Mode
            </span>
          )}
        </div>

        {/* Playback Controls (ONE Single Play/Pause Button!) */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Rewind 10s */}
          <button
            onClick={() => onSeekRelative(-10)}
            disabled={!canControl || !!bufferingInfo}
            title="Rewind 10 seconds"
            className="p-1.5 sm:px-2.5 sm:py-1.5 bg-cinema-700 hover:bg-cinema-600 active:scale-95 disabled:opacity-40 text-gray-200 rounded-lg text-xs font-medium flex items-center gap-1 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">-10s</span>
          </button>

          {/* SINGLE Unified Play / Pause Button */}
          <button
            onClick={onTogglePlay}
            disabled={!canControl || !!bufferingInfo}
            title={isPlaying ? 'Pause for everyone' : 'Play for everyone in sync'}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-md transition active:scale-95 disabled:opacity-40 flex items-center gap-1.5 ${
              isPlaying
                ? 'bg-cinema-700 hover:bg-cinema-600 text-white'
                : isEmbedMode
                ? 'bg-gradient-to-r from-cinema-accent to-red-600 hover:from-cinema-accentHover hover:to-red-700 text-white shadow-cinema-accent/30'
                : 'bg-cinema-accent hover:bg-cinema-accentHover text-white shadow-cinema-accent/30'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-white text-white" />
                <span>Pause</span>
              </>
            ) : isEmbedMode ? (
              <>
                <Zap className="w-3.5 h-3.5 fill-white text-white" />
                <span>Sync Play (3s)</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-white text-white" />
                <span>Play</span>
              </>
            )}
          </button>

          {/* Fast-forward 10s */}
          <button
            onClick={() => onSeekRelative(10)}
            disabled={!canControl || !!bufferingInfo}
            title="Fast-forward 10 seconds"
            className="p-1.5 sm:px-2.5 sm:py-1.5 bg-cinema-700 hover:bg-cinema-600 active:scale-95 disabled:opacity-40 text-gray-200 rounded-lg text-xs font-medium flex items-center gap-1 transition"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">+10s</span>
          </button>
        </div>
      </div>

      {/* Buffering Lock Alert Banner with 60s Failsafe countdown */}
      {bufferingInfo && (
        <div className="bg-amber-500/15 border border-amber-500/30 rounded-lg px-3 py-1.5 flex items-center justify-between text-xs text-amber-200 animate-fadeIn">
          <div className="flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
            <span>
              Waiting for <strong className="text-white font-bold">{bufferingInfo.name}</strong> to buffer. Auto-resumes in{' '}
              <strong className="text-amber-300 font-mono font-bold">{bufferingInfo.remainingSeconds}s</strong>
            </span>
          </div>
          {onForceResumeBuffer && (
            <button
              onClick={onForceResumeBuffer}
              className="text-[11px] underline text-amber-300 hover:text-white font-semibold ml-2 shrink-0"
            >
              Resume Now
            </button>
          )}
        </div>
      )}

      {/* Host Lock indicator if user is locked out */}
      {isHostLocked && !canControl && (
        <span className="text-[11px] text-amber-400 font-medium">
          Controls locked by host
        </span>
      )}
    </div>
  );
};
