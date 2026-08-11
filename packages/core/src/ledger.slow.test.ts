import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import type { RespectTier } from '@ed/schema';
import { RESPECT_ORDER } from '@ed/schema';
import {
  bootstrap, runYears, stepYear, applyEffect, makeRng, mint, previewTemplate,
  tickRelationships, tickRespect,
} from '@ed/core';

const bundle = loadContent();
const SEEDS = [1042, 77, 909, 5150, 8080, 31];

/**
 * THE SILENT SUBSYSTEMS.
 *
 * Every assertion in this file covers something that was declared in the
 * schema, referenced by authored content or named in the concept brief, and
 * implemented by nothing. None of them threw. Each one looked, from the
 * outside, exactly like a working feature that happened not to have come up.
 */

describe('the Ledger pays out (concept §18)', () => {
  it('starts the player knowing exactly one clause', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    expect(ctx.world.clausesRecovered.size).toBe(1);
    expect(bundle.clauses.filter((c) => c.known)).toHaveLength(1);
  });

  it('has nine clauses and never reveals one twice', () => {
    expect(bundle.clauses).toHaveLength(9);
    const ctx = bootstrap(bundle, 1042, 1042);
    runYears(ctx, 1000);
    const revealed = ctx.world.chronicle.filter((c) => bundle.clauses.some((x) => x.name === c.title));
    expect(new Set(revealed.map((c) => c.title)).size).toBe(revealed.length);
  });

  /**
   * The failure this replaces: a measured thousand-year run recovered TWO
   * clauses of nine, from the three authored events that happen to grant one.
   * The God rung requires seven, so the ending the whole game points at was
   * unreachable and nothing said so.
   */
  it('recovers most of the contract over a run', () => {
    const counts = SEEDS.map((seed) => {
      const ctx = bootstrap(bundle, seed, 1042);
      runYears(ctx, 1000);
      return ctx.world.clausesRecovered.size;
    });
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    expect(mean, `recovered ${counts.join(',')}`).toBeGreaterThan(4);
    expect(counts.some((c) => c >= 7), 'no run reached the God gate of seven clauses').toBe(true);
  });

  /**
   * And the other half of §18: "a run that reaches 2042 having recovered three
   * clauses has a genuinely worse endgame than one that recovered eight." If
   * every run recovers all nine, that sentence describes nothing.
   */
  it('does not hand every run the whole contract', () => {
    const counts = SEEDS.map((seed) => {
      const ctx = bootstrap(bundle, seed, 1042);
      runYears(ctx, 1000);
      return ctx.world.clausesRecovered.size;
    });
    expect(Math.min(...counts), `every run recovered ${counts.join(',')}`).toBeLessThan(9);
  });

  /**
   * Issue #4: per-Age assignment means `revealClause` draws from the ACTIVE
   * Age's own set rather than global weight order, so two runs that recover
   * the same NUMBER of clauses need not recover the same ones — that now
   * depends on which Ages they drew. Comparing sets across the whole seed set
   * is not enough to show that: counts differ seed to seed regardless of
   * mechanism, so two runs of different lengths always look "different" even
   * as prefixes of one fixed order. The real claim is about runs that tie —
   * a bigger seed set to guarantee (pigeonhole, at most ten possible counts)
   * that some pair does.
   */
  it('varies which clauses a run recovers, not merely how many', () => {
    const seeds = Array.from({ length: 12 }, (_, i) => 1000 + i * 7);
    const byCount = new Map<number, Set<string>[]>();
    for (const seed of seeds) {
      const ctx = bootstrap(bundle, seed, 1042);
      runYears(ctx, 1000);
      const recovered = ctx.world.clausesRecovered;
      byCount.set(recovered.size, [...(byCount.get(recovered.size) ?? []), new Set(recovered)]);
    }

    let divergentTie = false;
    for (const sets of byCount.values()) {
      if (sets.length < 2) continue;
      const signatures = new Set(sets.map((s) => [...s].sort().join(',')));
      if (signatures.size > 1) divergentTie = true;
    }
    expect(divergentTie, 'every pair of runs that tied on clause COUNT recovered the exact same SET').toBe(true);
  });

  /**
   * Over the seed set, not one seed for six hundred years. Whether any
   * PARTICULAR run has hired an archivist and named an Age by 1642 is exactly
   * the variance the two tests above exist to protect; this one is about what a
   * reveal LOOKS like when it happens, and it should not be able to fail
   * because a house was slow to hire.
   */
  it('writes the clause into the chronicle in the contract\'s own hand', () => {
    let seen = 0;
    for (const seed of SEEDS) {
      const ctx = bootstrap(bundle, seed, 1042);
      runYears(ctx, 1000);
      const entries = ctx.world.chronicle.filter((c) => bundle.clauses.some((x) => x.name === c.title));
      for (const e of entries) {
        seen += 1;
        expect(e.weight).toBe('illuminated');
        // Nobody in the family wrote it, so no Record choice was ever offered.
        expect(e.record).toBeUndefined();
        expect(bundle.clauses.some((x) => x.text === e.text)).toBe(true);
      }
    }
    expect(seen, 'no clause was revealed in any run').toBeGreaterThan(0);
  });
});

describe('hostility is an edge (concept §7)', () => {
  /**
   * Four authored outcomes emit `kind: relationship`, including the seal
   * feud's own grudge — severity 60, inheritance all_blood. The effect switch
   * listed the case, commented that it was handled by its own subsystem, and
   * broke. There was no subsystem, and every one of those effects discarded
   * itself in silence.
   */
  it('records a grudge that authored content asks for', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    const [a, b] = ctx.world.people.living();
    applyEffect(
      {
        kind: 'relationship',
        from: { slot: 'A' },
        to: { slot: 'B' },
        sentiment: -30,
        grudge: { severity: 60, inheritance: 'all_blood' },
      },
      ctx,
      { A: a!.id, B: b!.id },
    );
    expect(ctx.world.relationships.size).toBeGreaterThan(0);
    const held = [...ctx.world.relationships.values()].flatMap((r) => r.grudges);
    expect(held).toHaveLength(1);
    expect(held[0]!.inheritance).toBe('all_blood');
  });

  /** A feud whose parties are both dead within forty years is not a feud. */
  it('outlives the people who took it', () => {
    let oldest = 0;
    for (const seed of SEEDS) {
      const ctx = bootstrap(bundle, seed, 1042);
      for (let i = 0; i < 800; i++) {
        stepYear(ctx);
        for (const rel of ctx.world.relationships.values()) {
          for (const g of rel.grudges) oldest = Math.max(oldest, ctx.world.year - g.originYear);
        }
      }
    }
    expect(oldest, 'no grudge ever outlived a generation').toBeGreaterThan(40);
  });

  it('lets a quarrel end rather than accumulating edges forever', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    const [a, b] = ctx.world.people.living();
    applyEffect(
      { kind: 'relationship', from: { slot: 'A' }, to: { slot: 'B' }, sentiment: -4 },
      ctx,
      { A: a!.id, B: b!.id },
    );
    expect(ctx.world.relationships.size).toBe(1);
    for (let i = 0; i < 400; i++) tickRelationships(ctx);
    expect(ctx.world.relationships.size, 'sentiment never cooled').toBe(0);
  });

  it('keeps the edge count bounded across a full run', () => {
    const ctx = bootstrap(bundle, 77, 1042);
    runYears(ctx, 1000);
    expect(ctx.world.relationships.size).toBeLessThan(60);
  });
});

describe('contracts end (concept §17)', () => {
  /**
   * `mint` overwrote the authored `boundTo` with the house id, so the employer
   * could never die, so `onEmployerDeath` — declared on all four authored
   * contracts — was unreachable. `term` was unreachable with it.
   */
  it('binds a retainer to a person, so the contract can end', () => {
    const ctx = bootstrap(bundle, 5, 1042);
    const template = bundle.characterTemplates.find((t) => t.contract)!;
    const p = mint(template, ctx, makeRng(5), { household: ctx.world.playerHouse, membership: 'retainer' });
    const employer = ctx.world.people.get(p.contract!.boundTo);
    expect(employer, 'bound to something that is not a person').toBeDefined();
    expect(employer!.castSlots).toContain('head');
  });

  it('never leaves a retainer serving a corpse for a century', () => {
    for (const seed of SEEDS) {
      const ctx = bootstrap(bundle, seed, 1042);
      runYears(ctx, 600);
      const w = ctx.world;
      for (const p of w.people.living()) {
        if (!p.contract) continue;
        const boss = w.people.get(p.contract.boundTo);
        if (!boss) continue;                       // bound to the house itself
        const lapsed = boss.status !== 'alive' && w.year - (boss.died ?? w.year) > 2;
        expect(lapsed, `${p.name} still serves ${boss.name}, dead since ${boss.died}`).toBe(false);
      }
    }
  });

  /** "Servant dynasties need real lineage too" — the steward's own blurb. */
  it('passes a hereditary post to the holder\'s child', () => {
    let inherited = 0;
    for (const seed of SEEDS) {
      const ctx = bootstrap(bundle, seed, 1042);
      runYears(ctx, 800);
      inherited += ctx.world.chronicle.filter((c) => c.text?.includes('took up')).length;
    }
    expect(inherited, 'no hereditary post ever passed to a child in six runs').toBeGreaterThan(0);
  });
});

describe('standing decays (concept §17)', () => {
  /**
   * Respect moved only when an authored effect moved it, so half the measured
   * runs sat at their high-water mark from the century they reached it — and
   * the endgame squeeze ("Madness to ascend, Respect to be allowed to, and
   * Madness destroys Respect") had one of its three jaws missing.
   */
  /**
   * Asserted as "standing goes DOWN during a run", not as "six seeds end on
   * six different tiers". The second is what a ratchet looks like from a
   * distance, and it is also what a run of bad luck looks like: the first cut
   * of this test failed the day the RNG streams were split, on a codebase where
   * standing was demonstrably still moving in every run. Sixteen seeds through
   * the harness ended across four tiers on the same commit.
   *
   * A ratchet is a mechanism that cannot turn backwards. Watch it turn.
   */
  it('does not ratchet — standing falls as well as rises', () => {
    let runsThatFell = 0;
    for (const seed of SEEDS) {
      const ctx = bootstrap(bundle, seed, 1042);
      let highest = RESPECT_ORDER.indexOf(ctx.world.respect);
      let fell = false;
      for (let i = 0; i < 1000; i++) {
        stepYear(ctx);
        const now = RESPECT_ORDER.indexOf(ctx.world.respect);
        if (now < highest) fell = true;
        highest = Math.max(highest, now);
      }
      if (fell) runsThatFell += 1;
    }
    expect(runsThatFell, 'standing never fell in any run — it is a ratchet').toBe(SEEDS.length);
  });

  /**
   * Driven directly rather than through `runYears`, because authored `respect`
   * effects fire during a run and would make this assert "something moved
   * standing" rather than "a quiet generation costs a tier".
   */
  const quietYears = (seed: number, from: RespectTier, years: number) => {
    const ctx = bootstrap(bundle, seed, 1042);
    ctx.world.respect = from;
    ctx.world.respectChanged = ctx.world.year;
    for (let i = 0; i < years; i++) {
      ctx.world.year += 1;
      tickRespect(ctx);
    }
    return ctx.world.respect;
  };

  it('costs a tier for a generation of doing nothing', () => {
    expect(quietYears(1042, 'eminent', 60)).toBe('regarded');
    expect(quietYears(1042, 'exalted', 200)).toBe('known');
  });

  /**
   * The floor is load-bearing: Unknown pays 16 a year against twenty mouths,
   * so a house decayed to it can never afford an archivist and never recovers
   * another clause. Getting there has to be something done TO you.
   */
  it('never decays below Known', () => {
    expect(quietYears(77, 'known', 400)).toBe('known');
  });
});

describe('previews leave no trace', () => {
  /**
   * The preview removed its people and refunded the ration, so it looked
   * clean — and left `counters.person` advanced by twenty-four. Conception
   * seeds derive from parent ids, so inspecting a recipe renamed every child
   * born afterwards and gave them different genomes.
   */
  it('restores the id counters it spent', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    runYears(ctx, 40);
    const before = { ...ctx.world.counters };

    const template = bundle.characterTemplates[0]!;

    // A real mint spends ids — that is the control.
    mint(template, ctx, makeRng(3), {});
    expect(ctx.world.counters.person, 'minting should spend ids').toBeGreaterThan(before.person);

    // The preview path must give every one of them back.
    const ctx2 = bootstrap(bundle, 1042, 1042);
    runYears(ctx2, 40);
    const snapshot = { ...ctx2.world.counters };
    previewTemplate(template, ctx2, 24, () => ({ carriedFont: 0, canExpress: false }), makeRng(3));
    expect(ctx2.world.counters).toEqual(snapshot);
  });

  /**
   * The proof that matters: a world that has been previewed into must produce
   * the same people as one that has not.
   */
  it('leaves the run it was inspecting unchanged', () => {
    const clean = bootstrap(bundle, 4242, 1042);
    const inspected = bootstrap(bundle, 4242, 1042);
    runYears(clean, 30);
    runYears(inspected, 30);

    previewTemplate(
      bundle.characterTemplates[0]!, inspected, 24,
      () => ({ carriedFont: 0, canExpress: false }), makeRng(11),
    );

    runYears(clean, 120);
    runYears(inspected, 120);
    expect(inspected.world.people.all().map((p) => `${p.name}:${p.born}`))
      .toEqual(clean.world.people.all().map((p) => `${p.name}:${p.born}`));
  });
});
