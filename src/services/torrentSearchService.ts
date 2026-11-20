// CineParty In-App Torrent Search & Movie Indexer Service
// Fetches active P2P streams from Torrentio & Cinemeta with WebRTC trackers for 1-click in-browser streaming

import type { Movie } from '../types';

export const WEBRTC_TRACKERS = [
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.webtorrent.dev',
  'wss://tracker.files.fm:7073/announce',
  'wss://tracker.btorrent.xyz',
  'wss://tracker.fastcast.nz',
  'wss://tracker.novage.com.ua:7073/announce',
  'wss://spacetrackr.fun:443/announce',
];

export interface TorrentStream {
  infoHash: string;
  title: string;
  quality: '4K' | '1080p' | '720p' | '480p';
  size: string;
  sizeMB: number;
  seeds: number;
  provider: string;
  magnetUrl: string;
  fileName: string;
  isMp4: boolean;
}

export function buildWebTorrentMagnet(infoHash: string, title: string = 'Movie Stream'): string {
  const trackersQuery = WEBRTC_TRACKERS.map((tr) => `tr=${encodeURIComponent(tr)}`).join('&');
  return `magnet:?xt=urn:btih:${infoHash.toLowerCase()}&dn=${encodeURIComponent(title)}&${trackersQuery}`;
}

export function parseTorrentStreams(data: any, movieTitle: string = 'Movie'): TorrentStream[] {
  if (!data || !Array.isArray(data.streams)) {
    return [];
  }

  const streams: TorrentStream[] = [];

  for (const s of data.streams) {
    if (!s.infoHash) continue;

    const titleLines = (s.title || '').split('\n');
    const firstLine = titleLines[0] || movieTitle;

    const seedMatch = s.title?.match(/👤\s*(\d+)/);
    const sizeMatch = s.title?.match(/💾\s*([\d\.]+\s*[GMK]B)/);
    const providerMatch = s.title?.match(/⚙️\s*([^\n\r]+)/);

    const rawText = ((s.name || '') + ' ' + (s.title || '')).toLowerCase();
    let quality: TorrentStream['quality'] = '720p';
    if (rawText.includes('4k') || rawText.includes('2160p')) {
      quality = '4K';
    } else if (rawText.includes('1080p')) {
      quality = '1080p';
    } else if (rawText.includes('720p')) {
      quality = '720p';
    } else {
      quality = '480p';
    }

    const seeds = seedMatch ? parseInt(seedMatch[1], 10) : 0;
    const sizeStr = sizeMatch ? sizeMatch[1] : '';
    let sizeMB = 0;
    if (sizeStr.includes('GB')) {
      sizeMB = parseFloat(sizeStr) * 1024;
    } else if (sizeStr.includes('MB')) {
      sizeMB = parseFloat(sizeStr);
    }

    const fileName = s.behaviorHints?.filename || firstLine;
    const isMp4 = fileName.toLowerCase().endsWith('.mp4');

    const magnetUrl = buildWebTorrentMagnet(s.infoHash, fileName || movieTitle);

    streams.push({
      infoHash: s.infoHash,
      title: firstLine,
      quality,
      size: sizeStr || 'Unknown Size',
      sizeMB,
      seeds,
      provider: providerMatch ? providerMatch[1].trim() : 'P2P Swarm',
      magnetUrl,
      fileName,
      isMp4,
    });
  }

  // Sort streams intelligently for fast web browser streaming
  return streams.sort((a, b) => {
    // Heavy penalty for massive 4K / Remux files (> 8GB) that take long to buffer in browser
    const aPenalty = a.sizeMB > 8000 ? 600 : a.sizeMB === 0 ? 100 : 0;
    const bPenalty = b.sizeMB > 8000 ? 600 : b.sizeMB === 0 ? 100 : 0;

    // Favor MP4 (hardware decoded in all browsers)
    const aMp4Bonus = a.isMp4 ? 150 : 0;
    const bMp4Bonus = b.isMp4 ? 150 : 0;

    // Favor 1080p and 720p web rips
    const aQualityScore = a.quality === '1080p' ? 250 : a.quality === '720p' ? 200 : 50;
    const bQualityScore = b.quality === '1080p' ? 250 : b.quality === '720p' ? 200 : 50;

    const aScore = a.seeds + aQualityScore + aMp4Bonus - aPenalty;
    const bScore = b.seeds + bQualityScore + bMp4Bonus - bPenalty;

    return bScore - aScore;
  });
}

// Known verified high-speed seeds for instant offline/fallback resolution
const VERIFIED_FALLBACK_STREAMS: Record<string, TorrentStream[]> = {
  tt0816692: [
    {
      infoHash: '89599bf4dc369a3a8eca26411c5ccf922d78b486',
      title: 'Interstellar (2014) 1080p BrRip x264 - YIFY',
      quality: '1080p',
      size: '2.26 GB',
      sizeMB: 2314,
      seeds: 1036,
      provider: 'YTS',
      magnetUrl: buildWebTorrentMagnet('89599bf4dc369a3a8eca26411c5ccf922d78b486', 'Interstellar.2014.1080p.BluRay.x264.YIFY.mp4'),
      fileName: 'Interstellar.2014.1080p.BluRay.x264.YIFY.mp4',
      isMp4: true,
    },
    {
      infoHash: '6e88b3f25ba49d483d740a652bf013c341bc5373',
      title: 'Interstellar (2014) 720p BrRip x264 - YIFY',
      quality: '720p',
      size: '1.02 GB',
      sizeMB: 1044,
      seeds: 224,
      provider: 'YTS',
      magnetUrl: buildWebTorrentMagnet('6e88b3f25ba49d483d740a652bf013c341bc5373', 'Interstellar.2014.720p.BluRay.x264.YIFY.mp4'),
      fileName: 'Interstellar.2014.720p.BluRay.x264.YIFY.mp4',
      isMp4: true,
    },
  ],
  tt1160419: [
    {
      infoHash: 'ed0da850c273e3e15a819bdcbbf418bc85107ec8',
      title: 'Dune (2021) 1080p WEBRip x264 - YTS',
      quality: '1080p',
      size: '2.75 GB',
      sizeMB: 2816,
      seeds: 1065,
      provider: 'YTS',
      magnetUrl: buildWebTorrentMagnet('ed0da850c273e3e15a819bdcbbf418bc85107ec8', 'Dune.2021.1080p.WEBRip.x264.AAC5.1-[YTS.MX].mp4'),
      fileName: 'Dune.2021.1080p.WEBRip.x264.AAC5.1-[YTS.MX].mp4',
      isMp4: true,
    },
  ],
  tt0137523: [
    {
      infoHash: 'a086ce4afabbd8ab949662e30134a49e22d1f0c7',
      title: 'Fight Club (1999) 1080p BrRip x264 - YIFY',
      quality: '1080p',
      size: '1.85 GB',
      sizeMB: 1894,
      seeds: 757,
      provider: 'YTS',
      magnetUrl: buildWebTorrentMagnet('a086ce4afabbd8ab949662e30134a49e22d1f0c7', 'Fight.Club.1999.1080p.BrRip.x264.YIFY.mp4'),
      fileName: 'Fight.Club.1999.1080p.BrRip.x264.YIFY.mp4',
      isMp4: true,
    },
  ],
};

// Fetch active torrent streams for any IMDB ID (e.g. tt0816692)
export async function fetchMovieTorrents(
  imdbId: string,
  movieTitle: string = 'Movie'
): Promise<TorrentStream[]> {
  const cleanId = imdbId.trim();
  if (!cleanId) return [];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`https://torrentio.strem.fun/stream/movie/${cleanId}.json`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const streams = parseTorrentStreams(data, movieTitle);
      if (streams.length > 0) return streams;
    }
  } catch (err) {
    console.warn('[TorrentSearch] Live indexer fetch notice, checking fallback:', err);
  }

  // Fallback to verified seed cache if live indexer timed out or was blocked
  if (VERIFIED_FALLBACK_STREAMS[cleanId]) {
    return VERIFIED_FALLBACK_STREAMS[cleanId];
  }

  return [];
}

// Get the #1 best recommended torrent stream for 1-click loading
export async function getBestTorrentStream(
  imdbId: string,
  movieTitle: string = 'Movie'
): Promise<TorrentStream | null> {
  const streams = await fetchMovieTorrents(imdbId, movieTitle);
  return streams.length > 0 ? streams[0] : null;
}

// Search movies across Cinemeta catalog (free, no API key, millions of movies)
export async function searchMoviesCinemeta(query: string): Promise<Movie[]> {
  const clean = query.trim().toLowerCase();
  if (!clean) return [];

  try {
    const res = await fetch(
      `https://v3-cinemeta.strem.io/catalog/movie/top/search=${encodeURIComponent(clean)}.json`
    );
    if (!res.ok) return [];

    const data = await res.json();
    if (!data.metas || !Array.isArray(data.metas)) return [];

    return data.metas.slice(0, 24).map((meta: any) => ({
      id: meta.id || meta.imdb_id,
      imdbId: meta.imdb_id || meta.id,
      title: meta.name || 'Untitled',
      overview: meta.description || `Released in ${meta.releaseInfo || 'N/A'}. Direct stream scraper ready.`,
      releaseDate: meta.releaseInfo ? `${meta.releaseInfo}-01-01` : undefined,
      posterPath: meta.poster || undefined,
      backdropPath: meta.background || undefined,
      streamType: 'direct',
    }));
  } catch (err) {
    console.warn('[TorrentSearch] Cinemeta search error:', err);
    return [];
  }
}
