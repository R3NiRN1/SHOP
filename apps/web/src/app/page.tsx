export default function Home() {
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '48px 24px', lineHeight: 1.5 }}>
      <header style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, letterSpacing: 2, opacity: 0.7 }}>SHOPb • Seed Shop (Holding Page)</div>
        <h1 style={{ fontSize: 44, margin: '12px 0 8px' }}>Seeds with Stories</h1>
        <p style={{ fontSize: 18, opacity: 0.85, maxWidth: 720 }}>
          A cooperative-grown collection from the South West UK. Each variety includes provenance, grower notes,
          and practical advice.
        </p>
      </header>
      <section style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        <div style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, padding: 16 }}>
          <h3 style={{ margin: 0 }}>Varieties</h3>
          <p style={{ margin: '8px 0 0', opacity: 0.85 }}>
            A growing catalogue of resilient, locally-adapted lines, with clear cultivation guidance.
          </p>
        </div>
        <div style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, padding: 16 }}>
          <h3 style={{ margin: 0 }}>Stories</h3>
          <p style={{ margin: '8px 0 0', opacity: 0.85 }}>
            Why this seed matters: origin, stewardship, selection notes, and community context.
          </p>
        </div>
        <div style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, padding: 16 }}>
          <h3 style={{ margin: 0 }}>Coming next</h3>
          <ul style={{ margin: '8px 0 0', opacity: 0.85, paddingLeft: 18 }}>
            <li>Secure admin login</li>
            <li>Catalogue + images</li>
            <li>Stripe checkout</li>
            <li>Customer list + newsletter opt-in</li>
          </ul>
        </div>
      </section>
      <footer style={{ marginTop: 40, opacity: 0.75, fontSize: 14 }}>
        Contact: <a href="mailto:hello@example.org">hello@example.org</a>
      </footer>
    </main>
  );
}
