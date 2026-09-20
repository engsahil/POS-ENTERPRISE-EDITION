import { toppingsRepository } from '@/data/repositories';
import type { ToppingRecord } from '@/types/domain';
import type { Paisa } from '@/types/common';
import { sanitisePrice, sanitiseText } from '@/utils/validate';

export interface ToppingInput {
  name: string;
  price: Paisa;
  isActive: boolean;
}

export const toppingService = {
  async list(): Promise<ToppingRecord[]> {
    const all = await toppingsRepository.list();
    return all.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  },

  async listActive(): Promise<ToppingRecord[]> {
    const all = await this.list();
    return all.filter((t) => t.isActive === 1);
  },

  async create(input: ToppingInput): Promise<ToppingRecord> {
    return toppingsRepository.create({
      name: sanitiseText(input.name, 80),
      price: sanitisePrice(input.price) ?? 0,
      isActive: input.isActive ? 1 : 0,
    });
  },

  async update(id: string, input: ToppingInput): Promise<ToppingRecord> {
    return toppingsRepository.update(id, {
      name: sanitiseText(input.name, 80),
      price: sanitisePrice(input.price) ?? 0,
      isActive: input.isActive ? 1 : 0,
    });
  },

  async remove(id: string): Promise<void> {
    await toppingsRepository.remove(id, { hard: true });
  },

  async count(): Promise<number> {
    return (await toppingsRepository.list()).length;
  },
};
