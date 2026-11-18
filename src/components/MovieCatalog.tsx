import React, { useState, useEffect } from 'react';
import { Search, Link as LinkIcon, Star, Film, X, Key, Check, Sparkles, Play } from 'lucide-react';
import type { Movie } from '../types';
import { searchMovies, CURATED_MOVIES } from '../services/tmdbService';
import {
  parseVideoUrlType,
  formatDropboxUrl,
  formatGoogleDriveUrl,
  type ParsedUrlType,
} from '../services/embedService';

interface MovieCatalogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMovie: (movie: Movie) => void;
  canControl: boolean;
}

export const MovieCatalog: React.FC<MovieCatalogProps> = ({
  isOpen,
  onClose,
  onSelectMovie,
  canControl,
}) => {
  const [activeTab, setActiveTab] = useState<'browse' | 'custom'>('browse');
  const [searchQuery, setSearchQuery] = useState('');
  const [movies, setMovies] = useState<Movie[]>(CURATED_MOVIES);
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('tmdb_api_key') || '');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  // Custom URL inputs
  const [customTitle, setCustomTitle] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [customError, setCustomError] = useState('');

  // Check if search bar has a pasted link
  const detectedSearchLinkType: ParsedUrlType = parseVideoUrlType(searchQuery.trim());

  useEffect(() => {
    // If user pasted a video link directly into the search bar, don't query TMDB
    if (detectedSearchLinkType !== 'unknown') {
      setIsLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      const results = await searchMovies(searchQuery, apiKey);
      setMovies(results);
      setIsLoading(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, apiKey, detectedSearchLinkType]);

  const handlePlayPastedLink = (urlToPlay: string) => {
    const rawUrl = urlToPlay.trim();
    const type = parseVideoUrlType(rawUrl);
    if (type === 'unknown') return;

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
    } else if (type === 'direct') {
      streamType = 'direct';
      finalUrl = rawUrl;
    }

    const movie: Movie = {
      id: `custom-${Date.now()}`,
      title: type === 'youtube' ? 'YouTube Video' : type === 'dropbox' ? 'Dropbox Movie' : type === 'gdrive' ? 'Google Drive Movie' : 'Custom Video Stream',
      streamType,
      streamUrl: finalUrl,
    };

    onSelectMovie(movie);
    onClose();
  };

  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('tmdb_api_key', key);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomError('');

    const url = customUrl.trim();
    if (!url) {
      setCustomError('Please enter a video or YouTube link.');
      return;
    }

    const type = parseVideoUrlType(url);
    if (type === 'unknown') {
      setCustomError('Please enter a valid YouTube, Dropbox, Google Drive, or MP4/M3U8 link.');
      return;
    }

    let finalUrl = url;
    let streamType: Movie['streamType'] = 'direct';

    if (type === 'youtube') {
      streamType = 'youtube';
      finalUrl = url;
    } else if (type === 'dropbox') {
      streamType = 'direct';
      finalUrl = formatDropboxUrl(url);
    } else if (type === 'gdrive') {
      streamType = 'embed';
      finalUrl = formatGoogleDriveUrl(url);
    } else if (type === 'direct') {
      streamType = 'direct';
      finalUrl = url;
    }

    const movie: Movie = {
      id: `custom-${Date.now()}`,
      title: customTitle.trim() || (type === 'youtube' ? 'YouTube Video' : type === 'dropbox' ? 'Dropbox Movie' : 'Custom Video Stream'),
      streamType,
      streamUrl: finalUrl,
    };

    onSelectMovie(movie);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
      <div className="bg-cinema-800 border border-cinema-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-cinema-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Film className="w-5 h-5 text-cinema-accent" />
            <h2 className="text-base sm:text-lg font-bold text-white">Movie Catalog & Video Sources</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-cinema-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-cinema-700 bg-cinema-900/60 px-4">
          <button
            onClick={() => setActiveTab('browse')}
            className={`py-2.5 px-4 text-xs sm:text-sm font-semibold border-b-2 transition ${
              activeTab === 'browse'
                ? 'border-cinema-accent text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Browse Movies & Search
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`py-2.5 px-4 text-xs sm:text-sm font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'custom'
                ? 'border-cinema-accent text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>Direct Video / YouTube Link</span>
          </button>
        </div>

        {/* Tab 1: Browse & Search */}
        {activeTab === 'browse' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {/* Search Bar & TMDB Key toggle */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search movies (e.g. Inception, Interstellar, Dune)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-cinema-900 border border-cinema-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cinema-accent"
                />
              </div>

              <button
                onClick={() => setShowApiKeyInput(!showApiKeyInput)}
                className="px-3 py-2 bg-cinema-700 hover:bg-cinema-600 text-gray-300 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 shrink-0 transition"
              >
                <Key className="w-3.5 h-3.5" />
                <span>{apiKey ? 'TMDB Key Active' : 'Add TMDB Key'}</span>
              </button>
            </div>

            {/* Dual-Purpose Search Bar Link Detection */}
            {detectedSearchLinkType !== 'unknown' && (
              <div className="p-3 bg-cinema-accent/15 border border-cinema-accent/40 rounded-xl flex items-center justify-between gap-3 animate-fadeIn">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="w-8 h-8 rounded-lg bg-cinema-accent flex items-center justify-center shrink-0 shadow">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Detected {detectedSearchLinkType.toUpperCase()} Video Link</span>
                    </p>
                    <p className="text-[11px] text-gray-300 truncate">
                      {searchQuery}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handlePlayPastedLink(searchQuery)}
                  className="px-3 py-1.5 bg-cinema-accent hover:bg-cinema-accentHover text-white text-xs font-bold rounded-lg shadow-md shrink-0 flex items-center gap-1.5 transition active:scale-95"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Play for Party</span>
                </button>
              </div>
            )}

            {/* Optional TMDB API key input */}
            {showApiKeyInput && (
              <div className="p-3 bg-cinema-900/90 border border-cinema-700 rounded-xl text-xs space-y-2">
                <p className="text-gray-300">
                  Optional: Enter your free{' '}
                  <a
                    href="https://www.themoviedb.org/settings/api"
                    target="_blank"
                    rel="noreferrer"
                    className="text-cinema-accent hover:underline"
                  >
                    TMDB API Key
                  </a>{' '}
                  for unlimited real-time search of thousands of movies. (We include curated movies by default!)
                </p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="Enter TMDB API Key..."
                    value={apiKey}
                    onChange={(e) => handleSaveApiKey(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-cinema-800 border border-cinema-700 rounded-lg text-white font-mono text-xs focus:outline-none"
                  />
                  {apiKey && (
                    <button
                      onClick={() => handleSaveApiKey('')}
                      className="px-2 py-1 bg-red-600/30 text-red-300 rounded hover:bg-red-600/50"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Movie Grid */}
            {isLoading ? (
              <div className="py-12 text-center text-gray-400 text-sm">Searching movies...</div>
            ) : movies.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-sm">
                No movies found. Try searching for another title, or paste a custom video link!
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                {movies.map((m) => (
                  <div
                    key={m.id}
                    className="group bg-cinema-900 border border-cinema-700/70 hover:border-cinema-accent/60 rounded-xl overflow-hidden flex flex-col transition hover:shadow-xl hover:-translate-y-0.5"
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
                      {m.voteAverage && (
                        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-sm text-[11px] font-bold text-amber-400 flex items-center gap-0.5">
                          <Star className="w-3 h-3 fill-amber-400" />
                          <span>{m.voteAverage.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                    <div className="p-2.5 flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-white line-clamp-1 group-hover:text-cinema-accent transition">
                          {m.title}
                        </h4>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {m.releaseDate ? m.releaseDate.split('-')[0] : 'Feature'}
                          {m.streamType === 'direct' ? ' • Direct Stream' : ' • Free Stream'}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          onSelectMovie(m);
                          onClose();
                        }}
                        disabled={!canControl}
                        className="mt-2.5 w-full py-1.5 bg-cinema-accent hover:bg-cinema-accentHover disabled:opacity-40 text-white rounded-lg text-xs font-semibold shadow transition active:scale-95"
                      >
                        Watch Now
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Custom URL Stream */}
        {activeTab === 'custom' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <form onSubmit={handleCustomSubmit} className="max-w-xl mx-auto space-y-4">
              <div className="p-4 bg-cinema-900 border border-cinema-700 rounded-xl text-xs text-gray-300 space-y-1">
                <p className="font-semibold text-white">Supported Video Link Formats:</p>
                <ul className="list-disc pl-4 space-y-0.5 text-gray-400">
                  <li>YouTube Links (e.g. <span className="font-mono text-gray-300">https://youtu.be/...</span>)</li>
                  <li>Direct Video Files (<span className="font-mono text-gray-300">.mp4</span>, <span className="font-mono text-gray-300">.webm</span>)</li>
                  <li>Live Streams (<span className="font-mono text-gray-300">.m3u8</span> / HLS)</li>
                </ul>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Movie / Video Title (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. My Favorite Movie"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-cinema-900 border border-cinema-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cinema-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Video URL / YouTube Link *
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/video.mp4 or https://youtube.com/watch?v=..."
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-cinema-900 border border-cinema-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cinema-accent font-mono text-xs"
                  required
                />
              </div>

              {customError && (
                <p className="text-xs text-rose-400 font-medium">{customError}</p>
              )}

              <button
                type="submit"
                disabled={!canControl}
                className="w-full py-2.5 bg-cinema-accent hover:bg-cinema-accentHover disabled:opacity-40 text-white rounded-xl text-sm font-bold shadow-lg transition active:scale-95 flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>Load & Play in Room</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
