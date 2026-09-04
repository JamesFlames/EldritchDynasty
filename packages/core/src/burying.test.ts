import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { applyEffect, testWorld } from '@ed/core';
import type { SimCtx } from '@ed/core';

const bundle = loadContent();

/**
 * PUTTING A LIE DOWN (§6, §29.4's fifth rule, issue #71).
 *
 * Twenty-three content sites create a Discrepancy and one could put one down,
 * so §29.3's bill — the creditor discounting the rung the book attests by what
 * the book cannot hold up — was close to unanswerable. Rule 5 is *reversible
 * by act, never by apology*, and a bill with no act against it is a tax.
 *
 * The engine half is that a bury may now name NO id and reach whatever the
 * house is actually carrying. That matters because of where real lies come
 * from: 23 come from content under literal ids, and one per Record block the
 * player embellishes comes from the player, under an id no scene can know.
 */
function lies(ctx: SimCtx, ...set: { id: string; severity: string; provableBy?: string[] }[]) {
  for (const l of set) {
    ctx.world.discrepancies.set(l.id, {
      severity: l.severity, provableBy: l.provableBy ?? [], state: 'open',
    });
  }
}

const state = (ctx: SimCtx, id: string) => ctx.world.discrepancies.get(id)?.state;

describe('a bury that names nothing', () => {
  it('takes the worst lie the house is carrying', () => {
    const ctx = testWorld(bundle, 7171, 1200);
    lies(ctx,
      { id: 'a_small_one', severity: 'minor' },
      { id: 'the_bad_one', severity: 'total' },
      { id: 'a_middling_one', severity: 'major' });

    applyEffect({ kind: 'discrepancy', op: 'bury' }, ctx, {});

    // `unsupportable` weights by severity, so the lie that costs most at the
    // term is the one a house spending real money is spending it on.
    expect(state(ctx, 'the_bad_one')).toBe('buried');
    expect(state(ctx, 'a_middling_one')).toBe('open');
    expect(state(ctx, 'a_small_one')).toBe('open');
  });

  it('reaches a lie the player made, which is the whole point', () => {
    const ctx = testWorld(bundle, 7172, 1200);
    // The shape a Record block's embellishment produces: an id no authored
    // scene can name, because the scene was written before the run existed.
    lies(ctx, { id: 'disc_chr_4f2a', severity: 'major' });

    applyEffect({ kind: 'discrepancy', op: 'bury' }, ctx, {});

    expect(state(ctx, 'disc_chr_4f2a')).toBe('buried');
  });

  it('buries nothing when the house is carrying nothing, and does not throw', () => {
    const ctx = testWorld(bundle, 7173, 1200);
    lies(ctx, { id: 'already_done', severity: 'total' });
    ctx.world.discrepancies.get('already_done')!.state = 'buried';

    applyEffect({ kind: 'discrepancy', op: 'bury' }, ctx, {});

    expect(state(ctx, 'already_done')).toBe('buried');
    expect([...ctx.world.discrepancies.values()].filter((d) => d.state === 'open')).toHaveLength(0);
  });

  /**
   * `provableBy` NARROWS. The Church scene buries a thing the Church could
   * have proved; the archivist buries a thing in the archive. Without this a
   * chantry endowment would silently settle a matter the Church has never
   * heard of, which is the world reacting to something it cannot see.
   */
  it('is narrowed by who could have proved it', () => {
    const ctx = testWorld(bundle, 7174, 1200);
    lies(ctx,
      { id: 'the_church_could_prove_it', severity: 'minor', provableBy: ['the_church'] },
      { id: 'only_bramme_could', severity: 'total', provableBy: ['house_bracc'] });

    applyEffect({ kind: 'discrepancy', op: 'bury', provableBy: ['the_church'] }, ctx, {});

    // The worse lie is left standing, because this scene cannot reach it.
    expect(state(ctx, 'the_church_could_prove_it')).toBe('buried');
    expect(state(ctx, 'only_bramme_could')).toBe('open');
  });

  /**
   * A lie nobody in particular can prove is reachable by any of them: there
   * is no one specific to buy off, so buying anybody off does it.
   */
  it('reaches a lie with no named prover from any scene', () => {
    const ctx = testWorld(bundle, 7175, 1200);
    lies(ctx, { id: 'nobody_in_particular', severity: 'minor' });

    applyEffect({ kind: 'discrepancy', op: 'bury', provableBy: ['the_church'] }, ctx, {});

    expect(state(ctx, 'nobody_in_particular')).toBe('buried');
  });

  /** A named id still means that id, and nothing else moves. */
  it('still takes the one it names when it names one', () => {
    const ctx = testWorld(bundle, 7176, 1200);
    lies(ctx,
      { id: 'the_named_one', severity: 'minor' },
      { id: 'a_worse_one', severity: 'total' });

    applyEffect({ kind: 'discrepancy', op: 'bury', id: 'the_named_one' }, ctx, {});

    expect(state(ctx, 'the_named_one')).toBe('buried');
    expect(state(ctx, 'a_worse_one')).toBe('open');
  });
});
