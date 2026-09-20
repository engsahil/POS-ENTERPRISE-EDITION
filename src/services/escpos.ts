/**
 * ESC/POS command encoding.
 *
 * Produces the raw byte stream that common mini thermal printers (Epson
 * TM-series and the many compatible clones) consume directly.
 */

import type { ReceiptModel, ReceiptWidth } from './receiptService';
import { formatMoney } from '@/utils/currency';

export const COLUMNS: Record<ReceiptWidth, number> = {
  '58mm': 32,
  '80mm': 48,
};

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

export const CMD = {
  INIT: [ESC, 0x40],
  ALIGN_LEFT: [ESC, 0x61, 0],
  ALIGN_CENTER: [ESC, 0x61, 1],
  ALIGN_RIGHT: [ESC, 0x61, 2],
  BOLD_ON: [ESC, 0x45, 1],
  BOLD_OFF: [ESC, 0x45, 0],
  SIZE_NORMAL: [GS, 0x21, 0x00],
  SIZE_DOUBLE: [GS, 0x21, 0x11],
  CUT: [GS, 0x56, 66, 0x03],
  feed: (n: number) => [ESC, 0x64, n],
} as const;

export function encodeText(text: string): number[] {
  const bytes: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x80) {
      bytes.push(code);
      continue;
    }
    const replacement =
      (
        {
          '\u2018': "'",
          '\u2019': "'",
          '\u201c': '"',
          '\u201d': '"',
          '\u2013': '-',
          '\u2014': '-',
          '\u2026': '...',
          '\u00a0': ' ',
          '\u00b7': '-',
          '\u20a8': 'Rs.',
        } as Record<string, string>
      )[char] ?? '';
    for (const r of replacement) bytes.push(r.charCodeAt(0));
  }
  return bytes;
}

export function wrapText(text: string, width: number): string[] {
  if (width <= 0) return [text];
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (paragraph.trim() === '') {
      lines.push('');
      continue;
    }
    let current = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (word.length > width) {
        if (current) {
          lines.push(current);
          current = '';
        }
        let rest = word;
        while (rest.length > width) {
          lines.push(rest.slice(0, width));
          rest = rest.slice(width);
        }
        current = rest;
        continue;
      }
      if (current === '') current = word;
      else if (current.length + 1 + word.length <= width) current += ` ${word}`;
      else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines.length > 0 ? lines : [''];
}

export function twoColumns(left: string, right: string, width: number): string {
  const space = width - right.length;
  if (space <= 1) return right.slice(0, width).padStart(width);
  const trimmedLeft = left.length > space - 1 ? left.slice(0, space - 1) : left;
  return trimmedLeft + ' '.repeat(width - trimmedLeft.length - right.length) + right;
}

export function centre(text: string, width: number): string {
  if (text.length >= width) return text.slice(0, width);
  const pad = Math.floor((width - text.length) / 2);
  return ' '.repeat(pad) + text;
}

function itemColumns(width: number) {
  const qty = 3;
  const price = width >= 48 ? 9 : 6;
  const amount = width >= 48 ? 10 : 7;
  const name = width - qty - price - amount - 3;
  return { qty, price, amount, name };
}

export function renderPlainText(
  model: ReceiptModel,
  width: ReceiptWidth,
): string {
  const cols = COLUMNS[width];
  const c = itemColumns(cols);
  const out: string[] = [];
  const divider = '-'.repeat(cols);
  const money = (v: number) => formatMoney(v, { withSymbol: false });

  if (model.header.name) {
    for (const line of wrapText(model.header.name.toUpperCase(), cols)) {
      out.push(centre(line, cols));
    }
  }
  for (const value of [
    model.header.address,
    model.header.phone,
    model.header.email,
    model.header.receiptInfo,
  ]) {
    if (!value) continue;
    for (const line of wrapText(value, cols)) out.push(centre(line, cols));
  }

  out.push(divider);

  out.push(twoColumns('Order', `#${model.orderNumber}`, cols));
  out.push(twoColumns('Type', model.orderType, cols));
  if (model.tableLabel) out.push(twoColumns('Table', model.tableLabel, cols));
  if (model.customerName) out.push(twoColumns('Customer', model.customerName, cols));
  out.push(twoColumns('Date', model.date, cols));
  out.push(twoColumns('Time', model.time, cols));
  out.push(divider);

  out.push(
    'Item'.padEnd(c.name) +
      ' ' +
      'Qty'.padStart(c.qty) +
      ' ' +
      'Price'.padStart(c.price) +
      ' ' +
      'Amount'.padStart(c.amount),
  );
  out.push(divider);

  for (const line of model.lines) {
    const label =
      line.name +
      (line.sizeLabel ? ` (${line.sizeLabel})` : '') +
      (line.isDeal ? ' [DEAL]' : '');
    const nameLines = wrapText(label, c.name);

    out.push(
      (nameLines[0] ?? '').padEnd(c.name) +
        ' ' +
        String(line.quantity).padStart(c.qty) +
        ' ' +
        money(line.unitPrice).padStart(c.price) +
        ' ' +
        money(line.lineTotal).padStart(c.amount),
    );
    for (const extra of nameLines.slice(1)) out.push(extra);

    for (const t of line.toppings) {
      for (const wrapped of wrapText(`  + ${t.name} ${t.price ? `(${money(t.price)})` : ''}`, cols)) out.push(wrapped);
    }
    for (const a of line.addOns) {
      for (const wrapped of wrapText(`  + ${a.name} ${a.price ? `(${money(a.price)})` : ''}`, cols)) out.push(wrapped);
    }

    for (const content of line.dealContents) {
      for (const wrapped of wrapText(`  - ${content}`, cols)) out.push(wrapped);
    }
  }

  out.push(divider);

  out.push(twoColumns('Subtotal', formatMoney(model.subtotal), cols));
  if (model.savingsTotal > 0) {
    out.push(
      twoColumns('Deal savings', `-${formatMoney(model.savingsTotal)}`, cols),
    );
  }
  if (model.taxTotal > 0) {
    const label = model.taxPercent > 0 ? `Tax (${model.taxPercent}%)` : 'Tax';
    out.push(twoColumns(label, formatMoney(model.taxTotal), cols));
  }
  out.push(divider);
  out.push(twoColumns('TOTAL', formatMoney(model.grandTotal), cols));
  if (model.amountPaid != null) {
    out.push(twoColumns(`Paid (${model.paymentMethod})`, formatMoney(model.amountPaid), cols));
  }
  if (model.changeDue != null && model.changeDue > 0) {
    out.push(twoColumns('Change', formatMoney(model.changeDue), cols));
  }
  out.push(divider);

  out.push(
    centre(`${model.itemCount} item${model.itemCount === 1 ? '' : 's'}`, cols),
  );

  if (model.footer) {
    out.push('');
    for (const line of wrapText(model.footer, cols)) out.push(centre(line, cols));
  }

  return out.join('\n');
}

export function encodeReceipt(
  model: ReceiptModel,
  width: ReceiptWidth,
): Uint8Array {
  const cols = COLUMNS[width];
  const bytes: number[] = [];
  const push = (...values: (number | readonly number[])[]) => {
    for (const v of values) {
      if (typeof v === 'number') bytes.push(v);
      else bytes.push(...v);
    }
  };
  const line = (text = '') => {
    push(encodeText(text), LF);
  };

  push(CMD.INIT);

  push(CMD.ALIGN_CENTER);
  if (model.header.name) {
    push(CMD.BOLD_ON, CMD.SIZE_DOUBLE);
    for (const l of wrapText(model.header.name.toUpperCase(), Math.floor(cols / 2))) {
      line(l);
    }
    push(CMD.SIZE_NORMAL, CMD.BOLD_OFF);
  }

  for (const value of [
    model.header.address,
    model.header.phone,
    model.header.email,
    model.header.receiptInfo,
  ]) {
    if (!value) continue;
    for (const l of wrapText(value, cols)) line(l);
  }

  push(CMD.ALIGN_LEFT);
  line('-'.repeat(cols));

  line(twoColumns('Order', `#${model.orderNumber}`, cols));
  line(twoColumns('Type', model.orderType, cols));
  if (model.tableLabel) line(twoColumns('Table', model.tableLabel, cols));
  if (model.customerName) line(twoColumns('Customer', model.customerName, cols));
  line(twoColumns('Date', model.date, cols));
  line(twoColumns('Time', model.time, cols));
  line('-'.repeat(cols));

  const c = itemColumns(cols);
  const money = (v: number) => formatMoney(v, { withSymbol: false });

  push(CMD.BOLD_ON);
  line(
    'Item'.padEnd(c.name) +
      ' ' +
      'Qty'.padStart(c.qty) +
      ' ' +
      'Price'.padStart(c.price) +
      ' ' +
      'Amount'.padStart(c.amount),
  );
  push(CMD.BOLD_OFF);
  line('-'.repeat(cols));

  for (const item of model.lines) {
    const label =
      item.name +
      (item.sizeLabel ? ` (${item.sizeLabel})` : '') +
      (item.isDeal ? ' [DEAL]' : '');
    const nameLines = wrapText(label, c.name);

    line(
      (nameLines[0] ?? '').padEnd(c.name) +
        ' ' +
        String(item.quantity).padStart(c.qty) +
        ' ' +
        money(item.unitPrice).padStart(c.price) +
        ' ' +
        money(item.lineTotal).padStart(c.amount),
    );
    for (const extra of nameLines.slice(1)) line(extra);
    for (const t of item.toppings) {
      for (const wrapped of wrapText(`  + ${t.name} ${t.price ? `(${money(t.price)})` : ''}`, cols)) line(wrapped);
    }
    for (const a of item.addOns) {
      for (const wrapped of wrapText(`  + ${a.name} ${a.price ? `(${money(a.price)})` : ''}`, cols)) line(wrapped);
    }
    for (const content of item.dealContents) {
      for (const wrapped of wrapText(`  - ${content}`, cols)) line(wrapped);
    }
  }

  line('-'.repeat(cols));

  line(twoColumns('Subtotal', formatMoney(model.subtotal), cols));
  if (model.savingsTotal > 0) {
    line(twoColumns('Deal savings', `-${formatMoney(model.savingsTotal)}`, cols));
  }
  if (model.taxTotal > 0) {
    const label = model.taxPercent > 0 ? `Tax (${model.taxPercent}%)` : 'Tax';
    line(twoColumns(label, formatMoney(model.taxTotal), cols));
  }

  line('-'.repeat(cols));
  push(CMD.BOLD_ON);
  line(twoColumns('TOTAL', formatMoney(model.grandTotal), cols));
  push(CMD.BOLD_OFF);
  if (model.amountPaid != null) {
    line(twoColumns(`Paid (${model.paymentMethod})`, formatMoney(model.amountPaid), cols));
  }
  if (model.changeDue != null && model.changeDue > 0) {
    line(twoColumns('Change', formatMoney(model.changeDue), cols));
  }
  line('-'.repeat(cols));

  push(CMD.ALIGN_CENTER);
  line(`${model.itemCount} item${model.itemCount === 1 ? '' : 's'}`);

  if (model.footer) {
    line('');
    for (const l of wrapText(model.footer, cols)) line(l);
  }

  push(CMD.feed(3), CMD.CUT);

  return new Uint8Array(bytes);
}
