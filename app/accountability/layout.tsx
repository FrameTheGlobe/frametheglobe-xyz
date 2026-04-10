import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Levant situation desk · FrameTheGlobe',
  description:
    'Live editorial situation figures (source-cited) and a timeline of UN, court, and humanitarian sources for Gaza, Lebanon, and the West Bank.',
};

export default function AccountabilityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
