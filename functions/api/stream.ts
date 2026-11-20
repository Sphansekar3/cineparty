// Cloudflare Pages Function: Pure Direct Stream Scraper Engine
// Resolves TMDB / IMDB movie titles to clean, ad-free direct HLS master streams

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

async function scrapeDirectHlsStream(
  tmdbId: string,
  imdbId?: string,
  title?: string,
  year?: string
): Promise<{ streamUrl: string; subtitles: SubtitleTrack[]; provider: string } | null> {
  const movieTitle = title || 'Movie';
  const movieYear = year || '2024';
  const movieImdb = imdbId || '';

  // Priority streaming server clusters
  const servers = ['Nebula', 'Sirius', 'Rigel', 'Light', 'Polaris'];

  for (const server of servers) {
    try {
      const targetQueryUrl = `https://api.wing.st/?title=${encodeURIComponent(
        movieTitle
      )}&type=movie&year=${movieYear}&imdb=${movieImdb}&tmdb=${tmdbId}&server=${server}`;

      // 1. Get encryption state from enc-dec endpoint
      const encRes = await fetch(
        `https://enc-dec.app/api/enc-cinejoy?url=${encodeURIComponent(targetQueryUrl)}`,
        { headers: { 'User-Agent': UA } }
      );
      if (!encRes.ok) continue;
      const encJson = (await encRes.json()) as any;
      if (encJson.status !== 200 || !encJson.result?.data) continue;

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
      });
      if (!postG.ok) continue;
      const encryptedBytes = await postG.arrayBuffer();

      // 3. Decrypt stream manifest
      const decRes = await fetch('https://enc-dec.app/api/dec-cinejoy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
        body: JSON.stringify({
          text: b64urlEncode(new Uint8Array(encryptedBytes)),
          state,
        }),
      });
      if (!decRes.ok) continue;
      const decJson = (await decRes.json()) as any;
      const streamInfo = decJson?.result?.data?.stream?.[0];
      const rawPlaylist = streamInfo?.playlist;

      if (!rawPlaylist) continue;

      // 4. Verify that the master playlist is accessible and not 404
      const plCheck = await fetch(rawPlaylist, {
        headers: { 'User-Agent': UA, Referer: 'https://cinejoy.pk/' },
      });

      if (plCheck.ok) {
        // Collect embedded subtitles from stream or fallback to OpenSubtitles
        const subs: SubtitleTrack[] = [];
        if (streamInfo.captions && Array.isArray(streamInfo.captions)) {
          for (const cap of streamInfo.captions) {
            if (cap.url && cap.language === 'en') {
              subs.push({
                url: `/api/proxy?url=${encodeURIComponent(cap.url)}&referer=${encodeURIComponent(
                  'https://cinejoy.pk/'
                )}`,
                lang: cap.language,
                label: 'English (Original)',
              });
            }
          }
        }

        if (subs.length === 0) {
          const openSubs = await fetchEnglishSubtitles(imdbId);
          subs.push(...openSubs);
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
    } catch {
      // Try next server in cluster
    }
  }

  return null;
}

export async function onRequest(context: { request: Request }): Promise<Response> {
  const { request } = context;

  // Handle CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    });
  }

  const url = new URL(request.url);
  const tmdbId = url.searchParams.get('tmdbId');
  const imdbId = url.searchParams.get('imdbId') || undefined;
  const title = url.searchParams.get('title') || undefined;
  const year = url.searchParams.get('year') || undefined;

  if (!tmdbId && !imdbId) {
    return new Response(
      JSON.stringify({ success: false, message: 'tmdbId or imdbId is required' }),
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
