import type { Metadata, Viewport } from 'next';
import { Lora, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

// next/font self-hosts these at build time → no round-trip to Google Fonts CDN,
// no render-blocking stylesheet, fonts inlined into the page bundle.
const lora = Lora({
  subsets:  ['latin'],
  weight:   ['400', '500', '600', '700'],
  style:    ['normal', 'italic'],
  variable: '--font-lora',
  display:  'swap',
  preload:  true,
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets:  ['latin'],
  weight:   ['400', '500'],
  variable: '--font-ibm-mono',
  display:  'swap',
  preload:  false, // mono font — not on critical path
});

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
  metadataBase: new URL('https://www.frametheglobe.xyz'),
  openGraph: {
    title: 'FrameTheGlobe — Middle East & South Asia War Theater',
    description:
      'Live news aggregator covering Gaza, Lebanon, Iran, Afghanistan, and Pakistan from 70+ sources across Western, regional, independent, and OSINT press.',
    type: 'website',
    url: 'https://www.frametheglobe.xyz',
    siteName: 'FrameTheGlobe',
    locale: 'en_US',
    images: [{
      url:    'https://www.frametheglobe.xyz/img/social-card.png?v=6.0.1',
      width:  1200,
      height: 630,
      type:   'image/png',
      alt:    'FrameTheGlobe — Middle East & South Asia War Theater live news aggregator',
    }],
  },
  other: {
    'twitter:site': '@frametheglobe',
    'twitter:creator': '@frametheglobe',
    'og:image:secure_url': 'https://www.frametheglobe.xyz/img/social-card.png?v=6.0.1',
    'og:image:type': 'image/png',
    'og:image:width': '1200',
    'og:image:height': '630',
    'og:image:alt': 'FrameTheGlobe — Middle East & South Asia War Theater live news aggregator',
    // Additional debugging tags for X crawler
    'twitter:image': 'https://www.frametheglobe.xyz/img/social-card.png?v=6.0.1',
    'twitter:image:alt': 'FrameTheGlobe — Middle East & South Asia War Theater live news aggregator',
  },
  twitter: {
    card:        'summary_large_image',
    title:       'FrameTheGlobe — Middle East & South Asia War Theater',
    description: 'Live news aggregator covering Gaza, Lebanon, Iran, Afghanistan, and Pakistan from 70+ sources.',
    site:        '@frametheglobe',
    creator:     '@frametheglobe',
    images:      [{
      url:    'https://www.frametheglobe.xyz/img/social-card.png?v=6.0.1',
      width:  1200,
      height: 630,
      alt:    'FrameTheGlobe — Middle East & South Asia War Theater live news aggregator',
    }],
  },
  robots: { index: true, follow: true },
  alternates: {
    canonical: 'https://www.frametheglobe.xyz',
    types: {
      'application/rss+xml': 'https://www.frametheglobe.xyz/api/rss',
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
    <html lang="en" className={`${lora.variable} ${ibmPlexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
