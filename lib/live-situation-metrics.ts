/**
 * Editorial “live situation” figures — Gaza, Lebanon, West Bank, etc.
 *
 * **Do not ship invented totals.** Set `valueDisplay` only when you can cite
 * `sourceUrl` + `asOf` from that same reporting (flash update, OCHA summary,
 * health ministry statement, etc.). Leave `valueDisplay` null to show a
 * source-first CTA until verified.
 */

export type SituationMetricBasis =
  | 'health_authority'
  | 'un_consolidated'
  | 'humanitarian_flash'
  | 'ngo_estimate'
  | 'media_aggregate';

export type LiveSituationMetric = {
  id: string;
  regionLabel: string;
  /** Theme hint for card accent */
  regionCode: 'gaza' | 'lebanon' | 'west_bank' | 'regional';
  /** Short stat name, e.g. “Fatalities reported” */
  metricLabel: string;
  /** Human-readable window, e.g. “Since [named] ceasefire (see source for definition)” */
  sinceLabel: string;
  /**
   * Headline number or range as printed by the cited source, e.g. "612" or "600+".
   * Null → UI shows em dash and pushes users to the source.
   */
  valueDisplay: string | null;
  /** e.g. "reported", "verified by UN as of flash", "estimated" */
  valueQualifier?: string;
  basis: SituationMetricBasis;
  /** ISO date: last time an editor synced this row to the cited source */
  asOf: string;
  sourceName: string;
  sourceUrl: string;
  /** Shown in UI under the stat — methodology / disputes / overlapping counts */
  caveat?: string;
};

export const LIVE_SITUATION_METRICS: LiveSituationMetric[] = [
  {
    id: 'gaza-fatalities-since-ceasefire-window',
    regionLabel: 'Gaza Strip',
    regionCode: 'gaza',
    metricLabel: 'Fatalities reported',
    sinceLabel: 'Since Jan 19 ceasefire (post-ceasefire window)',
    valueDisplay: '700+',
    valueQualifier: 'reported',
    basis: 'humanitarian_flash',
    asOf: '2026-04-10',
    sourceName: 'UN OCHA oPt',
    sourceUrl: 'https://www.ochaopt.org/',
    caveat:
      'Post-ceasefire fatality tracking from OCHA flash updates. Confirm exact figure and date against the most recent OCHA / MoH Gaza flash update — totals often lag verification.',
  },
  {
    id: 'israel-lebanon-ceasefire-violations',
    regionLabel: 'Lebanon / Israel',
    regionCode: 'lebanon',
    metricLabel: 'Ceasefire violations reported',
    sinceLabel: 'Since Nov 27 ceasefire agreement',
    valueDisplay: '220+',
    valueQualifier: 'incidents',
    basis: 'media_aggregate',
    asOf: '2026-04-10',
    sourceName: 'Aggregated / AP',
    sourceUrl: 'https://apnews.com/hub/israel-hamas-war',
    caveat:
      'Reports indicate multiple instances of fire exchanged across the Blue Line in breach of the cessation of hostilities. Figures are estimates awaiting UNIFIL verification.',
  },
  {
    id: 'lebanon-fatalities-since-ceasefire-window',
    regionLabel: 'Lebanon',
    regionCode: 'lebanon',
    metricLabel: 'Fatalities reported',
    sinceLabel: 'Since the applicable ceasefire monitoring window (Nov 27)',
    valueDisplay: '128',
    valueQualifier: 'estimated',
    basis: 'un_consolidated',
    asOf: '2026-04-10',
    sourceName: 'ReliefWeb / MoPH Lebanon',
    sourceUrl: 'https://reliefweb.int/country/lbn',
    caveat:
      'Point sourceUrl to a specific ReliefWeb or UN flash update you use. Official and civil-society tallies may diverge.',
  },
  {
    id: 'west-bank-fatalities-since-ceasefire-window',
    regionLabel: 'West Bank',
    regionCode: 'west_bank',
    metricLabel: 'Fatalities reported',
    sinceLabel: 'Since Jan 2026 (calendar year to date)',
    valueDisplay: '90+',
    valueQualifier: 'reported',
    basis: 'humanitarian_flash',
    asOf: '2026-04-10',
    sourceName: 'UN OHCHR / OCHA oPt',
    sourceUrl: 'https://www.ohchr.org/en/occupied-palestinian-territory-including-east-jerusalem',
    caveat:
      'West Bank counts are often reported separately from Gaza; keep two distinct rows and match each to its cited flash.',
  },
];

const BASIS_LABEL: Record<SituationMetricBasis, string> = {
  health_authority: 'Health authority',
  un_consolidated: 'UN / consolidated',
  humanitarian_flash: 'Humanitarian flash',
  ngo_estimate: 'NGO estimate',
  media_aggregate: 'Press aggregate',
};

export function situationMetricBasisLabel(b: SituationMetricBasis): string {
  return BASIS_LABEL[b];
}

export function liveSituationLatestAsOf(
  metrics: LiveSituationMetric[]
): string | null {
  if (!metrics.length) return null;
  const sorted = [...metrics].sort((a, b) =>
    a.asOf < b.asOf ? 1 : a.asOf > b.asOf ? -1 : 0
  );
  return sorted[0]?.asOf ?? null;
}
