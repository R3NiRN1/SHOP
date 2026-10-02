'use client';
import { useState } from 'react';
import { readBasket, saveBasket } from '../lib/basket';
export function AddToBasket({ id, name, stock }: { id: string; name: string; stock: number }) {
  const [notice, setNotice] = useState('');
  function add() {
    try {
      const basket = readBasket();
      const existing = basket.find((item) => item.varietyId === id);
      if (existing) {
        if (existing.quantity >= Math.min(stock, 1000)) { setNotice('All available packets are already in your basket.'); return; }
        existing.quantity++;
      } else {
        if (basket.length >= 30) { setNotice('Your basket can hold up to 30 varieties.'); return; }
        basket.push({ varietyId: id, quantity: 1 });
      }
      saveBasket(basket); setNotice('Added to your basket.');
    } catch { setNotice('Allow storage in this browser to use the basket.'); }
  }
  return <div><button className="button primary" onClick={add} aria-label={`Add ${name} to basket`}>Add to basket</button><p className="help-text" role="status">{notice}</p></div>;
}
