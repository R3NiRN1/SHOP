import Link from 'next/link';
import { formatCurrency, formatStock, getCatalogVarieties } from '../../lib/catalog';

export const dynamic = 'force-dynamic';

export default async function VarietiesPage() {
  const { varieties, source } = await getCatalogVarieties();

  return (
    <main className="section-shell page-shell">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Catalogue</p>
          <h1>Seed varieties</h1>
        </div>
        <Link className="button" href="/">
          Back home
        </Link>
      </div>

      {source === 'starter' && (
        <p className="notice">
          Showing starter catalogue data. Configure DATABASE_URL to publish live stock from the admin area.
        </p>
      )}

      <div className="product-grid catalogue-grid">
        {varieties.map((variety) => (
          <article className="product-card" key={variety.id}>
            <p className="species">{variety.species ?? 'Open-pollinated seed'}</p>
            <h2>{variety.name}</h2>
            <p>{variety.description ?? 'Grower notes and provenance details are coming soon.'}</p>
            <div className="card-footer">
              <strong>{formatCurrency(variety.price)}</strong>
              <span>{formatStock(variety.stock)}</span>
            </div>
            <a
              className="button primary"
              href={`mailto:hello@example.org?subject=${encodeURIComponent(`Seed enquiry: ${variety.name}`)}`}
            >
              Enquire about this seed
            </a>
          </article>
        ))}
      </div>
    </main>
  );
}
