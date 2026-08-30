'use client';

import { useCallback, useEffect, useState } from 'react';

type Variety = {
  id: string;
  slug: string;
  name: string;
  species: string | null;
  description: string | null;
  price: number | null;
  stock: number | null;
  published: boolean;
};

type FormState = {
  name: string;
  slug: string;
  species: string;
  description: string;
  price: string;
  stock: string;
  published: boolean;
};

const emptyForm: FormState = {
  name: '',
  slug: '',
  species: '',
  description: '',
  price: '',
  stock: '',
  published: false,
};

export function VarietiesManager() {
  const [varieties, setVarieties] = useState<Variety[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch('/api/admin/varieties', { cache: 'no-store' });
    const body = (await response.json().catch(() => null)) as { varieties?: Variety[]; error?: string } | null;
    if (!response.ok) throw new Error(body?.error ?? 'Unable to load varieties.');
    setVarieties(body?.varieties ?? []);
  }, []);

  useEffect(() => {
    load().catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Unable to load varieties.'));
  }, [load]);

  const edit = (variety: Variety) => {
    setEditingId(variety.id);
    setForm({
      name: variety.name,
      slug: variety.slug,
      species: variety.species ?? '',
      description: variety.description ?? '',
      price: variety.price == null ? '' : String(variety.price),
      stock: variety.stock == null ? '' : String(variety.stock),
      published: variety.published,
    });
    setError('');
  };

  const reset = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
  };

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError('');
    try {
      const url = editingId ? `/api/admin/varieties/${editingId}` : '/api/admin/varieties';
      const response = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? 'Unable to save variety.');
      await load();
      reset();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save variety.');
    } finally {
      setIsSaving(false);
    }
  }

  async function remove(variety: Variety) {
    if (!window.confirm(`Delete ${variety.name}? This cannot be undone.`)) return;
    setError('');
    const response = await fetch(`/api/admin/varieties/${variety.id}`, { method: 'DELETE' });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? 'Unable to delete variety.');
      return;
    }
    if (editingId === variety.id) reset();
    await load().catch(() => setError('Variety deleted, but the list could not be refreshed.'));
  }

  return (
    <main className="section-shell page-shell admin-shell">
      <div className="section-heading">
        <div><p className="eyebrow">Admin</p><h1>Manage varieties</h1></div>
        <a className="button" href="/varieties">View public catalogue</a>
      </div>

      {error && <p className="error-message">{error}</p>}

      <form className="admin-form" onSubmit={submit}>
        <label>Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required maxLength={160} /></label>
        <label>Slug<input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} placeholder="Generated from name when blank" maxLength={160} /></label>
        <label>Species<input value={form.species} onChange={(event) => setForm({ ...form, species: event.target.value })} maxLength={160} /></label>
        <label>Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={4} maxLength={5000} /></label>
        <div className="form-row">
          <label>Price (£)<input type="number" min="0" max="10000" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></label>
          <label>Stock<input type="number" min="0" max="1000000" step="1" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} /></label>
        </div>
        <label className="checkbox-row"><input type="checkbox" checked={form.published} onChange={(event) => setForm({ ...form, published: event.target.checked })} /> Published</label>
        <div className="button-row">
          <button className="button primary" type="submit" disabled={isSaving}>{isSaving ? 'Saving…' : editingId ? 'Update variety' : 'Create variety'}</button>
          {editingId && <button className="button" type="button" onClick={reset}>Cancel edit</button>}
        </div>
      </form>

      <h2>Existing varieties</h2>
      <div className="admin-list">
        {varieties.map((variety) => (
          <article key={variety.id}>
            <div><strong>{variety.name}</strong><div className="admin-meta">/{variety.slug} · {variety.published ? 'Published' : 'Draft'}</div></div>
            <span>{variety.stock == null ? 'Stock TBC' : `${variety.stock} packets`}</span>
            <div className="admin-actions"><button className="button" type="button" onClick={() => edit(variety)}>Edit</button><button className="button danger" type="button" onClick={() => void remove(variety)}>Delete</button></div>
          </article>
        ))}
      </div>
    </main>
  );
}
