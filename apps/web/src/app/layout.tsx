import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { SiteHeader } from '../components/site-header';
import { SiteFooter } from '../components/site-footer';
import { CartPanel } from '../components/cart-panel';
import { siteConfig } from '../lib/site-config';

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="site-shell">
            <SiteHeader />
            {children}
            <SiteFooter />
            <CartPanel />
          </div>
        </Providers>
      </body>
    </html>
  );
}
