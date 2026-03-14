import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f2ed' },
    { media: '(prefers-color-scheme: dark)',  color: '#0d0c0a' },
  ],
};

export const metadata: Metadata = {
  title: 'FrameTheGlobe — Iran War Theater',
  description:
    'Live multi-source news aggregator covering the Iran war theater: nuclear program, proxy conflicts, Strait of Hormuz, oil markets, and regional geopolitics. Aggregated from Western, Iranian, Gulf, Levant, South Asian, OSINT, and analysis outlets.',
  keywords: [
    'Iran', 'Iran nuclear', 'IRGC', 'Hormuz', 'Hezbollah', 'Houthis',
    'IAEA', 'oil markets', 'Iran sanctions', 'Middle East news',
    'news aggregator', 'Iran theater', 'war', 'frametheglobe',
  ],
  authors: [{ name: 'FrameTheGlobe', url: 'https://frametheglobe.xyz' }],
  metadataBase: new URL('https://frametheglobe.xyz'),
  openGraph: {
    title: 'FrameTheGlobe — Iran War Theater',
    description:
      'Live news aggregator covering the Iran war theater from 40+ sources across Western, Iranian, Gulf, Levant, and OSINT press.',
    type: 'website',
    url: 'https://frametheglobe.xyz',
    siteName: 'FrameTheGlobe',
    images: ['/img/social-card.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FrameTheGlobe — Iran War Theater',
    description:
      'Live news aggregator covering the Iran war theater from 40+ sources.',
    site: '@frametheglobe',
    images: ['/img/social-card.png'],
  },
  robots: { index: true, follow: true },
  alternates: {
    canonical: 'https://frametheglobe.xyz',
    types: {
      'application/rss+xml': 'https://frametheglobe.xyz/api/rss',
    },
  },
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
  manifest: '/manifest.json',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
