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
  title: 'FrameTheGlobe — Middle East & South Asia War Theater',
  description:
    'Live multi-source news aggregator covering active war theaters: Gaza genocide, Lebanon, Iran nuclear program, Afghanistan under Taliban, Pakistan conflict, Hezbollah, Houthis, Strait of Hormuz, and oil markets. Sources span Western, Iranian, Gulf, Levant, Palestinian, Lebanese, Afghan, Pakistani, OSINT, and independent press.',
  keywords: [
    'Iran', 'Iran nuclear', 'IRGC', 'Hormuz', 'Gaza', 'Gaza genocide',
    'Lebanon', 'Hezbollah', 'Hamas', 'Houthis', 'IAEA',
    'Afghanistan', 'Taliban', 'Pakistan', 'TTP', 'Balochistan',
    'oil markets', 'Middle East war', 'South Asia conflict',
    'news aggregator', 'frametheglobe',
  ],
  authors: [{ name: 'FrameTheGlobe', url: 'https://frametheglobe.xyz' }],
  metadataBase: new URL('https://frametheglobe.xyz'),
  openGraph: {
    title: 'FrameTheGlobe — Middle East & South Asia War Theater',
    description:
      'Live news aggregator covering Gaza, Lebanon, Iran, Afghanistan, and Pakistan from 70+ sources across Western, regional, independent, and OSINT press.',
    type: 'website',
    url: 'https://frametheglobe.xyz',
    siteName: 'FrameTheGlobe',
    locale: 'en_US',
    images: [{
      url:    'https://frametheglobe.xyz/img/social-card.png',
      width:  1200,
      height: 630,
      type:   'image/png',
      alt:    'FrameTheGlobe — Middle East & South Asia War Theater live news aggregator',
    }],
  },
  twitter: {
    card:        'summary_large_image',
    title:       'FrameTheGlobe — Middle East & South Asia War Theater',
    description: 'Live news aggregator covering Gaza, Lebanon, Iran, Afghanistan, and Pakistan from 70+ sources.',
    images:      ['https://frametheglobe.xyz/img/social-card.png'],
  },
  robots: { index: true, follow: true },
  alternates: {
    canonical: 'https://frametheglobe.xyz',
    types: {
      'application/rss+xml': 'https://frametheglobe.xyz/api/rss',
    },
  },
  icons: {
    icon:     '/img/favicon.png',
    shortcut: '/img/favicon.png',
    apple:    '/img/favicon.png',
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
