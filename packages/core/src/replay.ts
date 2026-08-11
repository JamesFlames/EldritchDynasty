import type { Content, ContentBundle, LoggedDecision } from '@ed/schema';
import { assertNever } from '@ed/schema';
import { bootstrap } from './sim.js';
import { runYears } from './year/step.js';
import { canonical } from './save.js';
import type { SimCtx } from './world.js';

/**
 * REPLAY (issue #8).
 *
 * A save is a snapshot — `loadGame` puts a run back exactly where it stood,
 * but says nothing about the path that got it there. Every run in this
 * codebase is ALREADY fully reproducible from `(content, seed, startYear)`
 * alone, because nothing in `core` reaches for `Math.random()` (invariant 8)
 * and no decision here is answered by anything the seed cannot derive —
 * `choose`/`record`/`name` all draw from streams keyed by the decision's own
 * id or the current year, never from "how many draws happened before", so
 * replaying the exact same external answers at the exact same points always
 * reproduces the exact same run. That is what makes the decision log the
 * thing that turns a bug report from hour eleven of a playthrough back into
 * a seed and a sequence of calls, rather than a house nobody can rebuild.
 *
 * `replay` re-runs the simulation from the seed and independently rebuilds
 * ITS OWN decision log via the same three hooks (`commitOutcome`,
 * `applyRecord`, `renameChild`) that built the one passed in. If they do not
 * match exactly, the log lied about what happened — a bug in the hooks, not
 * something to shrug off — and this throws rather than silently returning a
 * run that does not match its own record. A decision log nothing ever checks
 * against a fresh run is this codebase's canonical dead feature.
 */
export class ReplayMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReplayMismatchError';
  }
}

export function replay(
  source: ContentBundle | Content,
  log: readonly LoggedDecision[],
  seed: number,
  startYear: number,
  years: number,
): SimCtx {
  const ctx = bootstrap(source, seed, startYear);
  runYears(ctx, years);

  const got = canonical(ctx.world.decisionLog);
  const want = canonical(log);
  if (got !== want) {
    throw new ReplayMismatchError(
      `replay diverged from the recorded log at seed ${seed}: rebuilt `
      + `${ctx.world.decisionLog.length} decisions, expected ${log.length}`,
    );
  }
  return ctx;
}

/** One readable line per decision — what the harness prints to bisect a run. */
export function describeDecision(d: LoggedDecision): string {
  switch (d.kind) {
    case 'outcome':
      return `${d.year}  ${d.event}${d.choiceId ? `/${d.choiceId}` : ''} -> ${d.outcomeId}`;
    case 'record':
      return `${d.year}  ${d.event} recorded as ${d.option}`;
    case 'name':
      return `${d.year}  ${d.person} named ${d.name}`;
    default:
      return assertNever(d, 'logged decision');
  }
}
