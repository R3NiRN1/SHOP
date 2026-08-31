import Link from 'next/link';
import { formatCurrency, formatStock, getCatalogVarieties } from '../../lib/catalog';
import { contactRuntimeState } from '../../lib/runtime-env';

export const dynamic = 'force-dynamic';

export default async function VarietiesPage() {
  const { varieties, source } = await getCatalogVarieties();
  const contact = contactRuntimeState();

  return (
    <main className="section-shell page-shell">
      <div className="section-heading"><div><p className="eyebrow">Catalogue</p><h1>Seed varieties</h1></div><Link className="button" href="/">Back home</Link></div>

      {source === 'unavailable' && <p className="error-message">The live catalogue is temporarily unavailable. No demo stock is being substituted.</p>}
      {source === 'starter' && <p className="notice">Development demo mode is enabled. Demo entries are clearly marked and are not asserted to be saleable stock.</p>}

      <div className="product-grid catalogue-grid">{varieties.map((variety) => (
        <article className="product-card" key={variety.id}>
          <p className="species">{variety.species ?? 'Species TBC'}</p><h2>{variety.name}</h2><p>{variety.description ?? 'Grower notes and provenance details are coming soon.'}</p>
          <div className="card-footer"><strong>{formatCurrency(variety.price)}</strong><span>{formatStock(variety.stock)}</span></div>
          {contact.configured && <a className="button primary" href={`mailto:${contact.email}?subject=${encodeURIComponent(`Seed enquiry: ${variety.name}`)}`}>Enquire about this seed</a>}
        </article>
      ))}</div>
      {!contact.configured && source !== 'unavailable' && <p className="notice">Enquiry links are disabled until SHOP_CONTACT_EMAIL is configured.</p>}
    </main>
  );
}
