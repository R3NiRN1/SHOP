import './globals.css';
import Link from 'next/link';
import { paymentAvailability } from '../lib/commerce-config';

export const metadata = {
  title: 'SHOP',
  description: 'Seeds with Stories',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body><a className="skip-link" href="#content">Skip to content</a><header className="topbar section-shell"><Link className="wordmark" href="/">SHOP</Link><nav aria-label="Main navigation"><Link href="/varieties">Catalogue</Link>{paymentAvailability().enabled && <Link href="/basket">Basket</Link>}<Link href="/admin">Admin</Link></nav></header><div id="content">{children}</div></body>
    </html>
  );
}
