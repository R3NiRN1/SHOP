import { prisma } from '../../lib/prisma';
import prisma from '../../lib/prisma';

export const dynamic = 'force-dynamic';

export const dynamic = 'force-dynamic';

export default async function VarietiesPage() {
  const varieties = await prisma.variety.findMany({ orderBy: { name: 'asc' } });
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '48px 24px' }}>
      <h1 style={{ fontSize: 32, marginBottom: 24 }}>Varieties</h1>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {varieties.map((v) => (
          <li key={v.id} style={{ borderBottom: '1px solid #eee', padding: '12px 0' }}>
            <h3 style={{ margin: 0 }}>{v.name}</h3>
            {v.species && <p style={{ margin: '4px 0', opacity: 0.8 }}>{v.species}</p>}
            {v.price != null && <p style={{ margin: '4px 0' }}>Price: £{v.price.toFixed(2)}</p>}
            {v.stock != null && <p style={{ margin: '4px 0' }}>Stock: {v.stock}</p>}
          </li>
        ))}
      </ul>
    </main>
  );
}
