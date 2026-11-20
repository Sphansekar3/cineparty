// Cloudflare Pages Function: Universal Subtitle Fetcher & VTT Converter
// Downloads .gz or .srt from OpenSubtitles, decompresses, converts to WebVTT, and serves with CORS

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
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Missing subtitle url parameter' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  try {
    const upstreamRes = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    });

    if (!upstreamRes.ok || !upstreamRes.body) {
      return new Response('Failed to download subtitle', { status: upstreamRes.status });
    }

    let srtText = '';
    if (targetUrl.endsWith('.gz') || upstreamRes.headers.get('content-type')?.includes('gzip')) {
      const ds = new DecompressionStream('gzip');
      const decompressed = upstreamRes.body.pipeThrough(ds);
      srtText = await new Response(decompressed).text();
    } else {
      srtText = await upstreamRes.text();
    }

    // Convert SRT to WebVTT
    // Replace comma in timestamps: 00:01:14,908 --> 00:01:17,094
    let vttText = 'WEBVTT\n\n' + srtText.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');

    return new Response(vttText, {
      status: 200,
      headers: {
        'Content-Type': 'text/vtt; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: 'Subtitle proxy error',
        message: err?.message || String(err),
      }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}
