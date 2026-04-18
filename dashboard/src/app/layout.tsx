import type { Metadata } from 'next';
import { Nav } from '@/components/nav';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Federation Dashboard · nf-bacalhau',
  description:
    'Coordinate federated allele-frequency runs across Bacalhau sites without moving genotypes.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Nav />
          {children}
        </Providers>
      </body>
    </html>
  );
}
