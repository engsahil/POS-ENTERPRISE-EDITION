/**
 * Domain entity shapes for the persistent data layer.
 *
 * These describe the structure of records held in IndexedDB. Business rules
 * and UI for each domain arrive in their own steps; defining the shapes here
 * keeps persistence type-safe from the start.
 *
 * All money fields are integer paisa (see utils/currency.ts).
 */

import type { BaseEntity, ID, ISODateString, Paisa } from './common';
import type { PasswordHash } from '@/utils/crypto';

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

export interface AdminRecord extends BaseEntity {
  username: string;
  password: PasswordHash;
  role: 'admin';
  mustChangePassword: boolean;
  lastLoginAt?: ISODateString | null;
  /**
   * SHA-256 of the currently valid session token.
   *
   * A session in localStorage is only honoured if its token hashes to this
   * value. Without it, anyone could hand-write a session object and gain
   * admin access without knowing the password. Stored hashed so reading the
   * database does not yield a usable token.
   */
  sessionTokenHash?: string | null;
}

/* ------------------------------------------------------------------ */
/* Restaurant                                                          */
/* ------------------------------------------------------------------ */

/**
 * Optimised image.
 *
 * Stored as a compressed data URL so the owning record is self-contained and
 * survives export/backup without a separate blob store.
 */
export interface StoredImage {
  /** Compressed image as a data URL (WebP where supported). */
  dataUrl: string;
  /** Encoded MIME type, e.g. `image/webp`. */
  type: string;
  width: number;
  height: number;
  /** Encoded size in bytes, after compression. */
  bytes: number;
  /** Original file name, shown in the UI for recognition. */
  fileName: string;
}

/** The restaurant logo is a stored image. Kept as an alias for readability. */
export type RestaurantLogo = StoredImage;

/**
 * Restaurant profile. A single record identified by RESTAURANT_PROFILE_ID —
 * one terminal configures one restaurant.
 *
 * Every text field defaults to an empty string rather than being absent, so
 * the edit form always has a defined value and never renders placeholder or
 * example data.
 */
export interface RestaurantRecord extends BaseEntity {
  name: string;
  logo: RestaurantLogo | null;
  /** Full street address; free text so it suits any locale. */
  address: string;
  phone: string;
  email: string;
  /** Extra details printed on the receipt, e.g. tax or registration numbers. */
  receiptInfo: string;
  /** Thank-you line printed at the very bottom of a receipt. */
  receiptFooter: string;

  /** Sales tax percentage applied at billing, e.g. 16 for 16%. */
  taxPercent: number;
  /** Whether displayed prices already include tax. */
  taxInclusive: boolean;

  /* Reserved for later phases; not editable yet. */
  orderNumberPrefix?: string;
}

/* ------------------------------------------------------------------ */
/* Menu items and their sizes/prices                                   */
/* ------------------------------------------------------------------ */

export interface MenuItemRecord extends BaseEntity {
  name: string;
  description: string;
  /** Free-text category. Empty string when uncategorised. */
  category: string;
  /** Optimised item photo, or null when none has been uploaded. */
  image: StoredImage | null;
  /**
   * Whether the item is offered for sale. IndexedDB cannot index booleans,
   * so this is stored as 0 | 1.
   */
  isActive: 0 | 1;
  /** Whether stock is decremented when this item is sold. */
  tracksInventory: 0 | 1;
  sortOrder?: number;
}

/** A purchasable size/variant of a menu item, e.g. Small / Large. */
export interface ItemPriceRecord extends BaseEntity {
  menuItemId: ID;
  /** Size or variant label. */
  label: string;
  price: Paisa;
  /** Optional cost for margin reporting. */
  costPrice?: Paisa;
  isDefault: 0 | 1;
  sortOrder?: number;
}

/* ------------------------------------------------------------------ */
/* Inventory                                                           */
/* ------------------------------------------------------------------ */

export type InventoryUnit =
  | 'unit'
  | 'kg'
  | 'g'
  | 'litre'
  | 'ml'
  | 'pack'
  | 'box'
  | 'bottle';

/**
 * A stock line.
 *
 * Inventory is standalone: it can track anything (cups, flour, gas cylinders),
 * and may OPTIONALLY be linked to a menu item via `menuItemId`. When a linked
 * line is unavailable or out of stock, the menu item is withheld from the POS
 * so staff cannot sell what is not there.
 */
export interface InventoryRecord extends BaseEntity {
  /** Linked menu item, or null when this is a standalone supply. */
  menuItemId: ID | null;
  name: string;
  sku: string;
  unit: InventoryUnit;
  /** Current quantity on hand. Never negative. */
  quantity: number;
  /**
   * Operator's availability switch, independent of quantity. IndexedDB cannot
   * index booleans, so this is stored as 0 | 1.
   */
  isAvailable: 0 | 1;
  /**
   * Explicitly marked out of stock. Kept separate from `quantity` so the
   * previous quantity survives and can be restored.
   */
  isOutOfStock: 0 | 1;
  /** Quantity captured when marked out of stock, used to restore it. */
  quantityBeforeOutOfStock: number | null;
  /** Threshold at or below which the line is considered low. */
  reorderLevel: number | null;
  costPerUnit?: Paisa;
}

/* ------------------------------------------------------------------ */
/* Deals                                                               */
/* ------------------------------------------------------------------ */

/**
 * How a deal is priced.
 * - `fixed`      one bundle price for the whole deal
 * - `percentage` a discount off the sum of the included products
 */
export type DealPricingType = 'fixed' | 'percentage';

/** A product included in a deal, at a specific size. */
export interface DealLine {
  menuItemId: ID;
  /** Size label, e.g. "Small". Empty when the item has no priced sizes. */
  sizeLabel: string;
  quantity: number;
}

export interface DealRecord extends BaseEntity {
  name: string;
  description: string;
  /** Optimised deal photo, or null when none has been uploaded. */
  image: StoredImage | null;
  pricingType: DealPricingType;
  /** Bundle price when `pricingType` is 'fixed'. */
  price: Paisa | null;
  /** Discount percentage when `pricingType` is 'percentage'. */
  percentOff: number | null;
  items: DealLine[];
  /**
   * Visible and sellable in the POS. IndexedDB cannot index booleans, so
   * this is stored as 0 | 1. Unpublished deals stay saved and editable.
   */
  isPublished: 0 | 1;
  startsAt?: ISODateString | null;
  endsAt?: ISODateString | null;
}

/* ------------------------------------------------------------------ */
/* Orders and order items                                              */
/* ------------------------------------------------------------------ */

export type OrderStatus =
  | 'draft'
  | 'held'
  | 'completed'
  | 'cancelled'
  | 'refunded';

export type OrderType = 'dine-in' | 'takeaway' | 'delivery';

export type PaymentMethod = 'cash' | 'card' | 'other';

export interface OrderRecord extends BaseEntity {
  /** Human-readable sequential number, unique per installation. */
  orderNumber: string;
  status: OrderStatus;
  orderType: OrderType;
  /** Sum of line totals before discount and tax. */
  subtotal: Paisa;
  discountTotal: Paisa;
  taxTotal: Paisa;
  /** Final payable amount. */
  grandTotal: Paisa;
  paymentMethod?: PaymentMethod | null;
  amountPaid?: Paisa;
  changeDue?: Paisa;
  tableLabel?: string;
  customerName?: string;
  customerPhone?: string;
  note?: string;
  completedAt?: ISODateString | null;
}

export interface SelectedTopping {
  name: string;
  price: Paisa;
}

export interface SelectedAddOn {
  name: string;
  price: Paisa;
}

export interface OrderItemRecord extends BaseEntity {
  orderId: ID;
  menuItemId?: ID | null;
  itemPriceId?: ID | null;
  dealId?: ID | null;
  /** Denormalised so a receipt still reads correctly if the item is edited. */
  name: string;
  sizeLabel?: string;
  unitPrice: Paisa;
  quantity: number;
  discount: Paisa;
  /** unitPrice * quantity - discount + toppings/add-ons */
  lineTotal: Paisa;
  note?: string;
  toppings?: SelectedTopping[];
  addOns?: SelectedAddOn[];
  toppingTotal?: Paisa;
  addOnTotal?: Paisa;
}

export interface ToppingRecord extends BaseEntity {
  name: string;
  price: Paisa;
  isActive: 0 | 1;
}

export interface AddOnRecord extends BaseEntity {
  name: string;
  price: Paisa;
  isActive: 0 | 1;
}

/* ------------------------------------------------------------------ */
/* Sales                                                               */
/* ------------------------------------------------------------------ */

export interface SaleRecord extends BaseEntity {
  orderId: ID;
  orderNumber: string;
  /** Local calendar date (YYYY-MM-DD) used for daily reporting. */
  businessDate: string;
  completedAt: ISODateString;
  subtotal: Paisa;
  discountTotal: Paisa;
  taxTotal: Paisa;
  grandTotal: Paisa;
  paymentMethod: PaymentMethod;
  itemCount: number;
  /** Set when the sale is later refunded. */
  refundedAt?: ISODateString | null;
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

/** Generic keyed setting so new preferences need no schema change. */
export interface SettingRecord<T = unknown> extends BaseEntity {
  /** The record id doubles as the setting key. */
  value: T;
}

/* ------------------------------------------------------------------ */
/* Sync queue                                                          */
/* ------------------------------------------------------------------ */

export type SyncOperation = 'create' | 'update' | 'delete';
export type SyncQueueStatus = 'pending' | 'syncing' | 'failed' | 'synced';

export interface SyncQueueRecord extends BaseEntity {
  /** Store the mutation applies to. */
  entity: string;
  entityId: ID;
  operation: SyncOperation;
  payload: unknown;
  status: SyncQueueStatus;
  attempts: number;
  lastAttemptAt?: ISODateString | null;
  lastError?: string | null;
  /**
   * Stable per-item key sent with every attempt. The server uses it to make
   * retries idempotent, which is what prevents duplicate orders when a
   * response is lost after the server already committed.
   */
  idempotencyKey?: string;
  /** Earliest time this item may be retried (exponential backoff). */
  nextAttemptAt?: ISODateString | null;
}
