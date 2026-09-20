/**
 * THE CANONICAL LONG-LINE CLOCK (issue #133).
 *
 * #66 will add a second campaign profile for A Short Line. Until then this is
 * deliberately small: one source for the founding year, the Long-Line term,
 * and the span between them. Do not grow a second campaign-definition system
 * beside #66; these constants are the seam that issue can lift into profiles.
 */
export const START_YEAR = 1042;
export const END_YEAR = 1542;
export const CAMPAIGN_YEARS = END_YEAR - START_YEAR;

/** The old 1,000-year curve became harsher in its final 20% (after 1842). */
export const LATE_PHASE_FRACTION = 0.2;
export const LATE_PHASE_START = END_YEAR - CAMPAIGN_YEARS * LATE_PHASE_FRACTION;

/**
 * Preserve the old boundary convention: the threshold year itself is ordinary,
 * and the following year begins the late-game weighting.
 */
export function isLateCampaignYear(year: number): boolean {
  return year > LATE_PHASE_START;
}

/** A campaign-relative clock for authored early/middle/late conditions. */
export function campaignProgress(year: number): number {
  return Math.max(0, Math.min(1, (year - START_YEAR) / CAMPAIGN_YEARS));
}
