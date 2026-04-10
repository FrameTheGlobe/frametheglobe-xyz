import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Levant accountability tracker · FrameTheGlobe',
  description:
    'Curated citable sources: UN, courts, ceasefire and humanitarian updates related to Israel and Palestine.',
};

export default function AccountabilityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
