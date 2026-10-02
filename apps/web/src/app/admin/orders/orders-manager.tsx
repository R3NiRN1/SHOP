'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchJson, messageOf, postJson } from '../../../lib/client-http';
import { formatPence, toPence } from '../../../lib/commerce-input';
type Summary = { id: string; number: number; status: string; channel: string; email: string; totalPence: number; inventoryState: string; createdAt: string; issue: string | null };
type Order = Summary & { customerName: string | null; notes: string; delivery: string; shippingAddress: unknown; shippingPence: number; subtotalPence: number; paidAt: string | null; fulfilledAt: string | null; refundedPence: number; stripeIntentId: string | null; items: { id: string; name: string; varietyId: string; unitPricePence: number; quantity: number }[]; events: { id: string; createdAt: string; actor: string; message: string }[]; refunds: { id: string; status: string; amountPence: number; restock: boolean; reason: string }[] };
type Variety = { id: string; name: string; price: number | null; stock: number | null; reserved?: number; archived?: boolean };
const statuses = ['DRAFT', 'AWAITING_PAYMENT', 'CONFIRMED', 'FULFILLED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED', 'REVIEW'];
const statusText: Record<string, string> = { DRAFT: 'Draft · no stock change', AWAITING_PAYMENT: 'Awaiting payment · stock held', CONFIRMED: 'Paid · ready to prepare', FULFILLED: 'Fulfilled', CANCELLED: 'Cancelled', REFUND_PENDING: 'Refund pending', REFUNDED: 'Refunded', REVIEW: 'Needs payment review' };

function addressText(value: unknown) {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const details = value as Record<string, unknown>;
  if (typeof details.text === 'string') return details.text;
  const address = details.address && typeof details.address === 'object' && !Array.isArray(details.address) ? details.address as Record<string, unknown> : details;
  return [details.name, address.line1, address.line2, address.city, address.state, address.postal_code, address.country]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0).join('\n');
}

export function OrdersManager() {
  const [orders, setOrders] = useState<Summary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [detail, setDetail] = useState<Order | null>(null);
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [delivery, setDelivery] = useState('collection');
  const [address, setAddress] = useState('');
  const [shipping, setShipping] = useState('0.00');
  const [search, setSearch] = useState('');
  const [matches, setMatches] = useState<Variety[]>([]);
  const [lines, setLines] = useState<{ item: Variety; quantity: number }[]>([]);
  const [reason, setReason] = useState('');
  const [restock, setRestock] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const key = useRef('');
  const list = useCallback(async (nextPage: number, text: string, filter: string) => {
    const result = await fetchJson<{ orders: Summary[]; total: number }>(`/api/admin/orders?${new URLSearchParams({ page: String(nextPage), q: text, status: filter })}`);
    setOrders(result.orders); setTotal(result.total); setPage(nextPage);
  }, []);
  useEffect(() => {
    let active = true;
    fetchJson<{ orders: Summary[]; total: number }>('/api/admin/orders?page=1').then((result) => {
      if (active) { setOrders(result.orders); setTotal(result.total); }
    }).catch((error) => { if (active) setError(messageOf(error)); });
    return () => { active = false; };
  }, []);
  async function open(id: string) { try { setDetail(await fetchJson<Order>(`/api/admin/orders/${id}`)); setError(''); } catch (error) { setError(messageOf(error)); } }
  async function findVarieties() {
    try { const result = await fetchJson<{ varieties: Variety[] }>(`/api/admin/varieties?${new URLSearchParams({ q: search })}`); setMatches(result.varieties.filter((item) => !item.archived && item.price !== null)); setError(''); }
    catch (error) { setError(messageOf(error)); }
  }
  async function create(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); key.current ||= crypto.randomUUID();
    try {
      const order = await postJson<Order>('/api/admin/orders', { email, customerName, notes, delivery, address, shippingPence: delivery === 'shipping' ? toPence(shipping) : 0, items: lines.map(({ item, quantity }) => ({ varietyId: item.id, quantity })), requestKey: key.current });
      key.current = ''; setCreating(false); setLines([]); setEmail(''); setCustomerName(''); setNotes(''); setAddress(''); setShipping('0.00');
      try { setDetail(await fetchJson<Order>(`/api/admin/orders/${order.id}`)); await list(1, q, status); }
      catch { setError('Draft saved, but the order list could not be refreshed. Reload this page to see it.'); }
    } catch (error) { setError(messageOf(error)); } finally { setBusy(false); }
  }
  async function act(action: string) {
    if (!detail) return;
    if (['confirm', 'cancel', 'refund', 'cancel-checkout', 'restock'].includes(action) && !window.confirm(`${action === 'confirm' ? 'Record payment received and deduct stock' : action === 'refund' ? `Request a full refund of ${formatPence(detail.totalPence)}` : action.replace('-', ' ')} for SHOP-${String(detail.number).padStart(6, '0')}?`)) return;
    setBusy(true); setError('');
    try {
      const next = await postJson<Order>(`/api/admin/orders/${detail.id}`, { action, reason, restock, ...(action === 'refund' ? { requestKey: crypto.randomUUID() } : {}) });
      setDetail(next); setReason(''); setRestock(false); await list(page, q, status);
    } catch (error) {
      setError(messageOf(error));
      // A provider request may succeed before our response arrives. Show the
      // durable state so the operator can reconcile a pending refund safely.
      try { setDetail(await fetchJson<Order>(`/api/admin/orders/${detail.id}`)); await list(page, q, status); } catch { /* Keep the original error visible. */ }
    } finally { setBusy(false); }
  }
  return <>
    {error && <p className="error-message" role="alert">{error}</p>}
    <div className="section-heading"><h2>Order book</h2><button className="button primary" onClick={() => { setCreating(!creating); setDetail(null); }}>New enquiry order</button></div>
    {creating && <form className="admin-form" onSubmit={create}>
      <h2>New enquiry order</h2><p className="help-text">Save the enquiry as a draft. Stock changes only after you confirm payment.</p>
      <div className="form-row"><label>Email<input type="email" required maxLength={254} value={email} onChange={(event) => { setEmail(event.target.value); key.current = ''; }} /></label><label>Customer name<input maxLength={160} value={customerName} onChange={(event) => { setCustomerName(event.target.value); key.current = ''; }} /></label></div>
      <label>Notes<textarea rows={2} maxLength={2000} value={notes} onChange={(event) => { setNotes(event.target.value); key.current = ''; }} /></label>
      <label>Delivery<select value={delivery} onChange={(event) => { setDelivery(event.target.value); if (event.target.value === 'collection') setShipping('0.00'); key.current = ''; }}><option value="collection">Collection</option><option value="shipping">Shipping</option></select></label>
      {delivery === 'shipping' && <div className="form-row"><label>Address<textarea required maxLength={1000} value={address} onChange={(event) => { setAddress(event.target.value); key.current = ''; }} /></label><label>Postage (£)<input type="number" required min={0} max={9999.99} step="0.01" value={shipping} onChange={(event) => { setShipping(event.target.value); key.current = ''; }} /></label></div>}
      <div className="filter-bar"><label>Find a variety<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or species" /></label><button className="button" type="button" onClick={() => void findVarieties()}>Search catalogue</button></div>
      {matches.length > 0 && <div className="choice-list">{matches.map((item) => <button type="button" className="button" key={item.id} onClick={() => { if (!lines.some((line) => line.item.id === item.id)) { setLines([...lines, { item, quantity: 1 }]); key.current = ''; } }}>{item.name} · £{item.price?.toFixed(2)} · {item.stock === null ? 'Count needed' : `${item.stock - (item.reserved ?? 0)} available`}</button>)}</div>}
      {lines.map((line) => <div className="form-row" key={line.item.id}><strong>{line.item.name}</strong><label>Packets<input aria-label={`Packets of ${line.item.name}`} type="number" min={1} max={1000} required value={line.quantity} onChange={(event) => { setLines(lines.map((current) => current.item.id === line.item.id ? { ...current, quantity: Number(event.target.value) } : current)); key.current = ''; }} /></label><button type="button" className="button" onClick={() => { setLines(lines.filter((current) => current.item.id !== line.item.id)); key.current = ''; }}>Remove</button></div>)}
      <button className="button primary" disabled={busy || lines.length === 0}>Save draft order</button>
    </form>}
    <form className="filter-bar" onSubmit={(event) => { event.preventDefault(); void list(1, q, status).catch((error) => setError(messageOf(error))); }}>
      <label>Search order or email<input type="search" maxLength={100} value={q} onChange={(event) => setQ(event.target.value)} /></label>
      <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All orders</option>{statuses.map((candidate) => <option key={candidate} value={candidate}>{statusText[candidate]}</option>)}</select></label><button className="button">Apply filters</button>
    </form>
    <div className="table-scroll"><table><thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Total</th><th>Created</th><th></th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td>SHOP-{String(order.number).padStart(6, '0')}</td><td>{order.email}</td><td>{statusText[order.status] ?? order.status}{order.issue && <small className="error-text">{order.issue}</small>}</td><td>{formatPence(order.totalPence)}</td><td>{new Date(order.createdAt).toLocaleDateString('en-GB')}</td><td><button className="button" onClick={() => void open(order.id)}>Open order</button></td></tr>)}</tbody></table></div>
    {orders.length === 0 && <p className="notice">No orders match these filters.</p>}
    <nav className="pagination" aria-label="Order pages"><span>{total} orders · Page {page} of {Math.max(1, Math.ceil(total / 25))}</span>{page > 1 && <button className="button" onClick={() => void list(page - 1, q, status)}>Previous</button>}{page * 25 < total && <button className="button" onClick={() => void list(page + 1, q, status)}>Next</button>}</nav>
    {detail && <section className="panel order-detail"><div className="section-heading"><div><p className="eyebrow">Order details</p><h2>SHOP-{String(detail.number).padStart(6, '0')}</h2></div><div className="button-row"><button className="button" onClick={() => window.print()}>Print order</button><button className="button" onClick={() => setDetail(null)}>Close</button></div></div>
      <p><strong>{statusText[detail.status] ?? detail.status}</strong> · {detail.channel === 'MANUAL' ? 'Enquiry / offline payment' : 'Secure online payment'} · Stock {detail.inventoryState.toLowerCase()}</p>
      {detail.issue && <p className="error-message" role="alert">{detail.issue}</p>}
      <p>{detail.customerName} · {detail.email}<br />{detail.delivery === 'collection' ? 'Collection' : 'UK delivery'}</p>
      {detail.shippingAddress != null && <pre className="address-block">{addressText(detail.shippingAddress)}</pre>}
      {detail.notes && <p>Notes: {detail.notes}</p>}
      <div className="table-scroll"><table><thead><tr><th>Variety</th><th>Quantity</th><th>Unit price</th><th>Total</th></tr></thead><tbody>{detail.items.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.quantity}</td><td>{formatPence(item.unitPricePence)}</td><td>{formatPence(item.unitPricePence * item.quantity)}</td></tr>)}</tbody></table></div>
      <p>Items {formatPence(detail.subtotalPence)} · Delivery {formatPence(detail.shippingPence)}</p><p className="order-total">Order total: {formatPence(detail.totalPence)}</p>
      <div className="button-row no-print">{detail.channel === 'MANUAL' && detail.status === 'DRAFT' && <button className="button primary" disabled={busy} onClick={() => void act('confirm')}>Confirm offline payment and deduct stock</button>}
        {detail.status === 'CONFIRMED' && <button className="button primary" disabled={busy} onClick={() => void act('fulfil')}>Mark fulfilled</button>}
        {detail.channel === 'MANUAL' && ['DRAFT', 'CONFIRMED'].includes(detail.status) && <button className="button danger" disabled={busy || !reason.trim()} onClick={() => void act('cancel')}>Cancel offline order</button>}
        {detail.channel === 'STRIPE' && ['AWAITING_PAYMENT', 'CONFIRMED', 'FULFILLED', 'REVIEW'].includes(detail.status) && <button className="button" disabled={busy} onClick={() => void act('reconcile')}>Reconcile with Stripe</button>}
        {detail.channel === 'STRIPE' && detail.status === 'REFUND_PENDING' && <button className="button" disabled={busy} onClick={() => void act('reconcile-refund')}>Reconcile refund</button>}
        {detail.channel === 'STRIPE' && detail.status === 'AWAITING_PAYMENT' && <button className="button danger" disabled={busy} onClick={() => void act('cancel-checkout')}>Expire checkout</button>}
        {detail.channel === 'STRIPE' && ['CONFIRMED', 'FULFILLED', 'REVIEW'].includes(detail.status) && detail.stripeIntentId && detail.refundedPence === 0 && <button className="button danger" disabled={busy || !reason.trim()} onClick={() => void act('refund')}>Request full refund</button>}
        {detail.status === 'REFUNDED' && detail.inventoryState === 'SOLD' && <button className="button" disabled={busy || !reason.trim()} onClick={() => void act('restock')}>Restock returned packets</button>}
      </div>
      <div className="form-row no-print"><label>Reason for cancellation, refund or restock<input maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></label>{detail.channel === 'STRIPE' && <label className="checkbox-row"><input type="checkbox" checked={restock} onChange={(event) => setRestock(event.target.checked)} /> Return stock to sale once a full refund is confirmed</label>}</div>
      <h3>Order history</h3><ol className="history-list">{detail.events.map((entry) => <li key={entry.id}><time>{new Date(entry.createdAt).toLocaleString('en-GB')}</time> · {entry.message} <small>({entry.actor})</small></li>)}</ol>
    </section>}
  </>;
}
