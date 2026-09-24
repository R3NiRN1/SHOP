import './globals.css';

export const metadata = {
  title: 'Shopb',
  description: 'Seeds with Stories',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
