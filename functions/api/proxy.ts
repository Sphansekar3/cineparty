// Cloudflare Pages Function: Universal CORS & HLS Video Proxy
// Proxies .m3u8 manifests and video segments (.ts, .m4s) with header rewriting

export async function onRequest(context: { request: Request }): Promise<Response> {
  const { request } = context;

  // Handle CORS preflight
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
  const customReferer = url.searchParams.get('referer');

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Missing target url parameter' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  try {
    const parsedTarget = new URL(targetUrl);
    const origin = parsedTarget.origin;

    const requestHeaders = new Headers();
    requestHeaders.set(
      'User-Agent',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );
    requestHeaders.set('Accept', '*/*');
    requestHeaders.set('Accept-Language', 'en-US,en;q=0.9');
    requestHeaders.set('Referer', customReferer || origin);
    requestHeaders.set('Origin', origin);

    // Forward range header for video seeking
    const rangeHeader = request.headers.get('range');
    if (rangeHeader) {
      requestHeaders.set('Range', rangeHeader);
    }

    const upstreamResponse = await fetch(targetUrl, {
      method: request.method,
      headers: requestHeaders,
      redirect: 'follow',
    });

    const contentType = upstreamResponse.headers.get('content-type') || '';
    const isM3u8 =
      targetUrl.includes('.m3u8') ||
      contentType.includes('mpegurl') ||
      contentType.includes('application/x-mpegURL');

    // Prepare response headers
    const responseHeaders = new Headers(upstreamResponse.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', '*');
    responseHeaders.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range');

    // If it's an HLS playlist, rewrite internal segment & sub-playlist URLs
    if (isM3u8 && upstreamResponse.status === 200) {
      const manifestText = await upstreamResponse.text();
      const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);

      const rewrittenManifest = manifestText
        .split('\n')
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) {
            // Check for URI inside tags like #EXT-X-KEY:METHOD=...,URI="..."
            if (trimmed.startsWith('#EXT-X-KEY:') && trimmed.includes('URI="')) {
              return trimmed.replace(/URI="([^"]+)"/, (_, keyUri) => {
                const absKeyUrl = keyUri.startsWith('http') ? keyUri : new URL(keyUri, baseUrl).href;
                const proxied = `/api/proxy?url=${encodeURIComponent(absKeyUrl)}${
                  customReferer ? `&referer=${encodeURIComponent(customReferer)}` : ''
                }`;
                return `URI="${proxied}"`;
              });
            }
            return line;
          }

          // Line is a segment (.ts / .m4s) or variant playlist (.m3u8)
          let absUrl = trimmed;
          if (!absUrl.startsWith('http://') && !absUrl.startsWith('https://')) {
            absUrl = new URL(trimmed, baseUrl).href;
          }

          const proxyParam = `/api/proxy?url=${encodeURIComponent(absUrl)}${
            customReferer ? `&referer=${encodeURIComponent(customReferer)}` : ''
          }`;
          return proxyParam;
        })
        .join('\n');

      responseHeaders.set('Content-Type', 'application/vnd.apple.mpegurl');
      return new Response(rewrittenManifest, {
        status: 200,
        headers: responseHeaders,
      });
    }

    // Binary video chunk stream (.ts, .m4s, etc.)
    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: 'Proxy request failed',
        message: error?.message || String(error),
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
