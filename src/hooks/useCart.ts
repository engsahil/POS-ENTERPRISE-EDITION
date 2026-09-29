/**
 * Cart state for the POS.
 *
 * Held in component state rather than the database: an in-progress order is
 * not a business record until it is completed. Completion is what writes
 * permanently (see orderService.complete).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  calculateTotals,
  cartLineKey,
  dealLineKey,
  MAX_LINE_QUANTITY,
  orderService,
  type CartLine,
  type CartTotals,
} from '@/services/orderService';
import type { ID, Paisa } from '@/types/common';
import type { SelectedAddOn, SelectedTopping } from '@/types/domain';

export interface UseCartResult {
  lines: CartLine[];
  totals: CartTotals;
  isEmpty: boolean;
  /** Order-level discount currently applied (paisa). */
  discount: Paisa;
  setDiscount: (value: Paisa) => void;
  addLine: (input: {
    menuItemId: ID;
    itemPriceId: ID | null;
    name: string;
    sizeLabel: string;
    unitPrice: Paisa;
    /** Item-level discount percentage from the menu item, if any. */
    discountPercent?: number | null;
  }) => void;
  addDeal: (input: { dealId: ID; name: string; unitPrice: Paisa }) => void;
  setQuantity: (key: string, quantity: number) => void;
  incrementLine: (key: string) => void;
  decrementLine: (key: string) => void;
  removeLine: (key: string) => void;
  updateLineToppings: (key: string, toppings: SelectedTopping[]) => void;
  updateLineAddOns: (key: string, addOns: SelectedAddOn[]) => void;
  clear: () => void;
}

export function useCart(): UseCartResult {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState<Paisa>(0);
  const [tax, setTax] = useState({ taxPercent: 0, taxInclusive: false });

  useEffect(() => {
    let active = true;
    void orderService.taxConfig().then((config) => {
      if (active) setTax(config);
    });
    return () => {
      active = false;
    };
  }, []);

  // An emptied cart never carries a discount into the next order.
  useEffect(() => {
    if (lines.length === 0) setDiscount(0);
  }, [lines.length]);

  const addLine = useCallback<UseCartResult['addLine']>((input) => {
    const key = cartLineKey(input.menuItemId, input.sizeLabel);

    setLines((prev) => {
      const existing = prev.find((line) => line.key === key);

      if (existing) {
        return prev.map((line) =>
          line.key === key
            ? {
                ...line,
                quantity: Math.min(MAX_LINE_QUANTITY, line.quantity + 1),
              }
            : line,
        );
      }

      return [
        ...prev,
        {
          ...input,
          key,
          kind: 'item' as const,
          dealId: null,
          quantity: 1,
          toppings: [],
          addOns: [],
        },
      ];
    });
  }, []);

  const addDeal = useCallback<UseCartResult['addDeal']>((input) => {
    const key = dealLineKey(input.dealId);

    setLines((prev) => {
      const existing = prev.find((line) => line.key === key);
      if (existing) {
        return prev.map((line) =>
          line.key === key
            ? {
                ...line,
                quantity: Math.min(MAX_LINE_QUANTITY, line.quantity + 1),
              }
            : line,
        );
      }

      return [
        ...prev,
        {
          key,
          kind: 'deal' as const,
          menuItemId: null,
          dealId: input.dealId,
          itemPriceId: null,
          name: input.name,
          sizeLabel: null,
          unitPrice: input.unitPrice,
          quantity: 1,
          toppings: [],
          addOns: [],
        },
      ];
    });
  }, []);

  const setQuantity = useCallback((key: string, quantity: number) => {
    const next = Math.floor(quantity);

    setLines((prev) =>
      next <= 0
        ? prev.filter((line) => line.key !== key)
        : prev.map((line) =>
            line.key === key
              ? { ...line, quantity: Math.min(MAX_LINE_QUANTITY, next) }
              : line,
          ),
    );
  }, []);

  const incrementLine = useCallback(
    (key: string) =>
      setLines((prev) =>
        prev.map((line) =>
          line.key === key
            ? {
                ...line,
                quantity: Math.min(MAX_LINE_QUANTITY, line.quantity + 1),
              }
            : line,
        ),
      ),
    [],
  );

  const decrementLine = useCallback(
    (key: string) =>
      setLines((prev) =>
        prev
          .map((line) =>
            line.key === key ? { ...line, quantity: line.quantity - 1 } : line,
          )
          .filter((line) => line.quantity > 0),
      ),
    [],
  );

  const removeLine = useCallback(
    (key: string) => setLines((prev) => prev.filter((l) => l.key !== key)),
    [],
  );

  const updateLineToppings = useCallback((key: string, toppings: SelectedTopping[]) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, toppings } : l)));
  }, []);

  const updateLineAddOns = useCallback((key: string, addOns: SelectedAddOn[]) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, addOns } : l)));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const totals = useMemo(
    () => calculateTotals(lines, tax.taxPercent, tax.taxInclusive, discount),
    [lines, tax, discount],
  );

  return {
    lines,
    totals,
    isEmpty: lines.length === 0,
    discount,
    setDiscount,
    addLine,
    addDeal,
    setQuantity,
    incrementLine,
    decrementLine,
    removeLine,
    updateLineToppings,
    updateLineAddOns,
    clear,
  };
}
