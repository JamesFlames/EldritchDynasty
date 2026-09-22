import type { SimCtx } from '../world.js';
import { streamFor } from '../rng.js';
import { emptyReport, type YearReport } from './report.js';
import { YEAR_PHASES } from './phases.js';
import { closeTheLedger, livingBlood } from '../ending.js';
import { campaignDef } from '../campaign.js';

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

  // THE TERM, OR THE LINE RUNNING OUT BEFORE IT REACHES IT (concept §3, issue
  // #39, and issue #42's second half). Both stop the clock the same way and
  // for the same reason: there is nobody left for it to turn for. A house can
  // reach the term with a book to read, or it can lose its last living blood in
  // 1142 and have nothing left to read TO — `broken_line` is a fact about the
  // room, not the calendar, and letting the household run out its remaining
  // centuries staffed by retainers with nobody holding the seal was never a
  // real state, just an unreachable one until the membership fix made it
  // reachable. The year that empties the line still finishes fully — this is
  // an ENTRY guard, evaluated on the call after that year's phases already
  // ran — so the reading is of a year that actually happened, the same way
  // the collection year itself is not skipped, only the year after it is refused.
  if (w.year >= campaignDef(w.campaign).endYear || livingBlood(w) === 0) {
    closeTheLedger(ctx);
    return emptyReport(w.year);
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
