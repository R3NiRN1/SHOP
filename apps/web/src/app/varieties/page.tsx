import Link from 'next/link';
import { CatalogueFilters, Pagination } from '../../components/catalogue-filters';
import { AddToBasket } from '../../components/add-to-basket';
import { paymentAvailability } from '../../lib/commerce-config';
import type { CatalogueQuery } from '../../lib/catalog-query';
import { formatCurrency, formatStock, getCatalogVarieties } from '../../lib/catalog';
import { contactRuntimeState } from '../../lib/runtime-env';

export const dynamic = 'force-dynamic';

export default async function VarietiesPage({ searchParams }: { searchParams: Promise<CatalogueQuery> }) {
  const query = await searchParams;
  const { varieties, source, total = 0, page = 1, pageSize = 24 } = await getCatalogVarieties(query);
  const payments = paymentAvailability();
  const contact = contactRuntimeState();

  return (
    <main className="section-shell page-shell">
      <div className="section-heading"><div><p className="eyebrow">Catalogue</p><h1>Seed varieties</h1></div><Link className="button" href="/">Back home</Link></div>

      {source === 'unavailable' && <p className="error-message">The live catalogue is temporarily unavailable. No demo stock is being substituted.</p>}
      {source === 'starter' && <p className="notice">Development demo mode is enabled. Demo entries are clearly marked and are not asserted to be saleable stock.</p>}

      <CatalogueFilters query={query} />
      {payments.enabled && <p className="help-text">{payments.testMode ? "Test checkout · " : ""}{payments.delivery === "collection" ? "Collection orders" : "UK delivery"} · Stock is held when you start checkout.</p>}
      {source === "database" && varieties.length === 0 && <p className="notice">No published varieties match these filters.</p>}
      <div className="product-grid catalogue-grid">{varieties.map((variety) => (
        <article className="product-card" key={variety.id}>
          <p className="species">{variety.species ?? 'Species TBC'}</p><h2>{variety.name}</h2><p>{variety.description ?? 'Grower notes and provenance details are coming soon.'}</p>
          <div className="card-footer"><strong>{formatCurrency(variety.price)}</strong><span>{formatStock(variety.stock)}</span></div>
          {payments.enabled && variety.price !== null && variety.price > 0 && variety.stock !== null && variety.stock > 0 && <AddToBasket id={variety.id} name={variety.name} stock={variety.stock} />}
          {contact.configured && <a className="button primary" href={`mailto:${contact.email}?subject=${encodeURIComponent(`Seed enquiry: ${variety.name}`)}`}>Enquire about this seed</a>}
        </article>
      ))}</div>
      {source === "database" && <Pagination query={query} page={page} total={total} pageSize={pageSize} />}
      {!contact.configured && source !== 'unavailable' && <p className="notice">Enquiry links are disabled until SHOP_CONTACT_EMAIL is configured.</p>}
    </main>
  );
}
