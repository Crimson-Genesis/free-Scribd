export default async function handler(req: any, res: any) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  // GET: Proxy helper for CORS-restricted assets
  if (req.method === 'GET') {
    const targetUrl = req.query?.url || new URL(req.url, 'http://localhost').searchParams.get('url');
    if (!targetUrl) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Missing url query parameter' }));
    }

    try {
      const upstream = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*',
        },
      });

      if (!upstream.ok) {
        res.statusCode = upstream.status;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: `Upstream error: ${upstream.status}` }));
      }

      const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
      const buffer = await upstream.arrayBuffer();

      res.statusCode = 200;
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.end(Buffer.from(buffer));
    } catch (err: any) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: err.message || 'Proxy request failed' }));
    }
  }

  // POST: Extract metadata and page assets from Scribd URL or HTML content
  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }

    const { url, htmlContent } = body || {};

    if (!url && !htmlContent) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Missing url or htmlContent parameter' }));
    }

    try {
      let html = htmlContent || '';
      let docTitle = 'Scribd Document';
      let docId = '';
      let thumbnailUrl = '';
      let pageCount = 0;

      if (url) {
        // Sanitize URL (strip hashes like #google_vignette, query parameters)
        const sanitizedUrl = url.replace(/#.*$/, '').trim();
        const docIdMatch = sanitizedUrl.match(/(?:document|doc|embeds)\/(\d+)/);
        if (docIdMatch) {
          docId = docIdMatch[1];
        }

        // 1. Fetch metadata via Scribd oEmbed API
        try {
          const oembedUrl = `https://www.scribd.com/services/oembed?url=${encodeURIComponent(sanitizedUrl)}&format=json`;
          const oembedResp = await fetch(oembedUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
          });
          if (oembedResp.ok) {
            const oembedData: any = await oembedResp.json();
            if (oembedData.title) docTitle = oembedData.title;
            if (oembedData.thumbnail_url) thumbnailUrl = oembedData.thumbnail_url;
          }
        } catch {}

        // 2. Fetch HTML page source
        try {
          const docResp = await fetch(sanitizedUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
          });
          if (docResp.ok) {
            html = await docResp.text();
          }
        } catch {}
      }

      // Extract title from HTML if not already found
      if (html) {
        const titleMatch = html.match(/<title>(.*?)<\/title>/i);
        if (titleMatch && titleMatch[1]) {
          const raw = titleMatch[1].replace(/[\|-]\s*Scribd.*$/i, '').trim();
          if (raw && !raw.includes('Client Challenge') && !raw.includes('Attention Required')) {
            docTitle = raw;
          }
        }

        // Try extracting page count from wordDocument JSON
        const pageCountMatch = html.match(/"page_count":\s*(\d+)/);
        if (pageCountMatch) {
          pageCount = parseInt(pageCountMatch[1], 10);
        }
      }

      // Check for Kasada / Cloudflare bot challenge
      const isBotChallenge =
        html.includes('Client Challenge') ||
        html.includes('/_fs-ch-') ||
        html.includes('Attention Required! | Cloudflare') ||
        html.includes('cf-browser-verification');

      // Extract page JSONP links: https://html.scribdassets.com/{doc_id}/pages/{p_str}-{p_hash}.jsonp
      const jsonpRegex = /https?:\/\/html\.scribdassets\.com\/([^/]+)\/pages\/(\d+)-([a-f0-9]+)\.jsonp/gi;
      const pagesDict: Record<number, { docId: string; pageNum: number; hash: string; url: string }> = {};
      let match;

      while ((match = jsonpRegex.exec(html)) !== null) {
        const pNum = parseInt(match[2], 10);
        if (!pagesDict[pNum]) {
          pagesDict[pNum] = {
            docId: match[1],
            pageNum: pNum,
            hash: match[3],
            url: match[0],
          };
        }
      }

      const sortedPNums = Object.keys(pagesDict)
        .map(Number)
        .sort((a, b) => a - b);
      const pages = sortedPNums.map((p) => pagesDict[p]);

      // Extract tokens
      const tokenMatches = html.match(/token=([A-Za-z0-9\._\-]+)/);
      const token = tokenMatches ? tokenMatches[1] : '';

      if (pages.length === 0 && (isBotChallenge || (url && !htmlContent))) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(
          JSON.stringify({
            success: false,
            botChallenge: true,
            docId,
            title: docTitle,
            thumbnailUrl,
            pageCount: pageCount || 37,
            message:
              'Scribd active bot protection detected for this document. Use your browser session to save the page (Ctrl+S / Save as HTML) and upload it here to generate the 1:1 PDF.',
          })
        );
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(
        JSON.stringify({
          success: true,
          docId,
          title: docTitle,
          thumbnailUrl,
          pageCount: pages.length || pageCount,
          pages,
          token,
        })
      );
    } catch (err: any) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: err.message || 'Processing failed' }));
    }
  }

  res.statusCode = 405;
  res.setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
}
