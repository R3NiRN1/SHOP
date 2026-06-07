'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

type Variety = {
  id: string;
  name: string;
  species: string | null;
  description: string | null;
  price: number | null;
  stock: number | null;
};

type VarietiesResponse =
  | {
      varieties: Variety[];
      source: 'database' | 'starter';
    }
  | Variety[];

const emptyForm = { name: '', species: '', description: '', price: '', stock: '' };

export default function AdminVarieties() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [varieties, setVarieties] = useState<Variety[]>([]);
  const [source, setSource] = useState<'database' | 'starter'>('database');
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) router.replace('/api/auth/signin');
  }, [router, session, status]);

  useEffect(() => {
    async function fetchData() {
      const res = await fetch('/api/varieties');
      const data = (await res.json()) as VarietiesResponse;
      if (Array.isArray(data)) {
        setVarieties(data);
        setSource('database');
        return;
      }
      setVarieties(data.varieties);
      setSource(data.source);
    }

    fetchData().catch(() => setError('Unable to load varieties.'));
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/varieties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          species: form.species,
          description: form.description,
          price: form.price,
          stock: form.stock,
        }),
      });

      if (res.ok) {
        const newVariety = (await res.json()) as Variety;
        setVarieties((current) => [...current, newVariety].sort((a, b) => a.name.localeCompare(b.name)));
        setForm(emptyForm);
        setSource('database');
        return;
      }

      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? 'Unable to create variety.');
    } catch {
      setError('Error creating variety.');
    } finally {
      setIsSaving(false);
    }
  }

  if (status === 'loading') {
    return <main className="section-shell page-shell">Loading admin…</main>;
  }

  return (
    <main className="section-shell page-shell admin-shell">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Manage varieties</h1>
        </div>
        <a className="button" href="/varieties">
          View catalogue
        </a>
      </div>

      {source === 'starter' && (
        <p className="notice">Starter catalogue is visible because the database is not configured or unavailable.</p>
      )}
      {error && <p className="error-message">{error}</p>}

      <form className="admin-form" onSubmit={handleSubmit}>
        <label>
          Name
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        </label>
        <label>
          Species
          <input value={form.species} onChange={(event) => setForm({ ...form, species: event.target.value })} />
        </label>
        <label>
          Description
          <textarea
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            rows={4}
          />
        </label>
        <div className="form-row">
          <label>
            Price (£)
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(event) => setForm({ ...form, price: event.target.value })}
            />
          </label>
          <label>
            Stock
            <input
              type="number"
              min="0"
              step="1"
              value={form.stock}
              onChange={(event) => setForm({ ...form, stock: event.target.value })}
            />
          </label>
        </div>
        <button className="button primary" type="submit" disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Create variety'}
        </button>
      </form>

      <h2>Existing varieties</h2>
      <div className="admin-list">
        {varieties.map((variety) => (
          <article key={variety.id}>
            <strong>{variety.name}</strong>
            <span>{variety.species ?? 'Species TBC'}</span>
            <span>{variety.stock == null ? 'Stock TBC' : `${variety.stock} packets`}</span>
          </article>
        ))}
      </div>
    </main>
  );
}
