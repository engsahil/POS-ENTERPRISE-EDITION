/**
 * Restaurant profile persistence.
 *
 * Exactly one profile record exists per terminal, stored under a fixed ID so
 * it can be read without a lookup. The profile is NOT created until the user
 * saves something — an unconfigured terminal has zero restaurant records, and
 * every field starts empty. No example name, address, phone or logo is ever
 * written.
 */

import { restaurantRepository } from '@/data/repositories';
import type { RestaurantLogo, RestaurantRecord } from '@/types/domain';

/** Fixed key for the single restaurant profile. */
export const RESTAURANT_PROFILE_ID = 'restaurant-profile';

/** The editable surface of the profile. */
export interface RestaurantProfileInput {
  name: string;
  logo: RestaurantLogo | null;
  address: string;
  phone: string;
  email: string;
  receiptInfo: string;
  receiptFooter: string;
  /** Sales tax percentage applied at billing, e.g. 16 for 16%. */
  taxPercent: number;
  /** Whether displayed prices already include tax. */
  taxInclusive: boolean;
}

/** All fields blank — the starting point for an unconfigured terminal. */
export const EMPTY_RESTAURANT_PROFILE: RestaurantProfileInput = {
  name: '',
  logo: null,
  address: '',
  phone: '',
  email: '',
  receiptInfo: '',
  receiptFooter: '',
  // No invented tax rate: billing charges nothing until an operator sets one.
  taxPercent: 0,
  taxInclusive: false,
};

/** Trim text fields; a value of only whitespace is stored as empty. */
function normalise(input: RestaurantProfileInput): RestaurantProfileInput {
  return {
    name: input.name.trim(),
    logo: input.logo,
    address: input.address.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    receiptInfo: input.receiptInfo.trim(),
    receiptFooter: input.receiptFooter.trim(),
    taxPercent: Number.isFinite(input.taxPercent)
      ? Math.min(100, Math.max(0, input.taxPercent))
      : 0,
    taxInclusive: input.taxInclusive,
  };
}

export const restaurantService = {
  /** The saved record, or undefined when nothing has been configured yet. */
  async getRecord(): Promise<RestaurantRecord | undefined> {
    const record = await restaurantRepository.getById(RESTAURANT_PROFILE_ID);
    return record?.deletedAt ? undefined : record;
  },

  /**
   * Values for the edit form: the saved profile when it exists, otherwise
   * blank fields. Never returns sample content.
   */
  async getProfile(): Promise<RestaurantProfileInput> {
    const record = await this.getRecord();
    if (!record) return { ...EMPTY_RESTAURANT_PROFILE };

    return {
      name: record.name ?? '',
      logo: record.logo ?? null,
      address: record.address ?? '',
      phone: record.phone ?? '',
      email: record.email ?? '',
      receiptInfo: record.receiptInfo ?? '',
      receiptFooter: record.receiptFooter ?? '',
      taxPercent: record.taxPercent ?? 0,
      taxInclusive: record.taxInclusive ?? false,
    };
  },

  /** True once the operator has saved a restaurant name. */
  async isConfigured(): Promise<boolean> {
    const record = await this.getRecord();
    return Boolean(record?.name);
  },

  /**
   * Create or update the profile. Uses the repository so `createdAt` is
   * written once, `updatedAt` advances and `rev` increments.
   */
  async save(input: RestaurantProfileInput): Promise<RestaurantRecord> {
    const values = normalise(input);
    const existing = await restaurantRepository.getById(RESTAURANT_PROFILE_ID);

    if (existing) {
      return restaurantRepository.update(RESTAURANT_PROFILE_ID, {
        ...values,
        deletedAt: null,
      } as Partial<RestaurantRecord>);
    }

    return restaurantRepository.create({
      id: RESTAURANT_PROFILE_ID,
      ...values,
    });
  },

  /** Remove the logo while leaving the rest of the profile intact. */
  async removeLogo(): Promise<RestaurantRecord | undefined> {
    const existing = await restaurantRepository.getById(RESTAURANT_PROFILE_ID);
    if (!existing) return undefined;
    return restaurantRepository.update(RESTAURANT_PROFILE_ID, { logo: null });
  },
};

/** Tax configuration used by billing. Zero until an operator sets a rate. */
export async function getTaxConfig(): Promise<{
  taxPercent: number;
  taxInclusive: boolean;
}> {
  const record = await restaurantService.getRecord();
  return {
    taxPercent: record?.taxPercent ?? 0,
    taxInclusive: record?.taxInclusive ?? false,
  };
}
