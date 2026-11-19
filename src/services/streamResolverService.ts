// Client Service: Stream Resolver & In-Memory Cache
// Coordinates with /api/stream to get clean, ad-free HLS streams

export interface ResolvedStream {
  success: boolean;
  streamUrl?: string;
  provider?: string;
  fallbackEmbedUrl: string;
}

const streamCache = new Map<string, ResolvedStream>();

export async function resolveMovieStream(
  tmdbId: string | number,
  imdbId?: string
): Promise<ResolvedStream> {
  const cacheKey = `${tmdbId}-${imdbId || ''}`;
  if (streamCache.has(cacheKey)) {
    return streamCache.get(cacheKey)!;
  }

  const fallbackEmbedUrl = `https://vidsrc.cc/v2/embed/movie/${tmdbId}?autoPlay=false`;

  try {
    const params = new URLSearchParams({ tmdbId: String(tmdbId) });
    if (imdbId) params.set('imdbId', imdbId);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`/api/stream?${params.toString()}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data: ResolvedStream = await res.json();
      streamCache.set(cacheKey, data);
      return data;
    }
  } catch (err) {
    console.warn('[StreamResolver] Resolver endpoint unavailable or timed out:', err);
  }

  // Default fallback if endpoint is unreachable (e.g. running locally without Cloudflare Pages Functions)
  const defaultFallback: ResolvedStream = {
    success: false,
    fallbackEmbedUrl,
  };
  return defaultFallback;
}
