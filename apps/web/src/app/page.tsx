import Link from 'next/link';
import { formatCurrency, formatStock, getCatalogVarieties } from '../lib/catalog';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const { varieties, source } = await getCatalogVarieties();
  const featured = varieties.slice(0, 3);

  return (
    <main>
      <section className="hero section-shell">
        <div className="eyebrow">SHOPb • Seed Shop MVP</div>
        <div className="hero-grid">
          <div>
            <h1>Seeds with stories, ready to browse.</h1>
            <p className="lede">
              Discover cooperative-grown seed varieties from the South West UK, with practical growing notes,
              live availability, and a simple enquiry path while checkout is being finalised.
            </p>
            <div className="button-row">
              <Link className="button primary" href="/varieties">
                Browse varieties
              </Link>
              <a className="button" href="mailto:hello@example.org?subject=Seed%20order%20enquiry">
                Enquire to order
              </a>
            </div>
          </div>
          <aside className="hero-card" aria-label="MVP status">
            <h2>Open for enquiries</h2>
            <p>
              The catalogue is usable today. Payments are handled manually by email until online checkout is added.
            </p>
            {source === 'starter' && (
              <p className="notice">Showing starter stock because the production database is not configured.</p>
            )}
          </aside>
        </div>
      </section>

      <section className="section-shell section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Featured seeds</p>
            <h2>Starter catalogue</h2>
          </div>
          <Link href="/varieties">View all</Link>
        </div>
        <div className="product-grid">
          {featured.map((variety) => (
            <article className="product-card" key={variety.id}>
              <p className="species">{variety.species ?? 'Open-pollinated seed'}</p>
              <h3>{variety.name}</h3>
              <p>{variety.description}</p>
              <div className="card-footer">
                <strong>{formatCurrency(variety.price)}</strong>
                <span>{formatStock(variety.stock)}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section-shell section-block info-grid">
        <article>
          <h2>How the MVP works</h2>
          <p>
            Browse available varieties, choose what you want, then email the shop team. Admin users can add real
            catalogue items once database and auth environment variables are configured.
          </p>
        </article>
        <article>
          <h2>Contact</h2>
          <p>
            Ready to order or ask about a variety? Email <a href="mailto:hello@example.org">hello@example.org</a>.
          </p>
        </article>
      </section>
    </main>
  );
}
