import { addOnsRepository } from '@/data/repositories';
import type { AddOnRecord } from '@/types/domain';
import type { Paisa } from '@/types/common';
import { sanitisePrice, sanitiseText } from '@/utils/validate';

export interface AddOnInput {
  name: string;
  price: Paisa;
  isActive: boolean;
}

export const addOnService = {
  async list(): Promise<AddOnRecord[]> {
    const all = await addOnsRepository.list();
    return all.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  },

  async listActive(): Promise<AddOnRecord[]> {
    const all = await this.list();
    return all.filter((t) => t.isActive === 1);
  },

  async create(input: AddOnInput): Promise<AddOnRecord> {
    return addOnsRepository.create({
      name: sanitiseText(input.name, 80),
      price: sanitisePrice(input.price) ?? 0,
      isActive: input.isActive ? 1 : 0,
    });
  },

  async update(id: string, input: AddOnInput): Promise<AddOnRecord> {
    return addOnsRepository.update(id, {
      name: sanitiseText(input.name, 80),
      price: sanitisePrice(input.price) ?? 0,
      isActive: input.isActive ? 1 : 0,
    });
  },

  async remove(id: string): Promise<void> {
    await addOnsRepository.remove(id, { hard: true });
  },

  async count(): Promise<number> {
    return (await addOnsRepository.list()).length;
  },
};
