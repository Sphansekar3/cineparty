// Cloudflare Pages Function: Stream Resolver
// Resolves TMDB movie/show IDs to direct .m3u8 streams with WASM-powered stream extraction and multi-provider failover

interface StreamResult {
  success: boolean;
  streamUrl?: string;
  provider?: string;
  subtitles?: Array<{ url: string; lang: string; label: string }>;
  fallbackEmbedUrl: string;
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function b64ToUint8Array(s: string): Uint8Array {
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    u[i] = bin.charCodeAt(i);
  }
  return u;
}

async function scrapeAutoEmbedStream(tmdbId: string, type: string = 'movie') {
  const path = type === 'tv' ? `/embed/tv/${tmdbId}` : `/embed/movie/${tmdbId}`;

  // 1. Initial page to retrieve session cookie
  const t0 = Date.now();
  const initial = await fetch(`https://player.autoembed.me${path}`, {
    headers: { 'User-Agent': UA, Referer: 'https://autoembed.me/' },
  });
  const cookie = initial.headers.get('set-cookie') || '';
  const step1Time = Date.now() - t0;

  // 2. va_src.php endpoint to retrieve player wrapper URL
  const t1 = Date.now();
  const apiRes = await fetch(
    `https://player.autoembed.me/embed/va_src.php?path=${encodeURIComponent(path)}`,
    {
      headers: {
        'User-Agent': UA,
        Referer: `https://player.autoembed.me${path}`,
        Cookie: cookie,
      },
    }
  );
  if (!apiRes.ok) throw new Error(`step2 failed status ${apiRes.status} in ${Date.now() - t1}ms (step1: ${step1Time}ms)`);
  const { src } = (await apiRes.json()) as { src: string };
  if (!src) throw new Error(`step2 empty src in ${Date.now() - t1}ms`);
  const step2Time = Date.now() - t1;

  // 3. NextGenCloudFabric player HTML
  const t2 = Date.now();
  const fabricRes = await fetch(src, {
    headers: { 'User-Agent': UA, Referer: 'https://player.autoembed.me/' },
  });
  if (!fabricRes.ok) throw new Error(`step3 failed status ${fabricRes.status} in ${Date.now() - t2}ms`);
  const text = await fabricRes.text();
  const step3Time = Date.now() - t2;

  const cfgIdx = text.indexOf('CONFIG');
  const m =
    text.match(/window\.CONFIG\s*=\s*(\{[\s\S]*?\});/) ||
    text.match(/CONFIG\s*=\s*(\{[\s\S]*?\});/) ||
    text.match(/CONFIG\s*=\s*(\{[\s\S]*?\})<\/script>/);
  if (cfgIdx === -1) {
    const titleMatch = text.match(/<title>([^<]*)<\/title>/i);
    const bodyMatch = text.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    throw new Error(`step3 title:${titleMatch ? titleMatch[1] : 'none'} body:${bodyMatch ? bodyMatch[1].slice(0, 200).replace(/\s+/g, ' ') : text.slice(0, 200)}`);
  }
  const config = JSON.parse(m[1]);

  // 4. Fetch stream data API
  const t3 = Date.now();
  const apiUrl =
    (config.streamDataApiUrl || 'https://streamdata.vaplayer.ru/api.php') +
    `?tmdb=${config.mediaId}&type=${config.mediaType}&stream_urls&api_token=${encodeURIComponent(
      config.apiToken
    )}`;

  const dataRes = await fetch(apiUrl, {
    headers: {
      'User-Agent': UA,
      Referer: src,
      Origin: 'https://nextgencloudfabric.com',
    },
  });
  if (!dataRes.ok) throw new Error(`step4 failed status ${dataRes.status} in ${Date.now() - t3}ms`);
  const j = (await dataRes.json()) as any;
  const va = j && (j.vp || j.va);
  if (!va || !j.data || !j.data.stream_urls) throw new Error(`step4 missing va in ${Date.now() - t3}ms`);

  // 5. Decrypt stream_urls using WebAssembly
  const t4 = Date.now();
  const wasmBytes = va.wasm_url
    ? await (await fetch(va.wasm_url)).arrayBuffer()
    : b64ToUint8Array(va.wasm);

  const mod = await WebAssembly.compile(wasmBytes);
  const inst = await WebAssembly.instantiate(mod, {});
  const ex = inst.exports as any;
  const enc = b64ToUint8Array(j.data.stream_urls);
  const ptr = ex.alloc(enc.length);
  new Uint8Array(ex.memory.buffer, ptr, enc.length).set(enc);
  const outLen = ex.decrypt(ptr, enc.length);
  const decrypted = new TextDecoder().decode(
    new Uint8Array(ex.memory.buffer, ptr + 12, outLen)
  );
  const rawUrls = decrypted.split('\n').filter(Boolean);
  if (!rawUrls.length) throw new Error(`step5 rawUrls empty in ${Date.now() - t4}ms`);

  // 6. Request host play token from origin /generate.php
  const t5 = Date.now();
  const origin = new URL(rawUrls[0]).origin;
  const genUrl = `${origin}/generate.php?api_token=${encodeURIComponent(config.apiToken)}`;
  const genRes = await fetch(genUrl, {
    headers: {
      'User-Agent': UA,
      Referer: src,
      Origin: 'https://nextgencloudfabric.com',
    },
  });
  const token = (await genRes.text()).trim();

  const directStreamUrl =
    rawUrls[0] + (rawUrls[0].includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token);

  return {
    streamUrl: directStreamUrl,
    imdbId: j.data.imdb_id,
    title: j.data.title,
    timings: `s1:${step1Time}ms s2:${step2Time}ms s3:${step3Time}ms`,
  };
}

async function fetchEnglishSubtitles(imdbId?: string) {
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

    // Take top 3 English subtitle tracks
    return json.slice(0, 3).map((sub, idx) => ({
      url: `/api/subtitles?url=${encodeURIComponent(sub.SubDownloadLink)}`,
      lang: 'en',
      label: idx === 0 ? 'English (Full)' : `English (${sub.SubFormat.toUpperCase()})`,
    }));
  } catch {
    return [];
  }
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

  const id = tmdbId || imdbId || '';
  const fallbackEmbedUrl = `https://vidsrc.cc/v2/embed/movie/${id}?autoPlay=false`;

  let autoEmbedError: string | null = null;
  // 1. Primary Scraper: AutoEmbed Direct HLS Extraction
  try {
    const autoEmbedResult = await Promise.race([
      scrapeAutoEmbedStream(id, type),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Timeout after 9000ms')), 9000)),
    ]);

    if (autoEmbedResult && autoEmbedResult.streamUrl) {
      const proxiedStreamUrl = `/api/proxy?url=${encodeURIComponent(
        autoEmbedResult.streamUrl
      )}&referer=${encodeURIComponent('https://nextgencloudfabric.com/')}`;

      const subtitles = await fetchEnglishSubtitles(autoEmbedResult.imdbId || imdbId || undefined);

      const result: StreamResult = {
        success: true,
        provider: 'AutoEmbed Direct HLS',
        streamUrl: proxiedStreamUrl,
        subtitles,
        fallbackEmbedUrl,
      };

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=1800',
        },
      });
    }
  } catch (err: any) {
    autoEmbedError = err?.message || String(err);
  }

  // 2. Secondary Scrapers: VidSrc / MultiEmbed
  const backupProviders = [
    {
      name: 'VidSrc Direct',
      resolve: async () => {
        const res = await fetch(`https://vidsrc.xyz/embed/movie/${id}`, {
          headers: { 'User-Agent': UA },
        });
        if (!res.ok) return null;
        const html = await res.text();
        const m3u8Match = html.match(/https?:\/\/[^"']+\.m3u8[^"']*/);
        return m3u8Match ? m3u8Match[0] : null;
      },
    },
    {
      name: 'SuperEmbed Direct',
      resolve: async () => {
        const res = await fetch(`https://multiembed.mov/?video_id=${id}&tmdb=1`, {
          headers: { 'User-Agent': UA },
        });
        if (!res.ok) return null;
        const html = await res.text();
        const m3u8Match = html.match(/https?:\/\/[^"']+\.m3u8[^"']*/);
        return m3u8Match ? m3u8Match[0] : null;
      },
    },
  ];

  for (const provider of backupProviders) {
    try {
      const rawM3u8 = await Promise.race([
        provider.resolve(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
      ]);

      if (rawM3u8) {
        const proxiedStreamUrl = `/api/proxy?url=${encodeURIComponent(rawM3u8)}`;
        const subtitles = await fetchEnglishSubtitles(imdbId || undefined);

        const result: StreamResult = {
          success: true,
          provider: provider.name,
          streamUrl: proxiedStreamUrl,
          subtitles,
          fallbackEmbedUrl,
        };

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=1800',
          },
        });
      }
    } catch {
      // Continue
    }
  }

  // 3. Graceful Fallback to Embed Player if direct streams cannot be resolved
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
