import type { EmbedServer } from '../types';

export const EMBED_SERVERS: EmbedServer[] = [
  {
    id: 'vidlink',
    name: 'Server 1 (VidLink - Fast & Clean)',
    buildMovieUrl: (tmdbId) => `https://vidlink.pro/movie/${tmdbId}?primaryColor=e50914`,
  },
  {
    id: 'autoembed',
    name: 'Server 2 (AutoEmbed)',
    buildMovieUrl: (tmdbId) => `https://autoembed.me/movie/tmdb/${tmdbId}`,
  },
  {
    id: 'vidsrc-to',
    name: 'Server 3 (VidSrc To)',
    buildMovieUrl: (tmdbId) => `https://vidsrc.to/embed/movie/${tmdbId}`,
  },
  {
    id: '2embed',
    name: 'Server 4 (2Embed)',
    buildMovieUrl: (tmdbId) => `https://www.2embed.cc/embed/${tmdbId}`,
  },
];

export function getEmbedUrl(serverId: string, tmdbId: string | number, imdbId?: string): string {
  const server = EMBED_SERVERS.find((s) => s.id === serverId) || EMBED_SERVERS[0];
  return server.buildMovieUrl(tmdbId, imdbId);
}

// Convert Dropbox share links (dl=0) to direct high-speed raw streams (raw=1)
export function formatDropboxUrl(url: string): string {
  if (!url.includes('dropbox.com')) return url;
  let formatted = url.replace('?dl=0', '?raw=1').replace('&dl=0', '&raw=1');
  if (!formatted.includes('raw=1')) {
    formatted += (formatted.includes('?') ? '&' : '?') + 'raw=1';
  }
  return formatted;
}

// Convert Google Drive share links to clean iframe preview embeds
export function formatGoogleDriveUrl(url: string): string {
  if (!url.includes('drive.google.com')) return url;
  // Match file/d/FILE_ID or id=FILE_ID
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return `https://drive.google.com/file/d/${match[1]}/preview`;
  }
  return url;
}

export type ParsedUrlType = 'youtube' | 'dropbox' | 'gdrive' | 'direct' | 'unknown';

export function parseVideoUrlType(url: string): ParsedUrlType {
  if (!url) return 'unknown';
  const cleanUrl = url.trim().toLowerCase();

  // YouTube detection
  const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  if (ytRegex.test(cleanUrl)) {
    return 'youtube';
  }

  // Dropbox detection
  if (cleanUrl.includes('dropbox.com')) {
    return 'dropbox';
  }

  // Google Drive detection
  if (cleanUrl.includes('drive.google.com')) {
    return 'gdrive';
  }

  // Direct media detection (MP4, M3U8/HLS, WebM)
  if (
    cleanUrl.endsWith('.mp4') ||
    cleanUrl.endsWith('.m3u8') ||
    cleanUrl.endsWith('.webm') ||
    cleanUrl.includes('.m3u8?') ||
    cleanUrl.includes('.mp4?')
  ) {
    return 'direct';
  }

  return 'unknown';
}

export function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  return match ? match[1] : null;
}
