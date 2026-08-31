import Link from 'next/link';
import { formatCurrency, formatStock, getCatalogVarieties } from '../lib/catalog';
import { contactRuntimeState } from '../lib/runtime-env';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const { varieties, source } = await getCatalogVarieties();
  const contact = contactRuntimeState();
  const featured = varieties.slice(0, 3);

  return (
    <main>
      <section className="hero section-shell">
        <div className="eyebrow">SHOPb • Seed catalogue</div>
        <div className="hero-grid">
          <div>
            <h1>Seeds with stories.</h1>
            <p className="lede">Browse published seed varieties, growing information and current catalogue availability.</p>
            <div className="button-row">
              <Link className="button primary" href="/varieties">Browse varieties</Link>
              {contact.configured && <a className="button" href={`mailto:${contact.email}?subject=Seed%20order%20enquiry`}>Enquire to order</a>}
            </div>
          </div>
          <aside className="hero-card" aria-label="Catalogue status">
            <h2>{source === 'unavailable' ? 'Catalogue unavailable' : source === 'starter' ? 'Development demo' : 'Catalogue online'}</h2>
            {source === 'unavailable' && <p className="notice">The live catalogue is temporarily unavailable. No substitute inventory is being shown.</p>}
            {source === 'starter' && <p className="notice">Explicit development demo mode is enabled. These entries are not asserted to be saleable stock.</p>}
            {source === 'database' && <p>Showing published catalogue records from the configured database.</p>}
            {!contact.configured && <p>Ordering contact is not configured, so enquiry links are disabled.</p>}
          </aside>
        </div>
      </section>

      {featured.length > 0 && <section className="section-shell section-block">
        <div className="section-heading"><div><p className="eyebrow">Featured seeds</p><h2>{source === 'starter' ? 'Demo catalogue' : 'Published catalogue'}</h2></div><Link href="/varieties">View all</Link></div>
        <div className="product-grid">{featured.map((variety) => <article className="product-card" key={variety.id}><p className="species">{variety.species ?? 'Species TBC'}</p><h3>{variety.name}</h3><p>{variety.description ?? 'Grower notes and provenance details are coming soon.'}</p><div className="card-footer"><strong>{formatCurrency(variety.price)}</strong><span>{formatStock(variety.stock)}</span></div></article>)}</div>
      </section>}

      <section className="section-shell section-block info-grid">
        <article><h2>Catalogue policy</h2><p>Only records explicitly marked published appear in the public catalogue. A production database failure does not fall back to sample stock.</p></article>
        <article><h2>Ordering</h2><p>{contact.configured ? <>Orders are currently handled by enquiry at <a href={`mailto:${contact.email}`}>{contact.email}</a>.</> : 'Ordering is disabled until a real shop contact address is configured.'}</p></article>
      </section>
    </main>
  );
}
