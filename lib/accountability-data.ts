/**
 * Curated accountability timeline for the Levant / occupied Palestinian territory
 * context. Each row links to an external primary source. Language is neutral;
 * status encodes whether something is an allegation, a formal filing, etc.
 */

export type AccountabilityStatus =
  | 'reported'
  | 'formal_filing'
  | 'provisional_measures'
  | 'investigation'
  | 'humanitarian_update';

export type AccountabilityCategory =
  | 'ceasefire'
  | 'ihl'
  | 'un_multilateral'
  | 'courts'
  | 'humanitarian'
  | 'health';

export type AccountabilityEvent = {
  id: string;
  date: string;
  framework: string;
  category: AccountabilityCategory;
  summary: string;
  source: string;
  url: string;
  status: AccountabilityStatus;
};

export const ACCOUNTABILITY_FILTER_IDS = [
  'all',
  'ceasefire',
  'ihl',
  'un_multilateral',
  'courts',
  'humanitarian',
] as const;

export type AccountabilityFilterId = (typeof ACCOUNTABILITY_FILTER_IDS)[number];

export const ACCOUNTABILITY_EVENTS: AccountabilityEvent[] = [
  {
    id: 'icj-192',
    date: '2024-12-19',
    framework: 'International Court of Justice',
    category: 'courts',
    summary:
      'ICJ public hearings on advisory opinion: obligations of States in respect of unlawful presence in the Occupied Palestinian Territory.',
    source: 'ICJ',
    url: 'https://www.icj-cij.org/case/192',
    status: 'formal_filing',
  },
  {
    id: 'icj-prov-jan-2024',
    date: '2024-01-26',
    framework: 'ICJ — provisional measures',
    category: 'courts',
    summary:
      'Court indicated provisional measures in the genocide convention case concerning Gaza; binding on parties pending final decision.',
    source: 'ICJ',
    url: 'https://www.icj-cij.org/case/192',
    status: 'provisional_measures',
  },
  {
    id: 'ocha-sitrep',
    date: '2025-01-15',
    framework: 'UN OCHA — humanitarian snapshot',
    category: 'humanitarian',
    summary:
      'Consolidated snapshot of humanitarian access, displacement, and priority needs in Gaza and the West Bank (check site for latest issue).',
    source: 'UN OCHA oPt',
    url: 'https://www.ochaopt.org/',
    status: 'humanitarian_update',
  },
  {
    id: 'unsc-2720',
    date: '2023-12-22',
    framework: 'UN Security Council',
    category: 'un_multilateral',
    summary:
      'Resolution 2720 (2023) expanded humanitarian delivery mechanisms and called for urgent steps to allow aid into Gaza.',
    source: 'UN Digital Library',
    url: 'https://digitallibrary.un.org/record/4037843',
    status: 'formal_filing',
  },
  {
    id: 'ohchr-opt',
    date: '2024-06-01',
    framework: 'UN OHCHR',
    category: 'ihl',
    summary:
      'Office of the High Commissioner landing page for occupied Palestinian territory: reports, statements, and monitoring context.',
    source: 'OHCHR',
    url: 'https://www.ohchr.org/en/occupied-palestinian-territory-including-east-jerusalem',
    status: 'reported',
  },
  {
    id: 'who-emergencies',
    date: '2024-10-01',
    framework: 'WHO — emergencies',
    category: 'health',
    summary:
      'WHO portal — use site search for occupied Palestinian territory / Gaza health emergencies and official health reporting.',
    source: 'WHO',
    url: 'https://www.who.int/',
    status: 'humanitarian_update',
  },
  {
    id: 'icc-opt',
    date: '2021-03-03',
    framework: 'International Criminal Court',
    category: 'courts',
    summary:
      'Pre-Trial Chamber decision on jurisdiction over the Situation in Palestine (territorial scope and procedural overview).',
    source: 'ICC',
    url: 'https://www.icc-cpi.int/palestine',
    status: 'formal_filing',
  },
  {
    id: 'unrwa-brief',
    date: '2024-05-01',
    framework: 'UNRWA',
    category: 'humanitarian',
    summary:
      'UNRWA situation briefs on agency operations, funding, and constraints affecting Palestinian refugees in Gaza and the region.',
    source: 'UNRWA',
    url: 'https://www.unrwa.org/gaza-emergency',
    status: 'humanitarian_update',
  },
  {
    id: 'hrw-ceasefire-docs',
    date: '2024-01-10',
    framework: 'NGO documentation (methodology varies)',
    category: 'ceasefire',
    summary:
      'Human Rights Watch materials on conduct of hostilities and accountability themes; read with NGO methodology caveats.',
    source: 'Human Rights Watch',
    url: 'https://www.hrw.org/middle-east-north-africa/israel-palestine',
    status: 'reported',
  },
  {
    id: 'amnesty-opt',
    date: '2024-04-01',
    framework: 'NGO documentation (methodology varies)',
    category: 'ihl',
    summary:
      'Amnesty International country hub for Israel and occupied Palestinian territory; allegations and campaign materials.',
    source: 'Amnesty International',
    url: 'https://www.amnesty.org/en/location/middle-east-and-north-africa/israel-and-occupied-palestinian-territories/',
    status: 'reported',
  },
];

export function accountabilityStatusLabel(s: AccountabilityStatus): string {
  const labels: Record<AccountabilityStatus, string> = {
    reported: 'Reported / documented',
    formal_filing: 'Formal filing / resolution',
    provisional_measures: 'Provisional measures',
    investigation: 'Investigation',
    humanitarian_update: 'Humanitarian update',
  };
  return labels[s];
}

export function accountabilityLatestDate(events: AccountabilityEvent[]): string | null {
  if (!events.length) return null;
  const sorted = [...events].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return sorted[0]?.date ?? null;
}
