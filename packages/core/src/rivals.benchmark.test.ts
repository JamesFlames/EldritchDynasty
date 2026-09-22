import { describe, expect, it } from 'vitest';
import { runOnce } from './harness.js';
import { RIVAL_LINEAGE_HOUSES } from './people/rivals.js';

/**
 * TEMPORARY #149 BENCHMARK PROBE.
 *
 * The issue requires the same 8 x 1000 cohort before and after enabling all
 * six rival lineages, with a ~2x total-harness ceiling. This deliberately
 * lives in the fast tier while the PR is a draft so GitHub gives both samples
 * on the same runner class. Remove this file before the Stage-2 branch lands;
 * timing is evidence recorded on the issue, not a permanent test threshold.
 */
describe('rival-lineage Stage-2 benchmark probe', () => {
  it('measures the issue cohort without turning wall-clock noise into an assertion', () => {
    const started = performance.now();
    const runs = Array.from({ length: 8 }, (_, i) => runOnce(1000 + i * 7, 1000));
    const elapsedMs = performance.now() - started;

    console.log(
      `[rival-benchmark] houses=${RIVAL_LINEAGE_HOUSES.length} runs=8 years=1000 elapsed_ms=${elapsedMs.toFixed(0)}`,
    );

    // Timing is intentionally not asserted; the issue's 2x comparison is
    // between the two recorded samples, not a flaky absolute runner clock.
    expect(runs).toHaveLength(8);
    expect(runs.every((r) => r.seed >= 1000)).toBe(true);
  });
});
