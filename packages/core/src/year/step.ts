import type { SimCtx } from '../world.js';
import { streamFor } from '../rng.js';
import { emptyReport, type YearReport } from './report.js';
import { YEAR_PHASES } from './phases.js';

/**
 * Turn one year.
 *
 * The body of this function is now four lines and a guard, which is the point:
 * what a year IS lives in `phases.ts` as an ordered table, and this is only the
 * clock that runs it.
 */
export function stepYear(ctx: SimCtx, autoResolve = true): YearReport {
  const w = ctx.world;

  // The docket blocks the clock. A choice answered three years after the event
  // is not a choice, so the year does not turn while one is standing open — and
  // it says so, rather than returning a report that looks like a quiet year.
  // INVARIANT 9: the docket blocks the clock.
  if (w.pendingDecisions.length) {
    return { ...emptyReport(w.year), blocked: [...w.pendingDecisions] };
  }

  w.year += 1;
  const report = emptyReport(w.year);

  for (const phase of YEAR_PHASES) {
    phase.run({ ctx, rng: streamFor(w, phase.name), report, autoResolve });
  }

  return report;
}

export function runYears(ctx: SimCtx, n: number): YearReport[] {
  const out: YearReport[] = [];
  for (let i = 0; i < n; i++) out.push(stepYear(ctx));
  return out;
}
