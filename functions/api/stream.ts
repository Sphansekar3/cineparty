// Cloudflare Pages Function: Pure Direct Stream Scraper Engine
// Resolves TMDB / IMDB movie titles to clean, ad-free direct HLS master streams
// Uses Datacenter-Clean Host Clusters (Polaris, Munich, Paris, Warsaw) with sub-second parallel resolution

interface SubtitleTrack {
  url: string;
  lang: string;
  label: string;
}

interface StreamResponse {
  success: boolean;
  streamUrl?: string;
  provider?: string;
  title?: string;
  subtitles?: SubtitleTrack[];
  message?: string;
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

// Verified datacenter-clean host server clusters on api.wing.st
// Raced in pairs to strictly respect Cloudflare Workers' 6-connection pool limit
const SERVER_TIERS = [
  ['Polaris', 'Munich'], // Primary high-speed clusters (US & Europe, zero Cloudflare blocks)
  ['Nebula', 'Paris'],   // High-bitrate 1080p & European mirrors
  ['Warsaw'],            // Failover cluster
];

function b64urlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Automatically resolve IMDB ID from Cinemeta if not provided by client
async function resolveImdbIdFromCinemeta(title: string): Promise<string> {
  try {
    const res = await fetch(
      `https://v3-cinemeta.strem.io/catalog/movie/top/search=${encodeURIComponent(title)}.json`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return '';
    const data = (await res.json()) as any;
    const top = data.metas?.[0];
    return top?.imdb_id || top?.id || '';
  } catch {
    return '';
  }
}

// Automatically resolve numeric TMDB ID from IMDB ID (api.wing.st strictly requires numeric TMDB)
async function resolveTmdbIdFromImdb(imdbId: string): Promise<string> {
  try {
    const res = await fetch(
      `https://v3-cinemeta.strem.io/meta/movie/${imdbId}.json`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return '';
    const data = (await res.json()) as any;
    return data.meta?.moviedb_id ? String(data.meta.moviedb_id) : '';
  } catch {
    return '';
  }
}

async function fetchEnglishSubtitles(imdbId?: string): Promise<SubtitleTrack[]> {
  if (!imdbId) return [];
  try {
    const cleanId = imdbId.replace(/^tt/, '');
    const res = await fetch(
      `https://rest.opensubtitles.org/search/imdbid-${cleanId}/sublanguageid-eng`,
      {
        headers: {
          'User-Agent': 'CinePartySubtitles v1.0',
          'X-User-Agent': 'CinePartySubtitles v1.0',
        },
        signal: AbortSignal.timeout(3000),
      }
    );
    if (!res.ok) return [];
    const json = (await res.json()) as any[];
    if (!Array.isArray(json) || !json.length) return [];

    return json.slice(0, 3).map((sub, idx) => ({
      url: `/api/subtitles?url=${encodeURIComponent(sub.SubDownloadLink)}`,
      lang: 'en',
      label: idx === 0 ? 'English (Full)' : `English (${sub.SubFormat?.toUpperCase() || 'CC'})`,
    }));
  } catch {
    return [];
  }
}

// Probe an individual host server cluster for playable HLS stream
async function probeServerCluster(
  movieTitle: string,
  movieYear: string,
  movieImdb: string,
  tmdbId: string,
  server: string
): Promise<{ streamUrl: string; subtitles: SubtitleTrack[]; provider: string }> {
  const targetQueryUrl = `https://api.wing.st/?title=${encodeURIComponent(
    movieTitle
  )}&type=movie&year=${movieYear}&imdb=${movieImdb}&tmdb=${tmdbId}&server=${server}`;

  // 1. Get encryption state from enc-dec endpoint
  const encRes = await fetch(
    `https://enc-dec.app/api/enc-cinejoy?url=${encodeURIComponent(targetQueryUrl)}`,
    {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(5000),
    }
  );
  if (!encRes.ok) throw new Error(`${server}: enc HTTP ${encRes.status}`);
  const encJson = (await encRes.json()) as any;
  if (encJson.status !== 200 || !encJson.result?.data) {
    throw new Error(`${server}: invalid enc response`);
  }

  const { data, state } = encJson.result;

  // 2. Query wing.st gateway
  const postG = await fetch('https://api.wing.st/g', {
    method: 'POST',
    headers: {
      Accept: '*/*',
      Origin: 'https://cinejoy.pk',
      Referer: 'https://cinejoy.pk/',
      'User-Agent': UA,
    },
    body: b64urlDecode(data),
    signal: AbortSignal.timeout(5000),
  });
  if (!postG.ok) throw new Error(`${server}: /g HTTP ${postG.status}`);
  const encryptedBytes = await postG.arrayBuffer();

  // 3. Decrypt stream manifest
  const decRes = await fetch('https://enc-dec.app/api/dec-cinejoy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({
      text: b64urlEncode(new Uint8Array(encryptedBytes)),
      state,
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (!decRes.ok) throw new Error(`${server}: dec HTTP ${decRes.status}`);
  const decJson = (await decRes.json()) as any;
  const streamInfo = decJson?.result?.data?.stream?.[0];
  const rawPlaylist = streamInfo?.playlist;

  if (!rawPlaylist) throw new Error(`${server}: no playlist returned`);

  // Detect and reject anti-bot decoy redirect loops
  if (rawPlaylist.includes('dontscrape')) {
    throw new Error(`${server}: decoy playlist detected`);
  }

  // 4. Verify that the master playlist is accessible and delivers 200
  const plCheck = await fetch(rawPlaylist, {
    headers: { 'User-Agent': UA, Referer: 'https://cinejoy.pk/' },
    signal: AbortSignal.timeout(3500),
  });

  if (!plCheck.ok) {
    throw new Error(`${server}: playlist verification failed with ${plCheck.status}`);
  }

  // 5. Collect embedded subtitles
  const subs: SubtitleTrack[] = [];
  if (streamInfo.captions && Array.isArray(streamInfo.captions)) {
    for (const cap of streamInfo.captions) {
      if (cap.url && (cap.language === 'en' || !cap.language)) {
        subs.push({
          url: `/api/proxy?url=${encodeURIComponent(cap.url)}&referer=${encodeURIComponent(
            'https://cinejoy.pk/'
          )}`,
          lang: cap.language || 'en',
          label: cap.display || 'English (Original)',
        });
      }
    }
  }

  const proxiedStreamUrl = `/api/proxy?url=${encodeURIComponent(
    rawPlaylist
  )}&referer=${encodeURIComponent('https://cinejoy.pk/')}`;

  return {
    streamUrl: proxiedStreamUrl,
    subtitles: subs,
    provider: `Direct Stream (${server})`,
  };
}

async function scrapeDirectHlsStream(
  tmdbId?: string,
  imdbId?: string,
  title?: string,
  year?: string
): Promise<{ streamUrl: string; subtitles: SubtitleTrack[]; provider: string } | null> {
  const movieTitle = title || 'Movie';
  const movieYear = year || '';

  let effectiveImdb = imdbId || '';
  let effectiveTmdb = tmdbId || '';

  // 1. If tmdbId was passed as an IMDB ID (starts with 'tt'), convert it to numeric TMDB ID
  if (effectiveTmdb && effectiveTmdb.startsWith('tt')) {
    if (!effectiveImdb) effectiveImdb = effectiveTmdb;
    effectiveTmdb = await resolveTmdbIdFromImdb(effectiveTmdb);
  }

  // 2. If IMDB ID is missing, resolve it from Cinemeta search
  if (!effectiveImdb && title) {
    effectiveImdb = await resolveImdbIdFromCinemeta(title);
  }

  // 3. If TMDB ID is missing but we have an IMDB ID, resolve numeric TMDB ID
  if (!effectiveTmdb && effectiveImdb) {
    effectiveTmdb = await resolveTmdbIdFromImdb(effectiveImdb);
  }

  // 4. Tiered Parallel Racing: Query 2 datacenter-clean servers at a time
  for (const tier of SERVER_TIERS) {
    try {
      const racePromises = tier.map((server) =>
        probeServerCluster(movieTitle, movieYear, effectiveImdb, effectiveTmdb, server)
      );
      const winner = await Promise.any(racePromises);

      // If stream has no embedded English subtitles, add OpenSubtitles in background
      if (winner.subtitles.length === 0 && effectiveImdb) {
        const openSubs = await fetchEnglishSubtitles(effectiveImdb);
        winner.subtitles.push(...openSubs);
      }

      return winner;
    } catch {
      // Continue to next tier
    }
  }

  // 5. Fallback: If year was specified and all tiers failed, retry Tier 1 without year restriction
  if (movieYear) {
    try {
      const fallbackPromises = SERVER_TIERS[0].map((server) =>
        probeServerCluster(movieTitle, '', effectiveImdb, effectiveTmdb, server)
      );
      const winner = await Promise.any(fallbackPromises);
      if (winner.subtitles.length === 0 && effectiveImdb) {
        const openSubs = await fetchEnglishSubtitles(effectiveImdb);
        winner.subtitles.push(...openSubs);
      }
      return winner;
    } catch {
      // Return null below
    }
  }

  return null;
}

export async function onRequestGet(context: { request: Request }): Promise<Response> {
  const url = new URL(context.request.url);
  const tmdbId = url.searchParams.get('tmdbId');
  const imdbId = url.searchParams.get('imdbId') || undefined;
  const title = url.searchParams.get('title') || undefined;
  const year = url.searchParams.get('year') || undefined;

  if (!tmdbId && !imdbId && !title) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Missing required media identifier (tmdbId, imdbId, or title).',
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  const id = tmdbId || imdbId || '';

  try {
    const stream = await scrapeDirectHlsStream(id, imdbId, title, year);

    if (stream && stream.streamUrl) {
      const response: StreamResponse = {
        success: true,
        streamUrl: stream.streamUrl,
        provider: stream.provider,
        title: title || 'Movie',
        subtitles: stream.subtitles,
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }
  } catch {
    // Falls through to clean not-found response
  }

  // When no host has uploaded the stream yet
  const notFoundResponse: StreamResponse = {
    success: false,
    message: 'No stream found. This title is not yet available on host servers.',
  };

  return new Response(JSON.stringify(notFoundResponse), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
