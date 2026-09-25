'use client';
import { useEffect, useState } from 'react';
import { readBasket, saveBasket } from '../../lib/basket';
import { formatPence, type CartItem } from '../../lib/commerce-input';
import { fetchJson, messageOf, postJson } from '../../lib/client-http';
type Quote = { items: { id: string; name: string; unitPricePence: number | null; available: number | null }[]; payment: { enabled: boolean; testMode: boolean; delivery: string; shippingPence: number } };

export default function BasketPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const basket = readBasket();
    fetchJson<Quote>(`/api/basket?ids=${encodeURIComponent(basket.map((item) => item.varietyId).join(','))}`).then((result) => { if (active) { setItems(basket); setQuote(result); } }).catch((error) => { if (active) setError(messageOf(error)); });
    return () => { active = false; };
  }, []);
  function update(id: string, quantity: number) {
    const next = items.map((item) => item.varietyId === id ? { ...item, quantity } : item).filter((item) => item.quantity > 0);
    try { saveBasket(next); setItems(next); setError(''); } catch { setError('Allow browser storage to update the basket.'); }
  }
  const invalid = items.some((item) => {
    const row = quote?.items.find((row) => row.id === item.varietyId);
    return !row || row.unitPricePence === null || row.unitPricePence === 0 || row.available === null || item.quantity > row.available;
  });
  const subtotal = items.reduce((sum, item) => sum + (quote?.items.find((row) => row.id === item.varietyId)?.unitPricePence ?? 0) * item.quantity, 0);
  async function checkout(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const input = { items, email: email.trim().toLowerCase(), customerName: name.trim() };
      const fingerprint = JSON.stringify(input);
      let previous: { fingerprint?: string; requestKey?: string } = {};
      try { previous = JSON.parse(sessionStorage.getItem('shop-checkout-attempt') ?? '{}'); } catch { /* Start a new attempt. */ }
      const requestKey = previous.fingerprint === fingerprint && previous.requestKey ? previous.requestKey : crypto.randomUUID();
      sessionStorage.setItem('shop-checkout-attempt', JSON.stringify({ fingerprint, requestKey }));
      const result = await postJson<{ url: string; orderId: string }>('/api/checkout', { ...input, requestKey });
      window.location.assign(result.url);
    } catch (error) { setError(messageOf(error)); setBusy(false); }
  }
  return <main className="section-shell page-shell"><div className="section-heading"><h1>Your basket</h1><a className="button" href="/varieties">Continue browsing</a></div>
    {error && <p className="error-message" role="alert">{error}</p>}
    {!quote && !error && <p role="status">Checking prices and availability…</p>}
    {quote && items.length === 0 && <p className="notice">Your basket is empty.</p>}
    {quote && items.length > 0 && <>
      <div className="basket-list">{items.map((item) => {
        const row = quote.items.find((row) => row.id === item.varietyId);
        return <article className="panel" key={item.varietyId}><h2>{row?.name ?? 'Unavailable variety'}</h2><div className="button-row"><label>Packets<input aria-label={`Quantity for ${row?.name ?? 'unavailable variety'}`} type="number" min={1} max={1000} step={1} value={item.quantity} disabled={busy} onChange={(event) => { const n = Number(event.target.value); if (Number.isInteger(n) && n >= 1 && n <= 1000) update(item.varietyId, n); }} /></label><strong>{row?.unitPricePence != null ? formatPence(row.unitPricePence * item.quantity) : 'Price unavailable'}</strong><button className="button" disabled={busy} onClick={() => update(item.varietyId, 0)}>Remove</button></div>{(!row || row.available === null || item.quantity > row.available) && <p className="error-message">{row?.available != null ? `Only ${row.available} available. Reduce the quantity or remove this item.` : 'This item cannot be ordered online. Remove it to continue.'}</p>}</article>;
      })}</div>
      <section className="panel"><h2>Order summary</h2><p>Items: {formatPence(subtotal)}</p><p>{quote.payment.delivery === 'shipping' ? `UK delivery: ${formatPence(quote.payment.shippingPence)}` : 'Collection — arranged with the shop'}</p><p className="order-total">Total: {formatPence(subtotal + quote.payment.shippingPence)}</p>
        {!quote.payment.enabled ? <p className="notice">Online checkout is currently unavailable. Please use the catalogue enquiry links.</p> : <form className="admin-form" onSubmit={checkout}>
          {quote.payment.testMode && <p className="notice">Test checkout — no real payment will be taken.</p>}
          <label>Your name<input maxLength={160} value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /></label>
          <label>Email address<input required type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
          <p className="help-text">Availability and prices are checked again at checkout. Your packets are then held while you pay.</p>
          <button className="button primary" disabled={busy || invalid}>{busy ? 'Opening checkout…' : 'Continue to secure payment'}</button>
        </form>}
      </section>
    </>}
  </main>;
}
