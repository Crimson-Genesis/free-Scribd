import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { DocMetadata, ProcessingStep, PageAsset, ImageSpec, TextItem, BotChallengeInfo } from '../types';

export class ScribdBotChallengeError extends Error {
  info: BotChallengeInfo;
  constructor(info: BotChallengeInfo) {
    super(info.message || 'Scribd Bot Challenge Detected');
    this.name = 'ScribdBotChallengeError';
    this.info = info;
  }
}

export function sanitizeUrl(url: string): string {
  if (!url) return '';
  return url.replace(/#.*$/, '').trim();
}

export function validateUrl(url: string): { valid: boolean; message?: string } {
  if (!url || url.trim() === '') {
    return { valid: false, message: 'Please enter a valid Scribd document URL or upload an HTML file' };
  }

  const trimmed = url.trim();
  if (
    trimmed.startsWith('<') ||
    trimmed.includes('<!DOCTYPE') ||
    trimmed.includes('scribdassets.com') ||
    trimmed.includes('jsonp') ||
    trimmed.includes('newpage')
  ) {
    return { valid: true };
  }

  try {
    const clean = sanitizeUrl(trimmed);
    const parsed = new URL(clean);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, message: 'URL must start with http:// or https://' };
    }

    if (!parsed.hostname.includes('scribd.com') && !parsed.hostname.includes('scribdassets.com')) {
      return { valid: false, message: 'Please enter a valid Scribd URL (e.g. https://www.scribd.com/document/...)' };
    }

    if (!parsed.pathname.includes('/document/') && !parsed.pathname.includes('/doc/') && !parsed.pathname.includes('/embeds/')) {
      return { valid: false, message: 'Link must be a Scribd document page (e.g. https://www.scribd.com/document/876667391/...)' };
    }

    return { valid: true };
  } catch {
    return { valid: false, message: 'Invalid URL format. Example: https://www.scribd.com/document/876667391/Advanced-Pharmacology-2-Unit-1-M-Pharm-1' };
  }
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function extractTitleFromUrl(url: string): string {
  try {
    const clean = sanitizeUrl(url);
    const u = new URL(clean);
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length >= 2 && (parts[0] === 'doc' || parts[0] === 'document')) {
      return decodeURIComponent(parts[parts.length - 1]).replace(/[-_]/g, ' ') || parts[1];
    }
    return parts[parts.length - 1] || 'Scribd_Document';
  } catch {
    return 'Scribd_Document';
  }
}

export function extractTitleFromHtml(html: string): string | null {
  const match = html.match(/<title>(.*?)<\/title>/i);
  if (match && match[1]) {
    const raw = match[1].replace(/[\|-]\s*Scribd.*$/i, '').trim();
    if (raw && !raw.includes('Client Challenge') && !raw.includes('Attention Required')) {
      return raw;
    }
  }
  return null;
}

export function extractDocId(url: string): string {
  const clean = sanitizeUrl(url);
  const match = clean.match(/(?:document|doc|embeds)\/(\d+)/);
  return match ? match[1] : '';
}

interface ParsedPageRef {
  docId: string;
  pageNum: number;
  hash: string;
  url: string;
}

export function extractPagesFromHtml(html: string): { pages: ParsedPageRef[]; token: string; title: string } {
  const tokenMatch = html.match(/token=([A-Za-z0-9\._\-]+)/);
  const token = tokenMatch ? tokenMatch[1] : '';

  const title = extractTitleFromHtml(html) || 'Scribd_Document';

  const jsonpRegex = /https?:\/\/html\.scribdassets\.com\/([^/]+)\/pages\/(\d+)-([a-f0-9]+)\.jsonp/gi;
  const pagesDict: Record<number, ParsedPageRef> = {};
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

  const sortedNums = Object.keys(pagesDict).map(Number).sort((a, b) => a - b);
  const pages = sortedNums.map((p) => pagesDict[p]);

  return { pages, token, title };
}

function parsePageJsonp(text: string, docId: string, pageNum: number, pageHash: string, token: string): PageAsset {
  const jsonStart = text.indexOf('[');
  const jsonEnd = text.lastIndexOf(']');
  let pWidth = 878;
  let pHeight = 1168;
  const imgSpecs: ImageSpec[] = [];
  const textItems: TextItem[] = [];

  if (jsonStart !== -1 && jsonEnd !== -1) {
    try {
      const jsonStr = text.substring(jsonStart, jsonEnd + 1);
      const htmlStr = JSON.parse(jsonStr)[0];

      const widthMatch = htmlStr.match(/width:\s*(\d+)px/);
      const heightMatch = htmlStr.match(/height:\s*(\d+)px/);
      if (widthMatch) pWidth = parseFloat(widthMatch[1]);
      if (heightMatch) pHeight = parseFloat(heightMatch[1]);

      // Parse absimg images
      const imgRegex = /<img[^>]*class=["']?[^"'>]*absimg[^"'>]*["']?[^>]*>/gi;
      let imgMatch;
      while ((imgMatch = imgRegex.exec(htmlStr)) !== null) {
        const tag = imgMatch[0];
        const origMatch = tag.match(/orig=["']([^"']+)["']/i) || tag.match(/src=["']([^"']+)["']/i);
        if (!origMatch) continue;

        let origUrl = origMatch[1]
          .replace('http://html.scribd.com', 'https://html.scribdassets.com')
          .replace('http://html.scribdassets.com', 'https://html.scribdassets.com');
        if (token && !origUrl.includes('token=')) {
          origUrl += (origUrl.includes('?') ? '&' : '?') + `token=${token}`;
        }

        const styleMatch = tag.match(/style=["']([^"']+)["']/i);
        const style = styleMatch ? styleMatch[1] : '';

        const leftMatch = style.match(/left:\s*(-?\d+)px/);
        const topMatch = style.match(/top:\s*(-?\d+)px/);
        const wMatch = style.match(/width:\s*(\d+)px/);
        const hMatch = style.match(/height:\s*(\d+)px/);
        const clipMatch = style.match(/rect\s*\(\s*(-?\d+)px\s+(-?\d+)px\s+(-?\d+)px\s+(-?\d+)px\s*\)/);

        const left = leftMatch ? parseFloat(leftMatch[1]) : 0;
        const top = topMatch ? parseFloat(topMatch[1]) : 0;
        const width = wMatch ? parseFloat(wMatch[1]) : 0;
        const height = hMatch ? parseFloat(hMatch[1]) : 0;

        let clip = null;
        if (clipMatch) {
          clip = {
            top: parseInt(clipMatch[1], 10),
            right: parseInt(clipMatch[2], 10),
            bottom: parseInt(clipMatch[3], 10),
            left: parseInt(clipMatch[4], 10),
          };
        }

        imgSpecs.push({ url: origUrl, left, top, width, height, clip });
      }

      // Parse text items (scale factor 0.2)
      const spanRegex = /<span[^>]*style=["']([^"']+)["'][^>]*>(.*?)<\/span>/gi;
      let spanMatch;
      while ((spanMatch = spanRegex.exec(htmlStr)) !== null) {
        const style = spanMatch[1];
        const rawText = spanMatch[2].replace(/<[^>]+>/g, '');

        const leftM = style.match(/left:\s*(-?\d+)px/);
        const topM = style.match(/top:\s*(-?\d+)px/);
        if (leftM || topM) {
          const left = leftM ? parseFloat(leftM[1]) * 0.2 : 0;
          const top = topM ? parseFloat(topM[1]) * 0.2 : 0;
          const cleanText = rawText
            .split('')
            .filter((c) => {
              const code = c.charCodeAt(0);
              return code < 0xe000 || code > 0xf8ff;
            })
            .join('')
            .trim();

          if (cleanText) {
            textItems.push({ left, top, fontSize: 13, text: cleanText });
          }
        }
      }
    } catch {}
  }

  // Fallback whole-page image if no absimg layers
  if (imgSpecs.length === 0) {
    const fallbackUrl = `https://html.scribdassets.com/${docId}/images/${pageNum}-${pageHash}.jpg${token ? `?token=${token}` : ''}`;
    imgSpecs.push({
      url: fallbackUrl,
      left: 0,
      top: 0,
      width: pWidth,
      height: pHeight,
      clip: null,
    });
  }

  return { pageNum, width: pWidth, height: pHeight, imgSpecs, textItems };
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      // If direct cross-origin fails, try via proxy endpoint
      const proxyUrl = `/api/process-pdf?url=${encodeURIComponent(url)}`;
      const fallbackImg = new Image();
      fallbackImg.crossOrigin = 'anonymous';
      fallbackImg.onload = () => resolve(fallbackImg);
      fallbackImg.onerror = () => resolve(null);
      fallbackImg.src = proxyUrl;
    };
    img.src = url;
  });
}

async function renderPageToCanvas(page: PageAsset): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(page.width);
  canvas.height = Math.round(page.height);
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // Fill clean white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw images
    for (const spec of page.imgSpecs) {
      const img = await loadImage(spec.url);
      if (!img) continue;

      try {
        if (spec.clip) {
          const c = spec.clip;
          const naturalW = img.naturalWidth || img.width;
          const naturalH = img.naturalHeight || img.height;

          const sx = Math.max(0, Math.min(c.left, naturalW));
          const sy = Math.max(0, Math.min(c.top, naturalH));
          const sw = Math.max(0, Math.min(c.right - c.left, naturalW - sx));
          const sh = Math.max(0, Math.min(c.bottom - c.top, naturalH - sy));

          const dw = spec.width > 0 ? spec.width : sw;
          const dh = spec.height > 0 ? spec.height : sh;

          if (sw > 0 && sh > 0) {
            ctx.drawImage(img, sx, sy, sw, sh, spec.left, spec.top, dw, dh);
          }
        } else {
          const dw = spec.width > 0 ? spec.width : img.naturalWidth || img.width;
          const dh = spec.height > 0 ? spec.height : img.naturalHeight || img.height;
          ctx.drawImage(img, spec.left, spec.top, dw, dh);
        }
      } catch {}
    }

    // Draw visible text items
    ctx.fillStyle = '#000000';
    ctx.textBaseline = 'top';
    for (const item of page.textItems) {
      ctx.font = `${Math.max(8, Math.round(item.fontSize))}px sans-serif`;
      ctx.fillText(item.text, item.left, item.top);
    }
  }

  // Convert canvas to JPEG byte array
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function compilePdfFromPages(
  pageAssets: PageAsset[],
  docTitle: string,
  onProgress: (step: ProcessingStep, progress: number, message: string) => void
): Promise<{ pdfBlob: Blob; pdfUrl: string; sizeBytes: number; pageCount: number }> {
  const pdfDoc = await PDFDocument.create();
  let font;
  try {
    font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  } catch {}

  const total = pageAssets.length;

  for (let i = 0; i < total; i++) {
    const pageAsset = pageAssets[i];
    const progress = 60 + Math.round(((i + 1) / total) * 35);
    onProgress('compiling', progress, `Rendering 1:1 canvas page ${i + 1} of ${total}...`);

    const jpegBytes = await renderPageToCanvas(pageAsset);
    const embeddedImg = await pdfDoc.embedJpg(jpegBytes);

    const pdfPage = pdfDoc.addPage([pageAsset.width, pageAsset.height]);
    pdfPage.drawImage(embeddedImg, {
      x: 0,
      y: 0,
      width: pageAsset.width,
      height: pageAsset.height,
    });

    // Embed invisible selectable text layer for Ctrl+F search & copy
    if (font && pageAsset.textItems.length > 0) {
      for (const item of pageAsset.textItems) {
        try {
          const pdfY = pageAsset.height - item.top - item.fontSize;
          pdfPage.drawText(item.text, {
            x: item.left,
            y: Math.max(0, pdfY),
            size: Math.max(6, item.fontSize),
            font,
            opacity: 0, // Invisible overlay directly above rendered image
          });
        } catch {}
      }
    }
  }

  onProgress('compiling', 98, 'Finalizing standalone PDF document bytes...');
  const pdfBytes = await pdfDoc.save();
  const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
  const pdfUrl = URL.createObjectURL(pdfBlob);

  return {
    pdfBlob,
    pdfUrl,
    sizeBytes: pdfBlob.size,
    pageCount: total,
  };
}

/**
 * Main engine processing Scribd URL, uploaded HTML file, or pasted source code.
 */
export async function processScribdContent(
  input: string | File,
  onProgress: (step: ProcessingStep, progress: number, message: string) => void
): Promise<DocMetadata> {
  let docTitle = 'Scribd_Document';
  let docId = '';
  let htmlContent = '';
  let rawUrl = '';

  onProgress('validating', 10, 'Analyzing document source & validating parameters...');

  if (input instanceof File) {
    docTitle = input.name.replace(/\.[^/.]+$/, '');
    htmlContent = await input.text();
  } else if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      rawUrl = sanitizeUrl(trimmed);
      docTitle = extractTitleFromUrl(rawUrl);
      docId = extractDocId(rawUrl);
    } else {
      htmlContent = trimmed;
      docTitle = extractTitleFromHtml(trimmed) || 'Scribd_Document';
    }
  }

  // Case 1: Raw URL passed - Query backend API to fetch page manifests
  if (rawUrl) {
    onProgress('validating', 20, `Fetching document metadata for "${docTitle}"...`);

    let apiData: any = null;
    try {
      const apiRes = await fetch('/api/process-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: rawUrl }),
      });

      if (apiRes.ok) {
        apiData = await apiRes.json();
      }
    } catch {}

    // Check if Scribd Bot Protection was flagged
    if (apiData && apiData.botChallenge) {
      throw new ScribdBotChallengeError({
        docId: apiData.docId || docId,
        title: apiData.title || docTitle,
        scribdUrl: rawUrl,
        thumbnailUrl: apiData.thumbnailUrl,
        pageCount: apiData.pageCount || 37,
        message: apiData.message,
      });
    }

    if (apiData && apiData.success && apiData.pages && apiData.pages.length > 0) {
      // Backend found page JSONPs directly
      return await compileFromPageRefs(apiData.pages, apiData.token || '', apiData.title || docTitle, apiData.docId || docId, onProgress);
    }

    // If API returned nothing or failed, but it is a Scribd link, check if we can query oEmbed
    let oembedTitle = docTitle;
    let oembedThumb = '';
    try {
      const oembedRes = await fetch(`https://www.scribd.com/services/oembed?url=${encodeURIComponent(rawUrl)}&format=json`);
      if (oembedRes.ok) {
        const odata: any = await oembedRes.json();
        if (odata.title) oembedTitle = odata.title;
        if (odata.thumbnail_url) oembedThumb = odata.thumbnail_url;
      }
    } catch {}

    // Direct automated scraping is restricted by Scribd Cloudflare / Kasada verification
    throw new ScribdBotChallengeError({
      docId,
      title: oembedTitle || docTitle,
      scribdUrl: rawUrl,
      thumbnailUrl: oembedThumb,
      pageCount: 37,
      message: 'Scribd Bot Verification Active for this document.',
    });
  }

  // Case 2: HTML Content passed (from uploaded file or pasted DOM source)
  onProgress('extracting', 25, 'Parsing Scribd HTML manifest & JSONP links...');
  const { pages, token, title } = extractPagesFromHtml(htmlContent);
  const finalTitle = title || docTitle;

  if (pages.length === 0) {
    throw new Error(
      'No Scribd page assets found in the provided HTML. Make sure you opened the document on Scribd and saved the page via Ctrl+S (Webpage, Complete).'
    );
  }

  return await compileFromPageRefs(pages, token, finalTitle, docId || pages[0].docId, onProgress);
}

async function compileFromPageRefs(
  pages: ParsedPageRef[],
  token: string,
  docTitle: string,
  docId: string,
  onProgress: (step: ProcessingStep, progress: number, message: string) => void
): Promise<DocMetadata> {
  const total = pages.length;
  onProgress('extracting', 30, `Fetching ${total} document page JSONPs & layers in parallel...`);

  // Fetch JSONPs
  const pageAssets: PageAsset[] = [];
  const concurrency = 6;

  for (let i = 0; i < total; i += concurrency) {
    const chunk = pages.slice(i, i + concurrency);
    const chunkPromises = chunk.map(async (p) => {
      try {
        const resp = await fetch(p.url, { mode: 'cors' });
        if (resp.ok) {
          const text = await resp.text();
          return parsePageJsonp(text, p.docId, p.pageNum, p.hash, token);
        }
      } catch {}

      // Fallback if direct fetch blocked
      try {
        const proxyUrl = `/api/process-pdf?url=${encodeURIComponent(p.url)}`;
        const resp = await fetch(proxyUrl);
        if (resp.ok) {
          const text = await resp.text();
          return parsePageJsonp(text, p.docId, p.pageNum, p.hash, token);
        }
      } catch {}

      // Fallback single image
      return parsePageJsonp('', p.docId, p.pageNum, p.hash, token);
    });

    const results = await Promise.all(chunkPromises);
    for (const r of results) {
      if (r) pageAssets.push(r);
    }

    const progress = 30 + Math.round(((i + chunk.length) / total) * 30);
    onProgress('extracting', progress, `Extracted assets for ${pageAssets.length} of ${total} pages...`);
  }

  pageAssets.sort((a, b) => a.pageNum - b.pageNum);

  // Compile 1:1 PDF using client-side canvas & pdf-lib
  const { pdfBlob, pdfUrl, sizeBytes, pageCount } = await compilePdfFromPages(pageAssets, docTitle, onProgress);

  onProgress('completed', 100, `PDF compilation complete! Generated ${pageCount} page PDF (${formatBytes(sizeBytes)}).`);

  return {
    title: docTitle,
    docId: docId || 'doc_' + Math.random().toString(36).substring(2, 8),
    pageCount,
    sizeBytes,
    formattedSize: formatBytes(sizeBytes),
    pdfUrl,
    pdfBlob,
    pages: pageAssets,
    createdAt: new Date().toLocaleTimeString(),
  };
}
