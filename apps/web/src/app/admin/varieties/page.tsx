'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';

export default function AdminVarieties() {
  const { data: session, status } = useSession();
  const [varieties, setVarieties] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', species: '', description: '', price: '', stock: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) redirect('/api/auth/signin');
  }, [session, status]);

  useEffect(() => {
    async function fetchData() {
      const res = await fetch('/api/varieties');
      const data = await res.json();
      setVarieties(data);
    }
    fetchData();
  }, []);

  async function handleSubmit(e: any) {
    e.preventDefault();
    setError('');
    if (!form.name) {
      setError('Name is required');
      return;
    }
    try {
      const res = await fetch('/api/varieties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          species: form.species || undefined,
          description: form.description || undefined,
          price: form.price ? parseFloat(form.price) : undefined,
          stock: form.stock ? parseInt(form.stock) : undefined,
        }),
      });
      if (res.ok) {
        const newVariety = await res.json();
        setVarieties([...varieties, newVariety]);
        setForm({ name: '', species: '', description: '', price: '', stock: '' });
      } else {
        const msg = await res.text();
        setError(msg);
      }
    } catch {
      setError('Error creating variety');
    }
  }

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '48px 24px' }}>
      <h1 style={{ fontSize: 28, marginBottom: 24 }}>Admin Varieties</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={handleSubmit} style={{ marginBottom: 32 }}>
        <div style={{ marginBottom: 12 }}>
          <label>Name: <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Species: <input value={form.species} onChange={(e) => setForm({ ...form, species: e.target.value })} /></label>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Description: <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Price (£): <input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Stock: <input type="number" step="1" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></label>
        </div>
        <button type="submit">Create Variety</button>
      </form>
      <h2 style={{ fontSize: 20, marginBottom: 12 }}>Existing Varieties</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {varieties.map((v) => (
          <li key={v.id} style={{ borderBottom: '1px solid #eee', padding: '12px 0' }}>
            <strong>{v.name}</strong>
            {v.price != null && <> (£{v.price.toFixed(2)})</>}
            {v.stock != null && <> [Stock: {v.stock}]</>}
          </li>
        ))}
      </ul>
    </main>
  );
}
