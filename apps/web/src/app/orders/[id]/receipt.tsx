'use client';
import { useCallback, useEffect, useState } from 'react';
import { fetchJson, messageOf, postJson } from '../../../lib/client-http';
import { formatPence } from '../../../lib/commerce-input';
import { readBasket, saveBasket } from '../../../lib/basket';
type Receipt = { number: number; status: string; totalPence: number; delivery: string; expiresAt: string | null; items: { varietyId: string; name: string; quantity: number; unitPricePence: number }[] };
const labels: Record<string, string> = { AWAITING_PAYMENT: 'Payment awaiting confirmation', CONFIRMED: 'Payment received', FULFILLED: 'Order fulfilled', CANCELLED: 'Checkout cancelled', REFUND_PENDING: 'Refund in progress', REFUNDED: 'Refund confirmed', REVIEW: 'Your order needs our attention' };
export function OrderReceipt({ id }: { id: string }) {
  const [order, setOrder] = useState<Receipt | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const result = await fetchJson<Receipt>(`/api/orders/${id}`); setOrder(result);
    if (result.status === 'CANCELLED') {
      try { sessionStorage.removeItem('shop-checkout-attempt'); } catch { /* Storage is optional. */ }
    }
    if (['CONFIRMED', 'FULFILLED'].includes(result.status)) {
      try {
        if (!localStorage.getItem(`shop-receipt-${id}`)) {
          const basket = readBasket().map((item) => ({ ...item, quantity: Math.max(0, item.quantity - (result.items.find((line) => line.varietyId === item.varietyId)?.quantity ?? 0)) })).filter((item) => item.quantity > 0);
          saveBasket(basket); localStorage.setItem(`shop-receipt-${id}`, '1'); sessionStorage.removeItem('shop-checkout-attempt');
        }
      } catch { /* The receipt remains usable when browser storage is unavailable. */ }
    }
  }, [id]);
  useEffect(() => { void load().catch((error) => setError(messageOf(error))); }, [load]);
  async function action(action: string) {
    if (action === 'cancel' && !window.confirm('Cancel this checkout and release its reserved stock?')) return;
    setBusy(true); setError('');
    try {
      const result = await postJson<{ url?: string }>(`/api/orders/${id}`, { action });
      if (result.url) window.location.assign(result.url); else await load();
    } catch (error) { setError(messageOf(error)); } finally { setBusy(false); }
  }
  return <main className="section-shell page-shell"><p className="eyebrow">Your order</p><h1>{order ? `SHOP-${String(order.number).padStart(6, '0')}` : 'Order status'}</h1>
    {error && <p className="error-message" role="alert">{error}</p>}
    {order && <section className="panel"><h2>{labels[order.status] ?? order.status}</h2>
      {order.status === 'AWAITING_PAYMENT' && <p>Your stock is held while payment is checked. You can resume checkout or cancel it here.</p>}
      {order.status === 'CONFIRMED' && <p>{order.delivery === 'collection' ? 'We will contact you to arrange collection.' : 'Your order is ready for the shop to prepare.'}</p>}
      {order.status === 'REVIEW' && <p>Please contact the shop with this order reference before making another payment.</p>}
      <ul>{order.items.map((item) => <li key={item.varietyId}>{item.quantity} × {item.name} — {formatPence(item.quantity * item.unitPricePence)}</li>)}</ul><p className="order-total">Total: {formatPence(order.totalPence)}</p>
      <div className="button-row"><button className="button" disabled={busy} onClick={() => void action('refresh')}>Check payment status</button>{order.status === 'AWAITING_PAYMENT' && <><button className="button primary" disabled={busy} onClick={() => void action('retry')}>Resume checkout</button><button className="button" disabled={busy} onClick={() => void action('cancel')}>Cancel checkout</button></>}<a className="button" href="/varieties">Back to catalogue</a></div>
    </section>}
  </main>;
}
