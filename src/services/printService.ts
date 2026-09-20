/**
 * Browser printing for thermal receipts.
 *
 * Drives the browser's own print pipeline (window.print). This is genuinely
 * different from speaking ESC/POS to a printer directly:
 *
 *   - Browser printing renders the receipt as a PAGE and hands it to the OS
 *     print system, which rasterises it for the printer driver. It depends on
 *     the user picking the right printer and paper size in the OS dialog, and
 *     the browser may still apply its own scaling or margins.
 *   - ESC/POS (see escpos.ts) sends command BYTES straight to the device with
 *     no dialog, no driver rasterisation and no scaling.
 *
 * Both are supported. Neither is a substitute for the other.
 */

import type { ReceiptWidth } from './receiptService';

const PAGE_STYLE_ID = 'thermal-page-size';

/** Millimetres per CSS pixel at 96dpi. */
const MM_PER_PX = 25.4 / 96;

/**
 * Measured height of the receipt in millimetres, rounded up.
 *
 * A small tail is added so the last line is never shaved off by rounding,
 * but it is kept tight (2mm) so no meaningful blank space is fed.
 */
export function measureHeightMm(element: HTMLElement | null): number {
  if (!element) return 200;
  const px = Math.max(element.scrollHeight, element.getBoundingClientRect().height);
  return Math.max(20, Math.ceil(px * MM_PER_PX) + 2);
}

/**
 * Inject an `@page` rule matching the paper.
 *
 * Both page dimensions must be explicit lengths. `size: <width> auto` looks
 * reasonable but is INVALID CSS: browsers silently drop the whole descriptor,
 * leaving the print job on the default Letter/A4 sheet with the receipt
 * stranded in a corner. Verified against Chromium's CSSOM, which reports
 * `@page { margin: 0px }` for the `auto` form and keeps `size` only when two
 * lengths are given.
 *
 * The height is therefore measured from the rendered receipt, which also
 * keeps the roll exactly as long as the content: no trailing blank page.
 */
export function applyPageSize(width: ReceiptWidth, heightMm: number): void {
  const existing = document.getElementById(PAGE_STYLE_ID);
  if (existing) existing.remove();

  const style = document.createElement('style');
  style.id = PAGE_STYLE_ID;
  style.media = 'print';
  style.textContent = `@page { size: ${width} ${heightMm}mm; margin: 0; }`;
  document.head.appendChild(style);
}

export function clearPageSize(): void {
  document.getElementById(PAGE_STYLE_ID)?.remove();
}

export interface PrintOptions {
  width: ReceiptWidth;
  /** Element containing the receipt to print. */
  container: HTMLElement | null;
}

/**
 * Print the receipt.
 *
 * The container is marked `print-root`, which the print stylesheet uses to
 * strip every other top-level subtree from the printed flow. The element is
 * temporarily moved to be a direct child of <body> so that no scrollable or
 * clipping ancestor can truncate a long receipt to one screen height.
 */
export function printReceipt({ width, container }: PrintOptions): void {
  if (!container) {
    window.print();
    return;
  }

  const parent = container.parentElement;
  const marker = document.createComment('receipt-print-placeholder');

  // Remember where it came from so the UI is restored exactly.
  if (parent) parent.insertBefore(marker, container);

  container.classList.add('print-root');
  document.body.appendChild(container);

  // Measure AFTER re-parenting: the container is now free of any scrollable
  // ancestor, so scrollHeight reflects the full receipt rather than one
  // screenful.
  applyPageSize(width, measureHeightMm(container));

  const restore = () => {
    container.classList.remove('print-root');
    if (parent && marker.parentNode) {
      parent.insertBefore(container, marker);
      marker.remove();
    }
    clearPageSize();
    window.removeEventListener('afterprint', restore);
  };

  window.addEventListener('afterprint', restore);

  try {
    window.print();
  } finally {
    // Chrome fires afterprint reliably; this covers browsers that do not.
    window.setTimeout(() => {
      if (container.classList.contains('print-root')) restore();
    }, 1000);
  }
}
