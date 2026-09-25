'use client';
import { useEffect, useRef, useState } from 'react';
import type { CatalogVariety } from '../../../lib/catalog';
import type { CatalogueQuery } from '../../../lib/catalog-query';
import { CatalogueFilters, Pagination } from '../../../components/catalogue-filters';
import { fetchJson, messageOf, postJson } from '../../../lib/client-http';

type Variety = CatalogVariety;
type FormState = { name: string; slug: string; species: string; description: string; price: string; stock: string; published: boolean };
const emptyForm: FormState = { name: '', slug: '', species: '', description: '', price: '', stock: '', published: false };
type Movement = { id: string; createdAt: string; kind: string; stockDelta: number; reservedDelta: number; stockAfter: number | null; actor: string; reason: string };

function StockPanel({ variety, onSaved, onClose }: { variety: Variety; onSaved: () => Promise<void>; onClose: () => void }) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [mode, setMode] = useState('delta');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const key = useRef('');
  useEffect(() => { let active = true; fetchJson<{ movements: Movement[] }>(`/api/admin/varieties/${variety.id}/stock`).then((data) => { if (active) setMovements(data.movements); }).catch((error) => { if (active) setError(messageOf(error)); }); return () => { active = false; }; }, [variety.id]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    key.current ||= crypto.randomUUID();
    try {
      await postJson(`/api/admin/varieties/${variety.id}/stock`, { mode, quantity: Number(quantity), reason, version: variety.inventoryVersion ?? 0, requestKey: key.current });
      await onSaved(); onClose();
    } catch (error) { setError(messageOf(error)); } finally { setBusy(false); }
  }
  return <section className="panel" aria-label={`Stock for ${variety.name}`}>
    <div className="section-heading"><h2>Stock · {variety.name}</h2><button className="button" onClick={onClose}>Close stock panel</button></div>
    <p>On hand: {variety.stock ?? 'not counted'} · Held: {variety.reserved ?? 0} · Available: {variety.stock === null ? 'unknown' : variety.stock - (variety.reserved ?? 0)}</p>
    {error && <p className="error-message" role="alert">{error}</p>}
    <form className="filter-bar" onSubmit={submit}>
      <label>Change type<select value={mode} onChange={(event) => { setMode(event.target.value); key.current = ''; }}><option value="delta">Add / remove packets</option><option value="count">Set physical count</option></select></label>
      <label>Quantity<input type="number" required min={mode === 'count' ? 0 : -1000000} max={1000000} step={1} value={quantity} onChange={(event) => { setQuantity(event.target.value); key.current = ''; }} /></label>
      <label>Reason<input required maxLength={500} placeholder="New harvest, count correction…" value={reason} onChange={(event) => { setReason(event.target.value); key.current = ''; }} /></label>
      <button className="button primary" disabled={busy}>{busy ? 'Saving…' : 'Record stock change'}</button>
    </form>
    <p className="help-text">A physical count includes packets held for checkout. Use a negative adjustment to remove packets. Confirmed sales update stock automatically.</p>
    <h3>Recent stock history</h3>
    <div className="table-scroll"><table><thead><tr><th>Date</th><th>Change</th><th>On hand</th><th>Reason / actor</th></tr></thead><tbody>{movements.map((movement) => <tr key={movement.id}><td>{new Date(movement.createdAt).toLocaleString('en-GB')}</td><td>{movement.kind}: {movement.stockDelta > 0 ? '+' : ''}{movement.stockDelta}{movement.reservedDelta !== 0 && ` (${movement.reservedDelta > 0 ? '+' : ''}${movement.reservedDelta} held)`}</td><td>{movement.stockAfter ?? 'Unknown'}</td><td>{movement.reason}<small>{movement.actor}</small></td></tr>)}</tbody></table></div>
    {movements.length === 0 && <p>No stock movements yet.</p>}<p className="help-text">Latest 100 movements.</p>
  </section>;
}

export function VarietiesManager({ initialVarieties, query, initialTotal, page }: { initialVarieties: Variety[]; query: CatalogueQuery; initialTotal: number; page: number }) {
  const [varieties, setVarieties] = useState(initialVarieties);
  const [total, setTotal] = useState(initialTotal);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<Variety | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [stockFor, setStockFor] = useState<Variety | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  async function reload() {
    const result = await fetchJson<{ varieties: Variety[]; total: number }>(`/api/admin/varieties?${new URLSearchParams(query)}`);
    setVarieties(result.varieties); setTotal(result.total); setSelected([]);
  }
  function edit(variety: Variety) {
    setEditing(variety); setFormOpen(true); setError(''); setNotice('');
    setForm({ name: variety.name, slug: variety.slug, species: variety.species ?? '', description: variety.description ?? '', price: variety.price === null ? '' : String(variety.price), stock: variety.stock === null ? '' : String(variety.stock), published: variety.published });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const { stock, ...metadata } = form;
      const payload = editing ? { ...metadata, expectedUpdatedAt: editing.updatedAt, archived: false } : { ...metadata, stock };
      await fetchJson(editing ? `/api/admin/varieties/${editing.id}` : '/api/admin/varieties', { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      setNotice(form.published ? 'Saved and published.' : 'Saved as a draft. Publish it when you want it in the catalogue.');
      setEditing(null); setForm(emptyForm); setFormOpen(false);
      await reload().catch(() => setError('Saved, but the list could not be refreshed. Reload this page.'));
    } catch (error) { setError(messageOf(error)); } finally { setBusy(false); }
  }
  async function archive(variety: Variety) {
    if (!window.confirm(`Archive ${variety.name}? Its order and stock history will remain available.`)) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/admin/varieties/${variety.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error((await response.json()).error ?? 'Unable to archive variety.');
      await reload(); setNotice('Variety archived.');
    } catch (error) { setError(messageOf(error)); } finally { setBusy(false); }
  }
  async function bulk(action: string) {
    if (!window.confirm(`${action === 'publish' ? 'Publish' : 'Unpublish'} ${selected.length} selected varieties?`)) return;
    setBusy(true); setError('');
    try { await postJson('/api/admin/varieties/bulk', { action, ids: selected }); await reload(); setNotice('Visibility updated.'); }
    catch (error) { setError(messageOf(error)); } finally { setBusy(false); }
  }
  return <main className="section-shell page-shell admin-shell">
    <div className="section-heading"><div><p className="eyebrow">Admin</p><h1>Manage varieties</h1></div><div className="button-row"><a className="button" href="/admin/orders">Orders and sales</a><a className="button" href="/varieties">View public catalogue</a><button className="button primary" onClick={() => { setEditing(null); setForm(emptyForm); setFormOpen(true); }}>Add variety</button></div></div>
    {error && <p className="error-message" role="alert">{error}</p>}{notice && <p className="success-message" role="status">{notice}</p>}
    {formOpen && <form className="admin-form" onSubmit={submit}>
      <h2>{editing ? 'Edit variety' : 'New variety'}</h2>
      <div className="form-row"><label>Name<input required maxLength={160} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Catalogue ID (optional)<input maxLength={160} placeholder="Generated from name" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} /></label></div>
      <label>Species<input maxLength={160} value={form.species} onChange={(event) => setForm({ ...form, species: event.target.value })} /></label>
      <label>Description<textarea rows={4} maxLength={5000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
      <div className="form-row"><label>Price (£)<input type="number" min="0" max="10000" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></label>{!editing && <label>Opening stock<input type="number" min="0" max="1000000" step="1" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} /></label>}</div>
      {editing && <p className="help-text">Use Adjust stock below to record a stock change.</p>}
      <label className="checkbox-row"><input type="checkbox" checked={form.published} onChange={(event) => setForm({ ...form, published: event.target.checked })} /> Published — show in the public catalogue</label>
      <div className="button-row"><button className="button primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Update variety' : 'Create variety'}</button><button type="button" className="button" onClick={() => setFormOpen(false)}>Cancel edit</button></div>
    </form>}
    {stockFor && <StockPanel key={stockFor.id} variety={stockFor} onClose={() => setStockFor(null)} onSaved={reload} />}
    <h2>Existing varieties</h2><CatalogueFilters query={query} admin />
    {selected.length > 0 && <div className="button-row selection-bar"><span>{selected.length} selected</span><button className="button" disabled={busy} onClick={() => void bulk('publish')}>Publish selected</button><button className="button" disabled={busy} onClick={() => void bulk('unpublish')}>Unpublish selected</button></div>}
    <div className="admin-list">{varieties.map((variety) => <article key={variety.id}>
      <label className="checkbox-row"><input aria-label={`Select ${variety.name}`} type="checkbox" checked={selected.includes(variety.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, variety.id] : selected.filter((id) => id !== variety.id))} /></label>
      <div className="grow"><strong>{variety.name}</strong><div className="admin-meta">{variety.archived ? 'Archived' : variety.published ? 'Published' : 'Draft — only visible here'} · {variety.species ?? 'Species not set'}</div></div>
      <div><strong>{variety.stock === null ? 'Count needed' : `${variety.stock - (variety.reserved ?? 0)} available`}</strong><small>{variety.stock ?? '?'} on hand · {variety.reserved ?? 0} held</small></div>
      <div className="admin-actions"><button className="button" disabled={busy} onClick={() => edit(variety)}>{variety.archived ? 'Restore / edit' : 'Edit'}</button><button className="button" onClick={() => setStockFor(variety)}>Adjust stock</button>{!variety.archived && <button className="button danger" disabled={busy} onClick={() => void archive(variety)}>Archive</button>}</div>
    </article>)}</div>
    {varieties.length === 0 && <p className="notice">No varieties match these filters.</p>}
    <Pagination query={query} page={page} total={total} pageSize={25} />
  </main>;
}
