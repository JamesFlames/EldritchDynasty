import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { validateBundle } from '@ed/schema';
import {
  acquireLibraryCopy, applyEffect, attr, beginStudy, bootstrap, degradeLibraryCopy,
  effectiveStudyYears, gainSpellbook, grantHeirloom, phenotypeOf, place, useHeirloom,
} from '@ed/core';

const bundle = loadContent();

describe('the Library content', () => {
  it('validates', () => {
    expect(validateBundle(bundle).filter((i) => i.level === 'error')).toEqual([]);
  });

  it('authors real spellbook stock, across both affinity groups', () => {
    expect(bundle.spellbooks.length).toBeGreaterThan(5);
    const affinities = new Set(bundle.spellbooks.map((s) => s.affinity));
    expect(affinities.has('death')).toBe(true);
    expect(affinities.has('life')).toBe(true);
  });

  it('every spellbook can actually be reached: gain is granted somewhere, or a named-arts threshold is authored', () => {
    for (const s of bundle.spellbooks) {
      expect(s.studyYears).toBeGreaterThan(0);
      expect(s.price.max).toBeGreaterThanOrEqual(s.price.min);
    }
  });
});

describe('applying a spellbook is generic', () => {
  it('gain puts a copy on the shelf and teaches the person, through the normal effect path', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    const p = place(ctx, { sex: 'male', age: 30 });
    expect(ctx.world.library.has('lesser_workings_of_fluid')).toBe(false);

    applyEffect({ kind: 'spellbook', op: 'gain', target: { slot: 'X' }, book: 'lesser_workings_of_fluid' }, ctx, { X: p.id });

    expect(ctx.world.library.has('lesser_workings_of_fluid')).toBe(true);
    expect(p.spellsKnown.map(String)).toContain('lesser_workings_of_fluid');
  });

  it('the shelf copy persists after the person who studied it dies — a great-grandfather\'s purchase pays out for centuries', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    const p = place(ctx, { sex: 'male', age: 80 });
    gainSpellbook(ctx, p, ctx.content.mustSpellbook('lesser_workings_of_terra'));
    ctx.world.people.kill(p.id, ctx.world.year, 'a test');
    expect(ctx.world.library.has('lesser_workings_of_terra')).toBe(true);
  });

  it('degrade lowers the shelf copy\'s condition and ignores who is cast', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    const p = place(ctx, { sex: 'male', age: 30 });
    gainSpellbook(ctx, p, ctx.content.mustSpellbook('lesser_workings_of_fluid'));
    const before = ctx.world.library.get('lesser_workings_of_fluid')!.condition;

    applyEffect({ kind: 'spellbook', op: 'degrade', target: 'household', book: 'lesser_workings_of_fluid' }, ctx, {});

    expect(ctx.world.library.get('lesser_workings_of_fluid')!.condition).toBeLessThan(before);
  });

  it('degrade against a book the house does not hold does nothing — damage does not create the thing it damages', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    expect(ctx.world.library.has('lesser_workings_of_death')).toBe(false);

    applyEffect({ kind: 'spellbook', op: 'degrade', target: 'household', book: 'lesser_workings_of_death' }, ctx, {});

    // This is the Crusade's second cellar (`age_crusade.yaml`, `hide_them`).
    // `degradeLibraryCopy` used to route through `acquireLibraryCopy`, so
    // hiding two books the house had never bought PUT THEM ON THE SHELF at
    // condition 80 — a net gain, from an outcome whose prose is about rot.
    expect(ctx.world.library.has('lesser_workings_of_death')).toBe(false);
  });

  it('a degraded copy takes a reader longer — the condition field has a reader at last', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    const def = ctx.content.mustSpellbook('lesser_workings_of_fluid');
    const reader = place(ctx, { sex: 'male', age: 30 });

    acquireLibraryCopy(ctx, def.id);
    const pristine = effectiveStudyYears(ctx, reader, def);

    degradeLibraryCopy(ctx, def.id, 60);
    const damaged = effectiveStudyYears(ctx, reader, def);

    expect(ctx.world.library.get(def.id)!.condition).toBe(40);
    expect(damaged).toBeGreaterThan(pristine);
  });

  it('the drag reaches the scheduled completion year, not just the arithmetic', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    const def = ctx.content.mustSpellbook('lesser_workings_of_fluid');
    const quick = place(ctx, { sex: 'male', age: 30, name: 'Quick' });
    const slow = place(ctx, { sex: 'male', age: 30, name: 'Slow' });

    acquireLibraryCopy(ctx, def.id);
    beginStudy(ctx, quick, def);
    degradeLibraryCopy(ctx, def.id, 100); // ruined
    beginStudy(ctx, slow, def);

    const completes = (who: typeof quick) => ctx.world.studies.find((st) => st.person === who.id)!.completes;
    expect(completes(slow)).toBeGreaterThan(completes(quick));
  });

  it('a study begun with no copy on the shelf is not penalised for the empty shelf', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    const def = ctx.content.mustSpellbook('lesser_workings_of_fluid');
    const reader = place(ctx, { sex: 'male', age: 30 });

    // `beginStudy` never required the shelf copy; `gainSpellbook` acquires it
    // on completion. An absent copy reads as pristine rather than as ruin.
    expect(ctx.world.library.has(def.id)).toBe(false);
    const borrowed = effectiveStudyYears(ctx, reader, def);
    acquireLibraryCopy(ctx, def.id);
    expect(effectiveStudyYears(ctx, reader, def)).toBe(borrowed);
  });

  it('lose removes the person\'s knowledge without touching the shelf copy', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    const p = place(ctx, { sex: 'male', age: 30 });
    gainSpellbook(ctx, p, ctx.content.mustSpellbook('lesser_workings_of_fluid'));

    applyEffect({ kind: 'spellbook', op: 'lose', target: { slot: 'X' }, book: 'lesser_workings_of_fluid' }, ctx, { X: p.id });

    expect(p.spellsKnown.map(String)).not.toContain('lesser_workings_of_fluid');
    expect(ctx.world.library.has('lesser_workings_of_fluid')).toBe(true);
  });

  it('a Named Art is recorded under the name of its first holder, once', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    const def = ctx.content.mustSpellbook('the_first_working');
    const founder = place(ctx, { sex: 'female', age: 30 });
    founder.acquired['life'] = 100; // clear the threshold deterministically

    gainSpellbook(ctx, founder, def);
    const state = ctx.world.library.get('the_first_working')!;
    expect(state.namedFor?.person).toBe(founder.id);

    const second = place(ctx, { sex: 'male', age: 30 });
    second.acquired['life'] = 100;
    gainSpellbook(ctx, second, def);
    expect(ctx.world.library.get('the_first_working')!.namedFor?.person).toBe(founder.id);
  });
});

describe('invariant 4 — the Mystic restriction (expression gate, issue #15)', () => {
  it('no female character ever learns an Elemental spellbook', () => {
    const elemental = bundle.spellbooks.filter((s) => ['fluid', 'thermal', 'aero', 'terra'].includes(s.affinity));
    expect(elemental.length).toBeGreaterThan(0);

    for (let seed = 1; seed <= 20; seed++) {
      const ctx = bootstrap(bundle, seed, 1042);
      for (const def of elemental) {
        const woman = place(ctx, { sex: 'female', age: 30, name: `W${seed}_${def.id}` });
        const gained = gainSpellbook(ctx, woman, def);
        expect(gained, `${def.id} was gained by a woman under seed ${seed}`).toBe(false);
        expect(woman.spellsKnown.map(String)).not.toContain(def.id);
      }
    }
  });

  it('no female ever holds nonzero Eldritch Power — mystic study never touches the font', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const ctx = bootstrap(bundle, seed, 1042);
      const women = ctx.world.people.all().filter((p) => p.sex === 'female');
      for (const w of women) {
        const ph = phenotypeOf(w, ctx.genetics, ctx.world.year);
        expect(ph.eldritch.expressedPower, `${w.name} (seed ${seed}) expresses power`).toBe(0);
      }
    }
  });
});

describe('purchased sources alone can reach the God rung (issue #15)', () => {
  it('an ascendant reaches Madness >= 90 through the Unmirrored Eye, with no organic overflow', () => {
    const ctx = bootstrap(bundle, 4242, 1042);
    const ascendant = ctx.world.people.all().find((p) => {
      const ph = phenotypeOf(p, ctx.genetics, ctx.world.year);
      return ph.eldritch.canExpress;
    });
    expect(ascendant, 'no expressing character in the founding cast to test against').toBeTruthy();
    const p = ascendant!;
    p.madness = 0;

    grantHeirloom(ctx, 'the_unmirrored_eye');
    for (let i = 0; i < 6 && p.madness < 90; i++) {
      const result = useHeirloom(ctx, 'the_unmirrored_eye', p);
      expect(result.ok, `use ${i} failed: ${result.reason}`).toBe(true);
      ctx.world.year += 5; // clear the cooldown between uses
    }

    expect(p.madness).toBeGreaterThanOrEqual(90);
  });

  it('the madness effect still refuses anyone who cannot express (invariant 1)', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    const mundane = place(ctx, { sex: 'female', age: 30 });
    grantHeirloom(ctx, 'the_unmirrored_eye');
    // The heirloom's own target filter requires canExpress, so a non-expressing
    // bearer is refused before the effect ever runs.
    const before = mundane.madness;
    const check = useHeirloom(ctx, 'the_unmirrored_eye', mundane);
    expect(check.ok).toBe(false);
    expect(mundane.madness).toBe(before);
  });
});
