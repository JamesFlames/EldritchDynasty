import type { Content, ContentBundle, RetainerContract, RetainerRole } from '@ed/schema';
import { MAIN_BRANCH, indexContent } from '@ed/schema';
import { bootstrap } from '../sim.js';
import type { SimCtx } from '../world.js';
import { place, marry } from '../testing.js';
import { genomeOf, phenotypeOf } from '../people/factory.js';
import { ELDRITCH_GIFT } from '../genetics/expression.js';

/**
 * TEST FAMILIES (issue #22) — hand-crafted fixtures at the edges of the
 * demographic and Record-history space content actually has to survive.
 * "Most Record-dependent content only misbehaves against one of these two
 * [honest/storybook]" is the whole justification: an event authored and
 * eyeballed against the founding cast alone has never been asked whether it
 * still makes sense in a forty-person sprawl or a house that has never once
 * told the truth about itself.
 *
 * Shared between the editor (a live inspector over each fixture) and
 * `tools/gates.ts`'s gate 2 (slot-fillability) — a template that can never
 * cast against ANY of these six is a template the ambient pool will starve
 * quietly, the same failure mode gate 4's fire-rate measurement exists for,
 * one layer earlier.
 */
export interface TestFamily {
  id: string;
  name: string;
  description: string;
  build(source: ContentBundle | Content): SimCtx;
}

/** An aging couple, past childbearing, with no children at all — and staying that way. */
function barrenGeneration(source: ContentBundle | Content): SimCtx {
  const ctx = bootstrap(source, 8101, 1042);
  const head = place(ctx, { sex: 'male', age: 55, name: 'Barren Head', castSlots: ['head'] });
  const wife = place(ctx, { sex: 'female', age: 52, name: 'Barren Wife' });
  marry(ctx, head, wife);
  return ctx;
}

/**
 * One man, one chair, for a lifetime — Demigod Stagnation (concept §22).
 *
 * And he is actually ON THE LADDER, which he was not: this fixture was named
 * for §22's top rungs and held a seventy-year-old with a Madness of 60, no
 * blood he could express, no books and no rung at all. It was the only fixture
 * that claimed a place on the ladder and the six of them between them could
 * not cast a single scene written for one — which stayed invisible for as long
 * as `role: foremost` would hand a rite to any expresser, at rung `none`,
 * because the ration lived on the house rather than on the man.
 *
 * Built rather than bred, like every other fixture here. The genome is copied
 * from a founding man the run has already made an expresser, because
 * `canExpress` is computed from the genome (invariant 1) and a lazily rolled
 * one cannot be asked to carry a font on request.
 */
function demigodStagnant(source: ContentBundle | Content): SimCtx {
  const ctx = bootstrap(source, 8102, 1042);
  const head = place(ctx, { sex: 'male', age: 70, name: 'The Stagnant Head', castSlots: ['head'] });

  const expresser = ctx.world.people.living()
    .find((p) => p.id !== head.id && phenotypeOf(p, ctx.genetics, ctx.world.year).eldritch.canExpress);
  if (expresser) {
    head.genome = { kind: 'materialized', genome: genomeOf(expresser, ctx.genetics) };
    head.phenotype = undefined;
  }

  head.awakening.awakened = true;
  // Far past any channel of his own: what he wields is capped by his ceiling,
  // and the rest is the Madness a man at the top of the ladder is made of.
  head.acquired[ELDRITCH_GIFT] = 400;
  head.acquired.mind = 200;
  head.madness = 60;
  for (const b of indexContent(source).spellbooks.slice(0, 11)) head.spellsKnown.push(b.id);
  ctx.world.respect = 'eminent';
  // The rite rung four asks for, so he actually STANDS at the top half rather
  // than being blocked one gate below it. A fixture named for §22's stagnation
  // that stops at Hierophant is the same half-claim this function used to make.
  head.rites.push('vessel');

  ctx.world.headSince = ctx.world.year - 55;

  // AND THE SON, who is also on the ladder — which is §22's terminal irony as
  // a fixture rather than as a sentence: rung six needs a living elder AND
  // somebody separate who exceeds him, so a house with exactly one climbing
  // man cannot ascend at all. One man on the ladder could not cast `the_
  // unmaking`, and gate 2 said so the day that rite stopped refusing.
  const son = place(ctx, { sex: 'male', age: 40, name: 'A Son Who Waits' });
  if (expresser) {
    son.genome = { kind: 'materialized', genome: genomeOf(expresser, ctx.genetics) };
    son.phenotype = undefined;
  }
  son.awakening.awakened = true;
  son.acquired[ELDRITCH_GIFT] = 120;
  son.acquired.mind = 200;
  son.madness = 25;
  for (const b of indexContent(source).spellbooks.slice(0, 8)) son.spellsKnown.push(b.id);

  return ctx;
}

/** One living blood member and nobody else — the succession-crisis floor. */
function singleSurvivor(source: ContentBundle | Content): SimCtx {
  const ctx = bootstrap(source, 8103, 1042);
  for (const p of ctx.world.people.all()) {
    if (p.status === 'alive' && p.id !== ctx.world.narrator) ctx.world.people.kill(p.id, ctx.world.year, 'making room for the fixture');
  }
  place(ctx, { sex: 'male', age: 30, name: 'The Last One', castSlots: ['head'] });
  return ctx;
}

/**
 * Forty living members spread across several halls — the crowded end, and the
 * one fixture that holds POSTS. Careers are what a crowded house does with
 * sons it cannot seat or marry, so this is where they belong; it is also the
 * only reason gate 2 can now answer "is there anyone to cast" for content
 * gated on a `career` filter. Without them `the_coat_hung_up` was uncastable
 * against all six fixtures, which is exactly the silence gate 2 exists to
 * break.
 *
 * It also carries the full wage roll, for the same reason and one layer over:
 * a `retainer` slot casts anybody wearing a contract, and there is no filter
 * for WHICH contract, so content that wants the physician rather than the
 * gatekeeper narrows on the trait that post's template grants. A fixture with
 * no staff answers "can this cast" with a no that means nothing. Four posts
 * here, and the founding midwife covers the fifth.
 */
function fortyMemberSprawl(source: ContentBundle | Content): SimCtx {
  const ctx = bootstrap(source, 8104, 1042);
  place(ctx, { sex: 'male', age: 60, name: 'Sprawl Head', castSlots: ['head'] });
  for (let i = 0; i < 39; i++) {
    place(ctx, {
      sex: i % 2 === 0 ? 'male' : 'female',
      age: 6 + (i % 60),
      name: `Sprawl ${i}`,
      branch: i % 5 === 0 ? MAIN_BRANCH : `sprawl_hall_${i % 5}`,
    });
  }
  place(ctx, { sex: 'male', age: 34, name: 'Sprawl Commission', career: { career: 'military', heldYears: 12 } });
  place(ctx, { sex: 'male', age: 41, name: 'Sprawl Cassock', career: { career: 'clergy', heldYears: 20 } });
  place(ctx, { sex: 'male', age: 28, name: 'Sprawl Counting House', career: { career: 'merchant', heldYears: 6 } });

  const post = (role: RetainerRole, wage: number): RetainerContract => ({
    role,
    term: 'lifetime',
    wage,
    loyalty: 55,
    boundTo: ctx.world.playerHouse,
    onEmployerDeath: 'passes_to_heir',
    debt: 0,
    knowsSecrets: [],
  });
  place(ctx, {
    sex: 'female', age: 44, name: 'Sprawl Physician',
    traits: ['competent_physician', 'keeps_the_sickroom'], contract: post('physician', 7),
  });
  place(ctx, {
    sex: 'male', age: 36, name: 'Sprawl Singer',
    traits: ['keeps_the_house_songs'], contract: post('singer', 2),
  });
  place(ctx, {
    sex: 'male', age: 39, name: 'Sprawl Chronicler',
    traits: ['keeps_a_fair_hand'], contract: post('chronicler', 5),
  });
  place(ctx, {
    sex: 'female', age: 47, name: 'Sprawl Archivist',
    traits: ['keeps_the_house_archive'], contract: post('archivist', 5),
  });

  /**
   * THE OLD, who were missing from every fixture in the file.
   *
   * The sprawl runs 6 to 44 by construction and the other five top out at 55,
   * so the oldest person in any fixture was the demigod's 70-year-old head and
   * the oldest woman anywhere was 52. Gate 2 therefore answered "can this
   * cast" with a no for anything asking after age — which is a real gap now
   * that `the_old.yaml` exists, and was a silent one before it did: a
   * household this size always has two or three people in it past working,
   * there is no pension and no institution that takes anybody, and that is
   * most of what a crowded hall IS.
   */
  place(ctx, { sex: 'female', age: 76, name: 'Sprawl Grandmother' });
  place(ctx, { sex: 'male', age: 81, name: 'Sprawl Great-Uncle' });

  // One unusually clever member, in the acquired layer rather than the genome,
  // because a fixture cannot roll for an attribute and expect it. Expected
  // `mind` in this game is 30.4 and the tail is thin: no fixture had anybody
  // over about 30, so a slot asking for "cleverer than this family usually
  // manages" cast nobody against all six and gate 2 called content dead that
  // reaches 17% of real runs. `acquired` is the layer life writes to, which is
  // exactly what a scholar of the house is.
  const scholar = place(ctx, { sex: 'male', age: 31, name: 'Sprawl Notebook' });
  // +34 on a rolled base of about 6, for a total near 40. The other five
  // fixtures top out between 18 and 27, which is what the tail of this
  // distribution actually looks like.
  scholar.acquired.mind = 34;
  scholar.phenotype = undefined;

  return ctx;
}

/** Recorded everything it was ever asked. Poor, and it shows every clause it has recovered. */
function honestHouse(source: ContentBundle | Content): SimCtx {
  const ctx = bootstrap(source, 8105, 1042);
  ctx.world.treasury = 20;
  ctx.world.respect = 'known';
  for (const c of ctx.content.clauses.slice(0, 6)) ctx.world.clausesRecovered.add(c.id);
  return ctx;
}

/**
 * Embellished everything it could. Exalted, and hollow underneath it — and
 * generations enough have passed that the founder has long since crossed
 * over. That makes this the one fixture that can seat the frame's two
 * listeners (issue #13, `listener_blood`/`listener_record`) and the
 * `guardian` slot directly: a living Head plus Daveed, no longer alive but
 * permanently castable. It also carries the household's own midwife
 * (founding cast) and a newly-woken girl, covering the last outstanding
 * slot shape, `an_early_waking_daughter`'s MIDWIFE/GIRL pair.
 */
function storybookHouse(source: ContentBundle | Content): SimCtx {
  const ctx = bootstrap(source, 8106, 1042);
  ctx.world.treasury = 5;
  ctx.world.respect = 'exalted';
  let i = 0;
  for (const e of ctx.content.events) {
    if (!e.record) continue;
    ctx.world.discrepancies.set(`storybook_discrepancy_${i++}`, { severity: 'major', provableBy: [], state: 'open' });
  }

  if (ctx.world.narrator) ctx.world.people.kill(ctx.world.narrator, ctx.world.year, 'so the tale could begin');
  place(ctx, { sex: 'male', age: 50, name: 'The Current Head', castSlots: ['head'] });

  const girl = place(ctx, { sex: 'female', age: 10, name: 'A Girl Who Woke Early' });
  girl.awakening.awakened = true;

  return ctx;
}

export const TEST_FAMILIES: readonly TestFamily[] = [
  {
    id: 'barren_generation',
    name: 'The Barren Generation',
    description: 'An aging couple, past childbearing, with no children at all.',
    build: barrenGeneration,
  },
  {
    id: 'demigod_stagnant',
    name: 'The Demigod-Stagnant House',
    description: 'One man, one chair, fifty-five years — the tenure Demigod Stagnation is about.',
    build: demigodStagnant,
  },
  {
    id: 'single_survivor',
    name: 'The Single-Survivor Line',
    description: 'One living blood member and nobody else.',
    build: singleSurvivor,
  },
  {
    id: 'forty_member_sprawl',
    name: 'The 40-Member Sprawl',
    description: 'A crowded house across several halls.',
    build: fortyMemberSprawl,
  },
  {
    id: 'honest_house',
    name: 'The Honest House',
    description: 'Recorded everything. Poor, and knowledgeable.',
    build: honestHouse,
  },
  {
    id: 'storybook_house',
    name: 'The Storybook House',
    description: 'Embellished everything. Exalted, and hollow.',
    build: storybookHouse,
  },
];
