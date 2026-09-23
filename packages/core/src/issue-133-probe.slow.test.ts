import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { CAMPAIGN_YEARS } from './campaign.js';
import { playToTheEnd } from './tools/ending-gate.js';

/**
 * TEMPORARY #133 MEASUREMENT.
 *
 * This file exists only to let the repository's own runner execute the
 * 100-run ascendant batch while this remote session has no checkout. Remove it
 * after the result is read; no acceptance rule lives here.
 */
describe('#133 ascendant probe', () => {
  it('prints the 100 x 500 funnel after the Record-policy correction', () => {
    const source = loadContent();
    const runs = Array.from({ length: 100 }, (_, i) =>
      playToTheEnd(source, 5100 + i, CAMPAIGN_YEARS, 'ascendant'));

    const endings = new Map<string, number>();
    for (const r of runs) endings.set(r.ending, (endings.get(r.ending) ?? 0) + 1);

    const width = Math.max(...runs.map((r) => r.unmakingStageEver?.length ?? 0));
    const stages = Array.from({ length: width }, (_, i) =>
      runs.filter((r) => r.unmakingStageEver?.[i]).length);
    const atomicWidth = Math.max(...runs.map((r) => r.unmakingGateEver?.length ?? 0));
    const atomic = Array.from({ length: atomicWidth }, (_, i) =>
      runs.filter((r) => r.unmakingGateEver?.[i]).length);

    console.log('ISSUE133_PROBE ' + JSON.stringify({
      endings: Object.fromEntries(endings),
      offers: runs.reduce((n, r) => n + (r.templateFires?.the_unmaking ?? 0), 0),
      takers: runs.reduce((n, r) => n + (r.unmakingTakers ?? 0), 0),
      circleEight: runs.filter((r) => (r.circleAffinityPeak ?? 0) >= 8).length,
      booksEight: runs.filter((r) => (r.circleBookPeak ?? 0) >= 8).length,
      stages,
      atomic,
    }));
    expect(runs).toHaveLength(100);
  });
});
