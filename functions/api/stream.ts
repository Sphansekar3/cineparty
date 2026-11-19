// Cloudflare Pages Function: Stream Resolver
// Resolves TMDB movie/show IDs to direct .m3u8 streams with multi-provider failover

interface StreamResult {
  success: boolean;
  streamUrl?: string;
  provider?: string;
  subtitles?: Array<{ url: string; lang: string }>;
  fallbackEmbedUrl: string;
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
  const imdbId = url.searchParams.get('imdbId');
  const type = url.searchParams.get('type') || 'movie';

  if (!tmdbId && !imdbId) {
    return new Response(JSON.stringify({ error: 'tmdbId or imdbId is required' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const id = tmdbId || imdbId;
  const fallbackEmbedUrl = `https://vidsrc.cc/v2/embed/movie/${id}?autoPlay=false`;

  // List of candidate extraction strategies / open endpoints
  const providers = [
    {
      name: 'VidSrc Direct',
      resolve: async () => {
        const res = await fetch(`https://vidsrc.xyz/embed/movie/${id}`, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          },
        });
        if (!res.ok) return null;
        const html = await res.text();
        // Look for master.m3u8 or source links
        const m3u8Match = html.match(/https?:\/\/[^"']+\.m3u8[^"']*/);
        if (m3u8Match) {
          return m3u8Match[0];
        }
        return null;
      },
    },
    {
      name: 'SuperEmbed Direct',
      resolve: async () => {
        const res = await fetch(`https://multiembed.mov/?video_id=${id}&tmdb=1`, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          },
        });
        if (!res.ok) return null;
        const html = await res.text();
        const m3u8Match = html.match(/https?:\/\/[^"']+\.m3u8[^"']*/);
        if (m3u8Match) {
          return m3u8Match[0];
        }
        return null;
      },
    },
    {
      name: 'Smashy Direct',
      resolve: async () => {
        const res = await fetch(`https://player.smashystream.com/movie/${id}`, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          },
        });
        if (!res.ok) return null;
        const html = await res.text();
        const m3u8Match = html.match(/https?:\/\/[^"']+\.m3u8[^"']*/);
        if (m3u8Match) {
          return m3u8Match[0];
        }
        return null;
      },
    },
  ];

  // Try providers in sequence
  for (const provider of providers) {
    try {
      const rawM3u8 = await Promise.race([
        provider.resolve(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500)),
      ]);

      if (rawM3u8) {
        const proxiedStreamUrl = `/api/proxy?url=${encodeURIComponent(rawM3u8)}`;
        const result: StreamResult = {
          success: true,
          provider: provider.name,
          streamUrl: proxiedStreamUrl,
          fallbackEmbedUrl,
        };

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }
    } catch {
      // Continue to next provider
    }
  }

  // If scrapers are blocked or unavailable, gracefully fall back to embed URL
  const fallbackResult: StreamResult = {
    success: false,
    fallbackEmbedUrl,
  };

  return new Response(JSON.stringify(fallbackResult), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
