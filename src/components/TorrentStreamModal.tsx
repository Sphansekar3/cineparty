import React, { useState, useEffect } from 'react';
import { X, Wifi, Sparkles, Loader2, Play, Server, AlertCircle } from 'lucide-react';
import type { Movie } from '../types';
import {
  fetchMovieTorrents,
  type TorrentStream,
} from '../services/torrentSearchService';

interface TorrentStreamModalProps {
  isOpen: boolean;
  onClose: () => void;
  movie: Movie | null;
  onSelectTorrent: (movie: Movie, stream: TorrentStream) => void;
  onSelectEmbed: (movie: Movie) => void;
  canControl?: boolean;
}

export const TorrentStreamModal: React.FC<TorrentStreamModalProps> = ({
  isOpen,
  onClose,
  movie,
  onSelectTorrent,
  onSelectEmbed,
  canControl = true,
}) => {
  const [streams, setStreams] = useState<TorrentStream[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !movie) {
      setStreams([]);
      setError(null);
      return;
    }

    if (!movie.imdbId) {
      // If no IMDB ID, only embed is available
      setStreams([]);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    fetchMovieTorrents(movie.imdbId, movie.title)
      .then((results) => {
        if (!isMounted) return;
        setStreams(results);
        setIsLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || 'Failed to search torrent indexers');
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, movie]);

  if (!isOpen || !movie) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="bg-cinema-800 border border-cinema-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-cinema-700 flex items-center justify-between bg-cinema-900/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
              <Wifi className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white line-clamp-1">
                {movie.title}
              </h3>
              <p className="text-xs text-gray-400">
                Choose P2P Torrent Quality or Fallback Server
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-cinema-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Streams List Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {/* Top Banner Explaining 100% Remote Sync */}
          <div className="p-3 bg-violet-950/40 border border-violet-800/40 rounded-xl flex items-start gap-3 text-xs">
            <Sparkles className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
            <div className="text-gray-300 space-y-0.5">
              <span className="font-semibold text-white block">
                100% Synchronized Playback Control (Zero Ads)
              </span>
              <span>
                Torrent streams play natively inside HTML5 video with shared Play, Pause, Seek, and room sync. 1080p MP4 or 720p streams are recommended for fastest initial buffer.
              </span>
            </div>
          </div>

          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
              <p className="text-sm font-semibold text-white">Searching Torrent Indexers...</p>
              <p className="text-xs text-gray-400 max-w-sm">
                Scanning YTS, 1337x, TorrentGalaxy & Stremio for active WebRTC seeders...
              </p>
            </div>
          ) : error ? (
            <div className="py-8 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
              <p className="text-sm text-gray-300">{error}</p>
            </div>
          ) : streams.length === 0 ? (
            <div className="py-8 text-center space-y-3 bg-cinema-900/50 rounded-xl border border-cinema-700/50 p-6">
              <p className="text-sm font-semibold text-white">
                No verified torrent streams found for this title
              </p>
              <p className="text-xs text-gray-400 max-w-md mx-auto">
                You can still watch this movie using the Server 1 (Embed) fallback player, or paste a custom direct link!
              </p>
              <button
                onClick={() => {
                  onSelectEmbed(movie);
                  onClose();
                }}
                disabled={!canControl}
                className="mt-2 px-4 py-2 bg-cinema-accent hover:bg-cinema-accentHover text-white text-xs font-bold rounded-xl transition inline-flex items-center gap-1.5"
              >
                <Server className="w-3.5 h-3.5" />
                <span>Play via Server 1 (Embed)</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-400 px-1 font-medium">
                <span>Available Torrent Streams ({streams.length})</span>
                <span>Sorted by seed health & browser speed</span>
              </div>

              {streams.map((stream, idx) => (
                <div
                  key={`${stream.infoHash}-${idx}`}
                  className="p-3 bg-cinema-900 border border-cinema-700/70 hover:border-violet-500/60 rounded-xl flex items-center justify-between gap-3 transition group"
                >
                  <div className="overflow-hidden flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          stream.quality === '1080p'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : stream.quality === '720p'
                            ? 'bg-blue-950 text-blue-300 border border-blue-800'
                            : stream.quality === '4K'
                            ? 'bg-purple-950 text-purple-300 border border-purple-800'
                            : 'bg-gray-800 text-gray-300'
                        }`}
                      >
                        {stream.quality}
                      </span>

                      <span className="text-xs font-semibold text-gray-200">
                        {stream.size}
                      </span>

                      <span className="text-[11px] text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40 font-mono">
                        👤 {stream.seeds} seeds
                      </span>

                      <span className="text-[10px] text-gray-400 bg-cinema-800 px-1.5 py-0.5 rounded">
                        {stream.provider}
                      </span>

                      {stream.isMp4 && (
                        <span className="text-[10px] text-cyan-300 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/40">
                          ⚡ Fast MP4
                        </span>
                      )}

                      {idx === 0 && (
                        <span className="text-[10px] text-violet-300 bg-violet-900/60 px-2 py-0.5 rounded-full border border-violet-700/50 font-bold">
                          ★ Recommended
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-gray-300 font-mono truncate">
                      {stream.fileName || stream.title}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      onSelectTorrent(movie, stream);
                      onClose();
                    }}
                    disabled={!canControl}
                    className="px-3.5 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow transition shrink-0 flex items-center gap-1.5 active:scale-95"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>Play</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer: Embed Fallback */}
        <div className="px-5 py-3 border-t border-cinema-700 bg-cinema-900/80 flex items-center justify-between text-xs">
          <span className="text-gray-400">Prefer embed player?</span>
          <button
            onClick={() => {
              onSelectEmbed(movie);
              onClose();
            }}
            disabled={!canControl}
            className="px-3 py-1.5 bg-cinema-700 hover:bg-cinema-600 text-gray-200 font-semibold rounded-lg transition flex items-center gap-1.5"
          >
            <Server className="w-3.5 h-3.5" />
            <span>Switch to Server 1 (Embed)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
