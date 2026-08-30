import { describe, expect, it } from 'vitest';
import { loadBundle } from '@ed/content';
import type { ContentBundle } from '@ed/schema';
import { gateLadder } from './tools/ladder-gate.js';

const bundle = loadBundle();

/**
 * ISSUE #41'S SECOND HALF, PLAYED.
 *
 * `gate:ladder` is a function over a bundle rather than a script, for the
 * reason every gate here is: a gate nobody has watched fail is
 * indistinguishable from a gate that cannot fail. The negative it is handed
 * is not a contrived bundle — it is the game as it stood the day the issue
 * was written, with the ladder's bargains still offered and costing nothing.
 */
describe('the ladder gate', () => {
  const seeds = [4000, 4013, 4026];
  const years = 500;

  it('passes the shipped game: paying separates from refusing', () => {
    const { ok, lines } = gateLadder(bundle, { seeds, years });
    expect(ok, lines.join('\n')).toBe(true);
  }, 120_000);

  it('fails a game whose bargains cost the man nothing', () => {
    // Every Madness charge on the man who is climbing, removed and nothing
    // else touched: the scenes still fire, the player is still asked, and
    // the answer stops reaching the ladder. That is exactly the state
    // `ascension.ts` was reporting on its own Hierophant gate.
    const declawed: ContentBundle = {
      ...bundle,
      events: bundle.events.map((e) => {
        const onTheLadder = new Set(
          Object.entries(e.slots).filter(([, s]) => s.role === 'foremost').map(([id]) => id),
        );
        if (!onTheLadder.size || e.interaction.kind === 'narration') return e;
        return {
          ...e,
          interaction: {
            ...e.interaction,
            choices: e.interaction.choices.map((c) => ({
              ...c,
              outcomes: c.outcomes.map((o) => ({
                ...o,
                effects: o.effects.filter(
                  (f) => !(f.kind === 'madness' && typeof f.target === 'object'
                    && 'slot' in f.target && onTheLadder.has(f.target.slot)),
                ),
              })),
            })),
          },
        };
      }),
    };

    const { ok, lines } = gateLadder(declawed, { seeds, years });
    expect(ok, `the gate passed a game that charges nobody:\n${lines.join('\n')}`).toBe(false);
  }, 120_000);
});
