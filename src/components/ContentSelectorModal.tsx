import React, { useState, useEffect } from 'react';
import { Film, Link as LinkIcon, Search, ArrowLeft, X, Check, Star, Play, Wifi, Loader2, Settings, Sparkles } from 'lucide-react';
import type { Movie } from '../types';
import { searchMovies, CURATED_MOVIES } from '../services/tmdbService';
import {
  parseVideoUrlType,
  formatDropboxUrl,
  formatGoogleDriveUrl,
  type ParsedUrlType,
} from '../services/embedService';
import {
  getBestTorrentStream,
  type TorrentStream,
} from '../services/torrentSearchService';
import { TorrentStreamModal } from './TorrentStreamModal';

interface ContentSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMovie: (movie: Movie) => void;
}

export const ContentSelectorModal: React.FC<ContentSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelectMovie,
}) => {
  const [step, setStep] = useState<'cards' | 'catalog' | 'link'>('cards');
  const [searchQuery, setSearchQuery] = useState('');
  const [movies, setMovies] = useState<Movie[]>(CURATED_MOVIES);
  const [isLoading, setIsLoading] = useState(false);

  // Torrent resolution states
  const [resolvingMovieId, setResolvingMovieId] = useState<string | number | null>(null);
  const [selectedQualityMovie, setSelectedQualityMovie] = useState<Movie | null>(null);

  // Link input states
  const [videoUrl, setVideoUrl] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [detectedType, setDetectedType] = useState<ParsedUrlType>('unknown');
  const [linkError, setLinkError] = useState('');

  // Reset step on open
  useEffect(() => {
    if (isOpen) {
      setStep('cards');
      setSearchQuery('');
      setVideoUrl('');
      setVideoTitle('');
      setLinkError('');
      setResolvingMovieId(null);
      setSelectedQualityMovie(null);
    }
  }, [isOpen]);

  // Search debouncing for catalog
  useEffect(() => {
    if (step !== 'catalog') return;
    const timer = setTimeout(async () => {
      setIsLoading(true);
      const apiKey = localStorage.getItem('tmdb_api_key') || undefined;
      const results = await searchMovies(searchQuery, apiKey);
      setMovies(results);
      setIsLoading(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, step]);

  // 1-Click Instant P2P Torrent Streaming
  const handleOneClickP2P = async (movie: Movie) => {
    if (movie.streamType === 'webtorrent' && movie.streamUrl) {
      onSelectMovie(movie);
      return;
    }

    if (movie.imdbId) {
      try {
        setResolvingMovieId(movie.id);
        const bestStream = await getBestTorrentStream(movie.imdbId, movie.title);

        if (bestStream) {
          const streamMovie: Movie = {
            ...movie,
            streamType: 'webtorrent',
            streamUrl: bestStream.magnetUrl,
          };
          setResolvingMovieId(null);
          onSelectMovie(streamMovie);
          return;
        } else {
          setResolvingMovieId(null);
          setSelectedQualityMovie(movie);
          return;
        }
      } catch (err) {
        setResolvingMovieId(null);
        setSelectedQualityMovie(movie);
        return;
      }
    }

    onSelectMovie({ ...movie, streamType: 'embed' });
  };

  const handleSelectTorrentStream = (movie: Movie, stream: TorrentStream) => {
    onSelectMovie({
      ...movie,
      streamType: 'webtorrent',
      streamUrl: stream.magnetUrl,
    });
  };

  const handleSelectEmbedStream = (movie: Movie) => {
    onSelectMovie({
      ...movie,
      streamType: 'embed',
      streamUrl: undefined,
    });
  };

  // Real-time link format detection
  const handleUrlChange = (val: string) => {
    setVideoUrl(val);
    setLinkError('');
    if (!val.trim()) {
      setDetectedType('unknown');
      return;
    }
    const type = parseVideoUrlType(val);
    setDetectedType(type);
  };

  const handleLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLinkError('');

    const rawUrl = videoUrl.trim();
    if (!rawUrl) {
      setLinkError('Please enter a video URL.');
      return;
    }

    const type = parseVideoUrlType(rawUrl);
    if (type === 'unknown') {
      setLinkError('Unsupported link. Please paste a valid YouTube, Dropbox, Google Drive, Magnet, or MP4/M3U8 link.');
      return;
    }

    let finalUrl = rawUrl;
    let streamType: Movie['streamType'] = 'direct';

    if (type === 'youtube') {
      streamType = 'youtube';
      finalUrl = rawUrl;
    } else if (type === 'dropbox') {
      streamType = 'direct';
      finalUrl = formatDropboxUrl(rawUrl);
    } else if (type === 'gdrive') {
      streamType = 'embed';
      finalUrl = formatGoogleDriveUrl(rawUrl);
    } else if (type === 'magnet') {
      streamType = 'webtorrent';
      finalUrl = rawUrl;
    } else if (type === 'direct') {
      streamType = 'direct';
      finalUrl = rawUrl;
    }

    const movie: Movie = {
      id: `custom-${Date.now()}`,
      title:
        videoTitle.trim() ||
        (type === 'youtube'
          ? 'YouTube Video'
          : type === 'dropbox'
          ? 'Dropbox Movie'
          : type === 'magnet'
          ? 'WebTorrent Movie'
          : 'Custom Video Stream'),
      streamType,
      streamUrl: finalUrl,
    };

    onSelectMovie(movie);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
        <div className="bg-cinema-800 border border-cinema-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-cinema-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {step !== 'cards' && (
                <button
                  onClick={() => setStep('cards')}
                  className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-cinema-700 transition"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <h2 className="text-base sm:text-lg font-bold text-white">
                {step === 'cards'
                  ? 'Select Watch Party Content'
                  : step === 'catalog'
                  ? 'Browse Catalog & Torrent Index'
                  : 'Paste Magnet Link or Video URL'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-cinema-700 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* STEP 1: Two High-Level Choice Cards */}
          {step === 'cards' && (
            <div className="flex-1 overflow-y-auto p-6 sm:p-10 flex flex-col items-center justify-center">
              <div className="text-center mb-8 max-w-md">
                <h3 className="text-xl sm:text-2xl font-black text-white">
                  What would you like to watch?
                </h3>
                <p className="text-xs sm:text-sm text-gray-400 mt-1.5">
                  Pick from thousands of indexed movies with 1-click P2P stream, or paste any video/magnet link.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full max-w-2xl">
                {/* Option A: Movie Catalog */}
                <button
                  onClick={() => setStep('catalog')}
                  className="group p-6 bg-cinema-900 border border-cinema-700 hover:border-violet-500 rounded-2xl text-left transition duration-200 hover:shadow-2xl hover:-translate-y-1 flex flex-col justify-between"
                >
                  <div>
                    <div className="w-12 h-12 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center mb-4 group-hover:bg-violet-600 transition">
                      <Film className="w-6 h-6 text-violet-400 group-hover:text-white transition" />
                    </div>
                    <span className="text-base sm:text-lg font-bold text-white group-hover:text-violet-300 transition block">
                      Search Movies & Torrents
                    </span>
                    <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                      Search any movie title. CineParty automatically resolves top WebRTC seeders for 100% remote play/pause sync!
                    </p>
                  </div>
                  <span className="mt-6 text-xs font-bold text-violet-400 group-hover:text-violet-300 flex items-center gap-1">
                    <span>Search Catalog</span>
                    <span>→</span>
                  </span>
                </button>

                {/* Option B: Direct / Magnet Link */}
                <button
                  onClick={() => setStep('link')}
                  className="group p-6 bg-cinema-900 border border-cinema-700 hover:border-cinema-accent rounded-2xl text-left transition duration-200 hover:shadow-2xl hover:-translate-y-1 flex flex-col justify-between"
                >
                  <div>
                    <div className="w-12 h-12 rounded-xl bg-cinema-accent/20 border border-cinema-accent/30 flex items-center justify-center mb-4 group-hover:bg-cinema-accent transition">
                      <LinkIcon className="w-6 h-6 text-cinema-accent group-hover:text-white transition" />
                    </div>
                    <span className="text-base sm:text-lg font-bold text-white group-hover:text-cinema-accent transition block">
                      Paste Magnet or Video URL
                    </span>
                    <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                      Paste a torrent magnet link, YouTube URL, Dropbox, Google Drive, or raw MP4 video stream.
                    </p>
                  </div>
                  <span className="mt-6 text-xs font-bold text-cinema-accent flex items-center gap-1">
                    <span>Enter Link</span>
                    <span>→</span>
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2A: Catalog Browse & Search */}
          {step === 'catalog' && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search movies (e.g. Interstellar, Inception, Dune, Oppenheimer)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  className="w-full pl-9 pr-3 py-2 bg-cinema-900 border border-cinema-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500 font-medium"
                />
              </div>

              {/* Grid */}
              {isLoading ? (
                <div className="py-16 text-center text-gray-400 text-sm flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
                  <span>Searching movie catalog & torrent swarms...</span>
                </div>
              ) : movies.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-sm">
                  No movies found. Try another search or paste a magnet link!
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                  {movies.map((m) => {
                    const isResolvingThis = resolvingMovieId === m.id;
                    return (
                      <div
                        key={m.id}
                        className="group bg-cinema-900 border border-cinema-700/80 hover:border-violet-500/70 rounded-xl overflow-hidden flex flex-col transition hover:shadow-lg"
                      >
                        <div className="relative aspect-[2/3] bg-cinema-700 overflow-hidden">
                          {m.posterPath ? (
                            <img
                              src={m.posterPath}
                              alt={m.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-500">
                              <Film className="w-10 h-10" />
                            </div>
                          )}

                          <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-violet-950/80 backdrop-blur-sm text-[10px] font-bold text-violet-300 flex items-center gap-1 border border-violet-700/50">
                            <Wifi className="w-2.5 h-2.5" />
                            <span>P2P Sync</span>
                          </div>

                          {m.voteAverage && (
                            <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-sm text-[10px] font-bold text-amber-400 flex items-center gap-0.5">
                              <Star className="w-3 h-3 fill-amber-400" />
                              <span>{m.voteAverage.toFixed(1)}</span>
                            </div>
                          )}
                        </div>

                        <div className="p-2.5 flex-1 flex flex-col justify-between">
                          <div>
                            <h4 className="text-xs sm:text-sm font-bold text-white line-clamp-1">{m.title}</h4>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              {m.releaseDate ? m.releaseDate.split('-')[0] : 'Feature'} • 100% Remote Sync
                            </p>
                          </div>

                          <div className="mt-2.5 flex flex-col gap-1.5">
                            <button
                              onClick={() => handleSelectEmbedStream(m)}
                              className="w-full py-1.5 bg-cinema-accent hover:bg-cinema-accentHover text-white rounded-lg text-xs font-bold shadow transition active:scale-95 flex items-center justify-center gap-1.5"
                              title="Stream directly with native controls, zero ads & 100% remote sync"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Watch (Direct 1080p Sync)</span>
                            </button>

                            <div className="flex gap-1.5">
                              <button
                                onClick={() => handleOneClickP2P(m)}
                                disabled={isResolvingThis}
                                title="Stream via P2P WebTorrent (WebRTC)"
                                className="flex-1 py-1 bg-violet-900/60 hover:bg-violet-800 text-violet-200 border border-violet-700/50 rounded-md text-[10px] font-semibold transition flex items-center justify-center gap-1"
                              >
                                {isResolvingThis ? (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin text-violet-300" />
                                    <span>Finding...</span>
                                  </>
                                ) : (
                                  <>
                                    <Wifi className="w-3 h-3 text-violet-300" />
                                    <span>P2P Torrent</span>
                                  </>
                                )}
                              </button>

                              <button
                                onClick={() => setSelectedQualityMovie(m)}
                                title="Pick resolution (1080p / 720p / 4K)"
                                className="py-1 px-2.5 bg-cinema-800 hover:bg-cinema-700 text-gray-300 hover:text-white rounded-md text-[10px] font-semibold transition flex items-center justify-center gap-1 border border-cinema-700"
                              >
                                <Settings className="w-2.5 h-2.5" />
                                <span>Seeds</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 2B: Paste Video Link */}
          {step === 'link' && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <form onSubmit={handleLinkSubmit} className="max-w-xl mx-auto space-y-4">
                {/* Badges for Supported Providers */}
                <div className="p-4 bg-cinema-900 border border-cinema-700 rounded-xl space-y-2">
                  <span className="text-xs font-bold text-gray-300 block">Supported Video Links:</span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-gray-300">
                      <span className="w-2 h-2 rounded-full bg-violet-400" />
                      <span><strong>Magnet / WebTorrent</strong> (P2P Full Control)</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-300">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      <span><strong>YouTube</strong> (Auto-Sync)</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-300">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      <span><strong>Dropbox</strong> (Auto-Stream)</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-300">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span><strong>Direct MP4 / M3U8</strong></span>
                    </div>
                  </div>

                  {/* 1-Click P2P WebTorrent Demos */}
                  <div className="pt-2 border-t border-cinema-700/60 mt-2">
                    <span className="text-[11px] text-gray-400 block mb-1.5 font-medium">Quick P2P WebTorrent Demos (1-Click Test):</span>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setVideoUrl('https://webtorrent.io/torrents/sintel.torrent');
                          setVideoTitle('Sintel (WebTorrent 1080p)');
                          setDetectedType('magnet');
                        }}
                        className="px-2 py-1 bg-cinema-700 hover:bg-cinema-600 rounded-lg text-[11px] text-gray-200 transition"
                      >
                        🎬 Sintel (1080p WebTorrent)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setVideoUrl('https://webtorrent.io/torrents/big-buck-bunny.torrent');
                          setVideoTitle('Big Buck Bunny');
                          setDetectedType('magnet');
                        }}
                        className="px-2 py-1 bg-cinema-700 hover:bg-cinema-600 rounded-lg text-[11px] text-gray-200 transition"
                      >
                        🐰 Big Buck Bunny
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Video URL or Magnet Link *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Paste Magnet link, YouTube, Dropbox, or MP4 link..."
                      value={videoUrl}
                      onChange={(e) => handleUrlChange(e.target.value)}
                      autoFocus
                      required
                      className="w-full px-3 py-2.5 bg-cinema-900 border border-cinema-700 rounded-xl text-xs sm:text-sm text-white placeholder-gray-500 font-mono focus:outline-none focus:ring-1 focus:ring-cinema-accent"
                    />
                  </div>

                  {/* Real-time Link Detection Feedback */}
                  {detectedType !== 'unknown' && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400 font-semibold animate-fadeIn">
                      <Check className="w-3.5 h-3.5" />
                      <span>
                        Detected:{' '}
                        {detectedType === 'magnet'
                          ? 'Magnet / WebTorrent Stream (100% Native Sync & Control)'
                          : detectedType === 'youtube'
                          ? 'YouTube Video (Automated Frame Sync)'
                          : detectedType === 'dropbox'
                          ? 'Dropbox Video (Auto-converted to high-speed stream)'
                          : detectedType === 'gdrive'
                          ? 'Google Drive Video (Preview stream)'
                          : 'Direct Video Stream'}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Video Title (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. My Favorite Movie"
                    value={videoTitle}
                    onChange={(e) => setVideoTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-cinema-900 border border-cinema-700 rounded-xl text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cinema-accent"
                  />
                </div>

                {linkError && (
                  <p className="text-xs text-rose-400 font-medium">{linkError}</p>
                )}

                <button
                  type="submit"
                  disabled={!videoUrl.trim()}
                  className="w-full py-3 bg-cinema-accent hover:bg-cinema-accentHover disabled:opacity-40 text-white rounded-xl text-sm font-bold shadow-lg transition active:scale-95 flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Create Room & Start Watching</span>
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Quality Picker Modal */}
      <TorrentStreamModal
        isOpen={Boolean(selectedQualityMovie)}
        onClose={() => setSelectedQualityMovie(null)}
        movie={selectedQualityMovie}
        onSelectTorrent={handleSelectTorrentStream}
        onSelectEmbed={handleSelectEmbedStream}
        canControl={true}
      />
    </>
  );
};
