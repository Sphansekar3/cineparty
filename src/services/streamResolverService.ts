// Client Service: Pure Direct Stream Resolver
// Calls /api/stream to get clean, ad-free direct HLS streams

export interface SubtitleTrack {
  url: string;
  lang: string;
  label: string;
}

export interface ResolvedStream {
  success: boolean;
  streamUrl?: string;
  provider?: string;
  title?: string;
  subtitles?: SubtitleTrack[];
  message?: string;
}

const streamCache = new Map<string, ResolvedStream>();

export async function resolveMovieStream(
  tmdbId: string | number,
  imdbId?: string,
  title?: string,
  year?: string
): Promise<ResolvedStream> {
  const cacheKey = `${tmdbId}-${imdbId || ''}`;
  if (streamCache.has(cacheKey)) {
    return streamCache.get(cacheKey)!;
  }

  try {
    const params = new URLSearchParams({ tmdbId: String(tmdbId) });
    if (imdbId) params.set('imdbId', imdbId);
    if (title) params.set('title', title);
    if (year) params.set('year', year);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(`/api/stream?${params.toString()}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data: ResolvedStream = await res.json();
      if (data.success) {
        streamCache.set(cacheKey, data);
      }
      return data;
    }
  } catch (err) {
    console.warn('[StreamResolver] Stream resolver request failed:', err);
  }

  const notFound: ResolvedStream = {
    success: false,
    message: 'No stream found. This title is not yet available on host servers.',
  };
  return notFound;
}
