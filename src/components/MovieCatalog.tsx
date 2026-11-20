import React, { useState, useEffect } from 'react';
import { Search, Link as LinkIcon, Star, Film, X, Key, Check, Sparkles, Play, Loader2 } from 'lucide-react';
import type { Movie } from '../types';
import { searchMovies, CURATED_MOVIES } from '../services/tmdbService';
import {
  parseVideoUrlType,
  formatDropboxUrl,
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

  const handleSelectMovie = (movie: Movie) => {
    onSelectMovie({
      ...movie,
      streamType: 'direct',
    });
    onClose();
  };

  const handlePlayPastedLink = (urlToPlay: string) => {
    const rawUrl = urlToPlay.trim();
    const type = parseVideoUrlType(rawUrl);
    if (type === 'unknown') return;

    let finalUrl = rawUrl;
    let streamType: Movie['streamType'] = 'direct';

    if (type === 'dropbox') {
      streamType = 'direct';
      finalUrl = formatDropboxUrl(rawUrl);
    } else if (type === 'direct') {
      streamType = 'direct';
      finalUrl = rawUrl;
    }

    const movie: Movie = {
      id: `custom-${Date.now()}`,
      title: customTitle.trim() || 'Custom Video Stream',
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
      setCustomError('Please enter a video URL');
      return;
    }

    const type = parseVideoUrlType(url);
    if (type === 'unknown') {
      setCustomError('Invalid link. Please provide a direct video link (.mp4, .m3u8) or Dropbox link.');
      return;
    }

    handlePlayPastedLink(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
      <div className="bg-cinema-800 border border-cinema-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-cinema-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Film className="w-5 h-5 text-cinema-accent" />
            <h2 className="text-base sm:text-lg font-bold text-white">Movie Catalog</h2>
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
            className={`py-2.5 px-4 text-xs sm:text-sm font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'browse'
                ? 'border-cinema-accent text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Film className="w-3.5 h-3.5 text-cinema-accent" />
            <span>Browse Movies</span>
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
            <span>Direct Video Link</span>
          </button>
        </div>

        {/* Tab 1: Browse Movies */}
        {activeTab === 'browse' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {/* Notice Banner */}
            <div className="p-3 bg-cinema-900/80 border border-cinema-700 rounded-xl flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cinema-accent shrink-0" />
                <span className="text-gray-300">
                  <strong className="text-white">Direct Stream Scraper:</strong> Select any movie below — CineParty automatically extracts the ad-free, 1080p HLS stream and plays it directly in native HTML5 with 100% remote sync!
                </span>
              </div>
            </div>

            {/* Search Bar & TMDB Key toggle */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search thousands of movies (e.g. Interstellar, Inception, Dune)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-cinema-900 border border-cinema-700 rounded-xl text-white placeholder-gray-500 text-xs sm:text-sm focus:outline-none focus:border-cinema-accent transition"
                />
              </div>

              <button
                onClick={() => setShowApiKeyInput(!showApiKeyInput)}
                className={`px-3 py-2 border rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition shrink-0 ${
                  apiKey
                    ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                    : 'border-cinema-700 text-gray-400 bg-cinema-900 hover:text-white'
                }`}
              >
                {apiKey ? <Check className="w-3.5 h-3.5" /> : <Key className="w-3.5 h-3.5" />}
                <span>{apiKey ? 'TMDB Key Active' : 'Add TMDB Key'}</span>
              </button>
            </div>

            {/* Optional TMDB API Key accordion */}
            {showApiKeyInput && (
              <div className="p-3 bg-cinema-900 border border-cinema-700 rounded-xl text-xs space-y-2 animate-fadeIn">
                <p className="text-gray-300">
                  Optional: Add your personal free TMDB API key to unlock full search across millions of titles.
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
              <div className="py-16 text-center text-gray-400 text-sm flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 text-cinema-accent animate-spin" />
                <span>Searching movies...</span>
              </div>
            ) : movies.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-sm">
                No movies found matching "{searchQuery}". Try searching another title!
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

                      <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-sm text-[10px] font-bold text-emerald-400 flex items-center gap-1 border border-emerald-500/30">
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>Direct HLS</span>
                      </div>

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
                        <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                          <span>{m.releaseDate ? m.releaseDate.split('-')[0] : 'Feature'}</span>
                          <span>•</span>
                          <span className="text-emerald-400 font-semibold">100% Remote Sync</span>
                        </p>
                      </div>

                      <div className="mt-2.5">
                        <button
                          onClick={() => handleSelectMovie(m)}
                          disabled={!canControl}
                          className="w-full py-2 bg-cinema-accent hover:bg-cinema-accentHover disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow transition active:scale-95 flex items-center justify-center gap-1.5"
                          title="Extract direct stream and watch with 100% synchronized controls"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />
                          <span>Watch Movie</span>
                        </button>
                      </div>
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
                <p className="font-semibold text-white">Supported Direct Video Links:</p>
                <ul className="list-disc pl-4 space-y-0.5 text-gray-400">
                  <li>Direct Video Files (<span className="font-mono text-gray-300">.mp4</span>, <span className="font-mono text-gray-300">.webm</span>)</li>
                  <li>Live / VOD Streams (<span className="font-mono text-gray-300">.m3u8</span> / HLS)</li>
                  <li>Dropbox Share Links (<span className="font-mono text-gray-300">dropbox.com/...</span>)</li>
                </ul>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Movie / Video Title (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. My Video"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-cinema-900 border border-cinema-700 rounded-lg text-white text-xs sm:text-sm focus:outline-none focus:border-cinema-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Video URL (.mp4 / .m3u8)
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/video.mp4 or .m3u8"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-cinema-900 border border-cinema-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-cinema-accent"
                />
              </div>

              {customError && (
                <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/40 p-2 rounded-lg">
                  {customError}
                </p>
              )}

              <button
                type="submit"
                disabled={!canControl}
                className="w-full py-2.5 bg-cinema-accent hover:bg-cinema-accentHover disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-lg shadow-md transition active:scale-95 flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Start Direct Playback</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
