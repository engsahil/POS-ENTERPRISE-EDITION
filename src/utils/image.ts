/**
 * Client-side image optimisation.
 *
 * Logos are downscaled and re-encoded in the browser before they ever reach
 * the database, so a 4 MB camera photo is stored as a few kilobytes. Doing
 * this locally keeps the app offline-first and avoids shipping an image
 * library — canvas is built in.
 */

/** Longest edge of a stored logo, in CSS pixels. Ample for screen + receipt. */
export const LOGO_MAX_EDGE = 512;

/** Longest edge of a menu item photo. Smaller: it renders as a POS tile. */
export const ITEM_IMAGE_MAX_EDGE = 400;

/** Reject absurd uploads early, before decoding. */
export const LOGO_MAX_SOURCE_BYTES = 8 * 1024 * 1024;

export const LOGO_ACCEPTED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'image/gif',
] as const;

export interface OptimisedImage {
  dataUrl: string;
  type: string;
  width: number;
  height: number;
  bytes: number;
}

/** Approximate decoded byte length of a base64 data URL. */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  if (comma === -1) return 0;
  const body = dataUrl.slice(comma + 1);
  if (!dataUrl.slice(0, comma).includes(';base64')) {
    return new Blob([decodeURIComponent(body)]).size;
  }
  const padding = body.endsWith('==') ? 2 : body.endsWith('=') ? 1 : 0;
  return Math.floor((body.length * 3) / 4) - padding;
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the image file.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('That file is not a valid image.'));
    img.src = src;
  });
}

function canvasToDataUrl(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): string {
  const url = canvas.toDataURL(type, quality);
  // Browsers silently fall back to PNG for unsupported types.
  return url.startsWith(`data:${type}`) ? url : '';
}

/**
 * Downscale to fit `maxEdge` and re-encode.
 *
 * WebP is preferred and PNG is used as the fallback; whichever encodes
 * smaller wins. Transparency is preserved (no white matte is painted).
 * SVGs are already vector data and are passed through untouched.
 */
export async function optimiseImage(
  file: File,
  maxEdge: number = LOGO_MAX_EDGE,
): Promise<OptimisedImage> {
  if (file.size > LOGO_MAX_SOURCE_BYTES) {
    throw new Error('That image is larger than 8 MB. Please choose a smaller file.');
  }

  const sourceUrl = await readAsDataUrl(file);

  // Vector art: keep as-is, it is already tiny and resolution-independent.
  if (file.type === 'image/svg+xml') {
    return {
      dataUrl: sourceUrl,
      type: 'image/svg+xml',
      width: 0,
      height: 0,
      bytes: dataUrlBytes(sourceUrl),
    };
  }

  const img = await loadImage(sourceUrl);
  const sourceW = img.naturalWidth || img.width;
  const sourceH = img.naturalHeight || img.height;

  if (!sourceW || !sourceH) {
    throw new Error('That file is not a valid image.');
  }

  const scale = Math.min(1, maxEdge / Math.max(sourceW, sourceH));
  const width = Math.max(1, Math.round(sourceW * scale));
  const height = Math.max(1, Math.round(sourceH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image processing is not available in this browser.');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  const candidates = [
    { url: canvasToDataUrl(canvas, 'image/webp', 0.86), type: 'image/webp' },
    { url: canvasToDataUrl(canvas, 'image/png', 1), type: 'image/png' },
  ].filter((c) => c.url.length > 0);

  if (candidates.length === 0) {
    throw new Error('This browser could not process that image.');
  }

  // Pick the smallest successful encoding.
  const best = candidates.reduce((a, b) => (b.url.length < a.url.length ? b : a));

  return {
    dataUrl: best.url,
    type: best.type,
    width,
    height,
    bytes: dataUrlBytes(best.url),
  };
}

/** Optimise an image for use as the restaurant logo. */
export function optimiseLogo(file: File): Promise<OptimisedImage> {
  return optimiseImage(file, LOGO_MAX_EDGE);
}

/** Human-readable byte size, e.g. "24.3 KB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}
