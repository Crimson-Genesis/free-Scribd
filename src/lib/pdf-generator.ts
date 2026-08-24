import { DocMetadata, ProcessingStep } from '../types';

export function validateUrl(url: string): { valid: boolean; message?: string } {
  if (!url || url.trim() === '') {
    return { valid: false, message: 'Please enter a valid Scribd document URL or upload an HTML file' };
  }
  
  const trimmed = url.trim();
  if (trimmed.startsWith('<') || trimmed.includes('<!DOCTYPE') || trimmed.includes('scribdassets.com')) {
    return { valid: true };
  }

  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, message: 'URL must start with http:// or https://' };
    }

    if (!parsed.hostname.includes('scribd.com') && !parsed.hostname.includes('scribdassets.com')) {
      return { valid: false, message: 'Please enter a valid Scribd URL (e.g. https://www.scribd.com/document/...)' };
    }

    if (!parsed.pathname.includes('/document/') && !parsed.pathname.includes('/doc/')) {
      return { valid: false, message: 'Link must be a Scribd document page (e.g. https://www.scribd.com/document/873509383/...)' };
    }

    return { valid: true };
  } catch (err) {
    return { valid: false, message: 'Invalid URL format. Example: https://www.scribd.com/document/873509383/Top-10-Engineering-Colleges-AP-EAMCET' };
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

/**
 * Main engine processing Scribd URL, uploaded HTML file (pdf.html / pdf1.html), or sample guide.
 */
export async function processScribdContent(
  input: string | File,
  onProgress: (step: ProcessingStep, progress: number, message: string) => void
): Promise<DocMetadata> {
  let docTitle = 'Scribd_Document';
  let payload: { url?: string; htmlContent?: string } = {};

  // Step 1: Validating URL & fetching page metadata
  onProgress('validating', 15, 'Validating Scribd URL & initializing Python PDF engine...');
  await new Promise((r) => setTimeout(r, 200));

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      docTitle = extractTitleFromUrl(trimmed);
      payload = { url: trimmed };
    } else {
      docTitle = extractTitleFromHtml(trimmed) || 'Scribd_Document';
      payload = { htmlContent: trimmed };
    }
  } else if (input instanceof File) {
    docTitle = input.name.replace(/\.[^/.]+$/, '');
    const text = await input.text();
    payload = { htmlContent: text };
  }

  // Step 2: Extracting Scribd Assets & JSONPs via Python Engine
  onProgress('extracting', 40, 'Extracting page JSONPs, high-res images & multi-language vector fonts...');

  // Step 3: Compiling PDF layout using Python Engine
  onProgress('compiling', 75, 'Rendering 1:1 PDF pages with Noto font & original images...');

  const apiRes = await fetch('/api/process-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!apiRes.ok) {
    const errorData = await apiRes.json().catch(() => ({ error: 'PDF generation failed' }));
    throw new Error(errorData.error || `HTTP ${apiRes.status}: Failed to generate PDF`);
  }

  const data = await apiRes.json();
  if (!data.pdfBase64) {
    throw new Error(data.error || 'Server did not return PDF output data');
  }

  // Convert Base64 data URL to Blob
  const base64Data = data.pdfBase64.split(',')[1];
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const pdfBlob = new Blob([bytes], { type: 'application/pdf' });
  const pdfUrl = URL.createObjectURL(pdfBlob);
  const sizeBytes = pdfBlob.size;
  const actualPageCount = data.pageCount || 1;

  // Step 4: Ready
  onProgress('completed', 100, `PDF compilation complete! Generated ${actualPageCount} page PDF (${formatBytes(sizeBytes)}).`);

  return {
    title: docTitle,
    docId: 'doc_' + Math.random().toString(36).substring(2, 8),
    pageCount: actualPageCount,
    sizeBytes,
    formattedSize: formatBytes(sizeBytes),
    pdfUrl,
    pdfBlob,
    pages: [],
    createdAt: new Date().toLocaleTimeString(),
  };
}

function extractTitleFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length >= 2 && (parts[0] === 'doc' || parts[0] === 'document')) {
      return parts[parts.length - 1].replace(/-/g, ' ') || parts[1];
    }
    return parts[parts.length - 1] || 'Scribd_Document';
  } catch {
    return 'Scribd_Document';
  }
}

function extractTitleFromHtml(html: string): string | null {
  const match = html.match(/<title>(.*?)<\/title>/i);
  if (match && match[1]) {
    return match[1].replace(/[\|-]\s*Scribd.*$/i, '').trim();
  }
  return null;
}
