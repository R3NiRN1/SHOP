import type { CartItem } from './commerce-input';
const key = 'shop-basket-v2';
export function readBasket(): CartItem[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is CartItem => item && typeof item.varietyId === 'string' && item.varietyId.length < 100 && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 1000).slice(0, 30);
  } catch { return []; }
}
export function saveBasket(items: CartItem[]) { localStorage.setItem(key, JSON.stringify(items)); }
