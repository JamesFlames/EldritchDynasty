import type { Content, ContentBundle, EventTemplate } from '@ed/schema';
import { indexContent } from '@ed/schema';
import { bootstrap } from '../sim.js';
import { runYears } from '../year/step.js';

/**
 * WHICH BRANCHES A RUN ACTUALLY REACHES.
 *
 * The frequency ledger counts TEMPLATE fires, which is what gate 4 measures
 * and what `world.frequency.templateFires` exists for. It has nothing to say
 * about the shape underneath a template: an event that fires in 85% of runs
 * can still have a choice nobody has ever been offered, because `requires`
 * reads attributes off the people cast in that particular year, and a check
 * band nobody has ever cleared, because the difficulty sits above what the
 * population produces.
 *
 * Both are invisible to every other instrument in the codebase. They are not
 * statically impossible — `outcomes/weights` is right to pass them — and they
 * do not dent the event's fire rate. The only way to see them is to run the
 * game and look at what was decided, which `world.decisionLog` already records
 * in full because replay (issue #8) needed it to.
 */

/** The identity of one authored branch, stable across runs. */
export function outcomeKey(event: string, choiceId: string | undefined, outcomeId: string): string {
  return `${event}|${choiceId ?? ''}|${outcomeId}`;
}

/** How a branch reads in a gate's output. */
function outcomeLabel(event: string, choiceId: string | undefined, outcomeId: string): string {
  return `${event}${choiceId ? `/${choiceId}` : ''} -> ${outcomeId}`;
}

/**
 * Every `(event, choice, outcome)` triple the content declares, keyed the same
 * way the decision log will report them. Narration has one implicit branch and
 * no choice id, which is why the key carries an empty segment rather than
 * omitting one — a choice named `''` is not authorable, so the two can never
 * collide.
 */
export function declaredOutcomes(source: ContentBundle | Content): Map<string, string> {
  const content = indexContent(source);
  const out = new Map<string, string>();

  const add = (e: EventTemplate, choiceId: string | undefined, outcomeId: string) => {
    out.set(outcomeKey(String(e.id), choiceId, outcomeId), outcomeLabel(String(e.id), choiceId, outcomeId));
  };

  for (const e of content.events) {
    if (e.interaction.kind === 'narration') {
      for (const o of e.interaction.outcomes) add(e, undefined, o.id);
    } else {
      for (const c of e.interaction.choices) for (const o of c.outcomes) add(e, c.id, o.id);
    }
  }
  return out;
}

/**
 * How many of `runs` seeded runs reached each branch at least once.
 *
 * Counted per RUN, not per firing, so a repeatable event that resolves the
 * same way forty times in one run contributes one — the same convention gate 4
 * uses, and the one that makes the number mean "how many players see this".
 */
export function outcomeReach(
  source: ContentBundle | Content,
  runs: number,
  years: number,
): Map<string, number> {
  const content = indexContent(source);
  const seenIn = new Map<string, number>();

  for (let i = 0; i < runs; i++) {
    const ctx = bootstrap(content, 5000 + i * 7, 1042);
    runYears(ctx, years);

    const here = new Set<string>();
    for (const d of ctx.world.decisionLog) {
      if (d.kind !== 'outcome') continue;
      here.add(outcomeKey(d.event, d.choiceId, d.outcomeId));
    }
    for (const key of here) seenIn.set(key, (seenIn.get(key) ?? 0) + 1);
  }

  return seenIn;
}
