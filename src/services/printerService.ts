/**
 * Direct thermal printer communication.
 *
 * Sends ESC/POS bytes to a physical printer over WebUSB or Web Serial,
 * bypassing the OS print dialog and driver rasterisation entirely.
 *
 * Scope and honesty about limits:
 *   - WebUSB and Web Serial are Chromium-only and require a secure context
 *     (HTTPS or localhost) plus an explicit user gesture to pick the device.
 *   - On Windows, WebUSB needs the printer bound to a WinUSB driver; a
 *     printer installed with the vendor's spooler driver will not be
 *     claimable and must be printed to via the browser dialog instead.
 *   - On Linux the device node must be accessible (udev rule / group).
 *   - This code has NOT been exercised against physical hardware in this
 *     environment. The byte encoding is unit-tested; the transport is not,
 *     because no printer is attached.
 */

import type { ReceiptModel, ReceiptWidth } from './receiptService';
import { encodeReceipt } from './escpos';

export type TransportKind = 'usb' | 'serial';

export interface PrinterTransport {
  readonly kind: TransportKind;
  readonly label: string;
  isConnected(): boolean;
  connect(): Promise<void>;
  write(data: Uint8Array): Promise<void>;
  disconnect(): Promise<void>;
}

export interface TransportSupport {
  usb: boolean;
  serial: boolean;
  secureContext: boolean;
}

/** What the current browser can actually do. */
export function detectSupport(): TransportSupport {
  const nav = navigator as Navigator & { usb?: unknown; serial?: unknown };
  return {
    usb: typeof nav.usb !== 'undefined',
    serial: typeof nav.serial !== 'undefined',
    // WebUSB/Serial require a secure context; localhost counts as secure.
    secureContext: window.isSecureContext,
  };
}

/* ------------------------------------------------------------------ */
/* WebUSB                                                              */
/* ------------------------------------------------------------------ */

/** Interface class 7 is "Printer" in the USB spec. */
const USB_PRINTER_CLASS = 7;

interface UsbLikeDevice {
  productName?: string;
  manufacturerName?: string;
  configuration: unknown;
  configurations: {
    configurationValue: number;
    interfaces: {
      interfaceNumber: number;
      alternate: {
        interfaceClass: number;
        endpoints: { direction: string; endpointNumber: number }[];
      };
    }[];
  }[];
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(value: number): Promise<void>;
  claimInterface(n: number): Promise<void>;
  releaseInterface(n: number): Promise<void>;
  transferOut(endpoint: number, data: BufferSource): Promise<unknown>;
}

export class UsbPrinterTransport implements PrinterTransport {
  readonly kind: TransportKind = 'usb';
  private device: UsbLikeDevice | null = null;
  private interfaceNumber = 0;
  private endpointNumber = 1;

  get label(): string {
    return this.device?.productName ?? 'USB printer';
  }

  isConnected(): boolean {
    return this.device !== null;
  }

  async connect(): Promise<void> {
    const nav = navigator as Navigator & {
      usb?: {
        requestDevice(options: {
          filters: { classCode?: number }[];
        }): Promise<UsbLikeDevice>;
      };
    };

    if (!nav.usb) {
      throw new Error(
        'WebUSB is not available in this browser. Use Chrome or Edge, or print via the browser dialog.',
      );
    }

    // Must be triggered by a user gesture; the browser shows a picker.
    const device = await nav.usb.requestDevice({
      filters: [{ classCode: USB_PRINTER_CLASS }],
    });

    await device.open();

    if (!device.configuration) {
      const first = device.configurations[0];
      if (first) await device.selectConfiguration(first.configurationValue);
    }

    // Find the printer interface and its bulk OUT endpoint.
    let found = false;
    for (const config of device.configurations) {
      for (const iface of config.interfaces) {
        if (iface.alternate.interfaceClass !== USB_PRINTER_CLASS) continue;
        const out = iface.alternate.endpoints.find(
          (e) => e.direction === 'out',
        );
        if (!out) continue;
        this.interfaceNumber = iface.interfaceNumber;
        this.endpointNumber = out.endpointNumber;
        found = true;
        break;
      }
      if (found) break;
    }

    if (!found) {
      await device.close();
      throw new Error('No printer interface found on that USB device.');
    }

    await device.claimInterface(this.interfaceNumber);
    this.device = device;
  }

  async write(data: Uint8Array): Promise<void> {
    if (!this.device) throw new Error('Printer is not connected.');
    // Copy into a plain ArrayBuffer: transferOut requires a BufferSource
    // that is not backed by a SharedArrayBuffer.
    const buffer = new ArrayBuffer(data.byteLength);
    new Uint8Array(buffer).set(data);
    await this.device.transferOut(this.endpointNumber, buffer);
  }

  async disconnect(): Promise<void> {
    if (!this.device) return;
    try {
      await this.device.releaseInterface(this.interfaceNumber);
      await this.device.close();
    } finally {
      this.device = null;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Web Serial                                                          */
/* ------------------------------------------------------------------ */

interface SerialLikePort {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readonly writable: WritableStream<Uint8Array> | null;
}

export class SerialPrinterTransport implements PrinterTransport {
  readonly kind: TransportKind = 'serial';
  readonly label = 'Serial printer';
  private port: SerialLikePort | null = null;

  isConnected(): boolean {
    return this.port !== null;
  }

  async connect(baudRate = 9600): Promise<void> {
    const nav = navigator as Navigator & {
      serial?: { requestPort(): Promise<SerialLikePort> };
    };

    if (!nav.serial) {
      throw new Error(
        'Web Serial is not available in this browser. Use Chrome or Edge, or print via the browser dialog.',
      );
    }

    const port = await nav.serial.requestPort();
    await port.open({ baudRate });
    this.port = port;
  }

  async write(data: Uint8Array): Promise<void> {
    if (!this.port?.writable) throw new Error('Printer is not connected.');
    const writer = this.port.writable.getWriter();
    try {
      // Copy so the chunk is backed by a plain ArrayBuffer.
      const chunk = new Uint8Array(data.byteLength);
      chunk.set(data);
      await writer.write(chunk);
    } finally {
      writer.releaseLock();
    }
  }

  async disconnect(): Promise<void> {
    if (!this.port) return;
    try {
      await this.port.close();
    } finally {
      this.port = null;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Facade                                                              */
/* ------------------------------------------------------------------ */

let active: PrinterTransport | null = null;

export const printerService = {
  detectSupport,

  activeTransport(): PrinterTransport | null {
    return active;
  },

  /** Prompt for a device and keep the connection for subsequent receipts. */
  async connect(kind: TransportKind): Promise<PrinterTransport> {
    await this.disconnect();

    const transport =
      kind === 'usb' ? new UsbPrinterTransport() : new SerialPrinterTransport();
    await transport.connect();
    active = transport;
    return transport;
  },

  async disconnect(): Promise<void> {
    if (!active) return;
    const current = active;
    active = null;
    await current.disconnect();
  },

  /** Encode and send a receipt over the connected transport. */
  async printReceipt(
    model: ReceiptModel,
    width: ReceiptWidth,
  ): Promise<void> {
    if (!active) {
      throw new Error('No printer connected.');
    }
    await active.write(encodeReceipt(model, width));
  },

  /** Bytes that would be sent, for inspection or saving to a file. */
  encode(model: ReceiptModel, width: ReceiptWidth): Uint8Array {
    return encodeReceipt(model, width);
  },
};
